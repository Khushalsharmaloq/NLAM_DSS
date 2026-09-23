"""Jurisdiction-scoped reports and explainable schedule forecasts."""
import csv
import io
from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.project_access_dependency import get_accessible_project, project_scope
from app.database import get_db
from app.models.acquisition import AcquisitionAward, AcquisitionNotification, NotificationParcel
from app.models.compensation import CompensationEstimate
from app.models.operations import CompensationPayment, ProjectMilestone
from app.models.parcel import Parcel
from app.models.possession import ParcelProgressEvent
from app.models.project import Project
from app.models.rr import RRHousehold
from app.models.user import User

router = APIRouter(prefix="/api/v1/mis", tags=["Management reports"],
                   dependencies=[Depends(get_current_user)])
STATUSES = ("DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "RETURNED", "REJECTED")
STAGES = ("REGISTERED", "SURVEY_RECORDED", "DOCUMENTATION_RECORDED", "POSSESSION_RECORDED")


def scoped_ids(user, state=None, district=None, status=None):
    query = select(Project.id).where(project_scope(user))
    for column, value in ((Project.state, state), (Project.district, district),
                          (Project.status, status)):
        if value:
            query = query.where(column == value)
    return query


@router.get("/overview")
def overview(state: str | None = Query(None, max_length=100),
             district: str | None = Query(None, max_length=100),
             status: str | None = Query(None, max_length=30),
             db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ids = scoped_ids(user, state, district, status)
    projects = db.execute(select(func.count(Project.id), func.coalesce(func.sum(Project.proposed_area_ha), 0),
        func.count(distinct(Project.state))).where(Project.id.in_(ids))).one()
    statuses = dict(db.execute(select(Project.status, func.count()).where(
        Project.id.in_(ids)).group_by(Project.status)).all())
    latest = select(ParcelProgressEvent.parcel_id,
        func.max(ParcelProgressEvent.id).label("last_id")).where(
        ParcelProgressEvent.project_id.in_(ids)).group_by(ParcelProgressEvent.parcel_id).subquery()
    stages = db.execute(select(Parcel.area_ha, func.coalesce(ParcelProgressEvent.new_stage, "REGISTERED"))
        .outerjoin(latest, latest.c.parcel_id == Parcel.id)
        .outerjoin(ParcelProgressEvent, ParcelProgressEvent.id == latest.c.last_id)
        .where(Parcel.project_id.in_(ids))).all()
    stage_counts = dict.fromkeys(STAGES, 0)
    acquired = Decimal("0")
    for area, stage in stages:
        stage_counts[stage] = stage_counts.get(stage, 0) + 1
        if stage == "POSSESSION_RECORDED":
            acquired += area
    notified = db.scalar(select(func.coalesce(func.sum(Parcel.area_ha), 0)).where(
        Parcel.id.in_(select(distinct(NotificationParcel.parcel_id)).join(
            AcquisitionNotification, AcquisitionNotification.id == NotificationParcel.notification_id)
            .where(AcquisitionNotification.project_id.in_(ids), AcquisitionNotification.status == "RECORDED"))))
    awards = db.execute(select(func.count(), func.coalesce(func.sum(AcquisitionAward.amount), 0)).where(
        AcquisitionAward.project_id.in_(ids))).one()
    paid = db.scalar(select(func.coalesce(func.sum(CompensationPayment.amount), 0)).where(
        CompensationPayment.project_id.in_(ids)))
    households = db.execute(select(func.count(), func.coalesce(func.sum(RRHousehold.affected_persons), 0),
        func.count().filter(RRHousehold.relocation_required),
        func.coalesce(func.sum(RRHousehold.indicative_assistance_inr), 0)).where(
        RRHousehold.project_id.in_(ids))).one()
    rr_status = dict(db.execute(select(RRHousehold.progress_status, func.count()).where(
        RRHousehold.project_id.in_(ids)).group_by(RRHousehold.progress_status)).all())
    estimate_ids = select(func.max(CompensationEstimate.id).label("id")).where(
        CompensationEstimate.project_id.in_(ids)).group_by(CompensationEstimate.parcel_id).subquery()
    estimate_total = db.scalar(select(func.coalesce(func.sum(CompensationEstimate.estimated_total), 0))
        .join(estimate_ids, estimate_ids.c.id == CompensationEstimate.id))
    estimates = db.scalar(select(func.count()).where(CompensationEstimate.project_id.in_(ids)))
    overdue = db.scalar(select(func.count()).where(ProjectMilestone.project_id.in_(ids),
        ProjectMilestone.target_date < date.today(), ProjectMilestone.completed_date.is_(None)))
    milestones = db.scalar(select(func.count()).where(ProjectMilestone.project_id.in_(ids)))
    completed = db.scalar(select(func.count()).where(ProjectMilestone.project_id.in_(ids),
        ProjectMilestone.completed_date.is_not(None)))
    return {
        "project_count": projects[0], "proposed_area_ha": f"{projects[1]:.4f}",
        "states_count": projects[2], "project_status_counts": {s: statuses.get(s, 0) for s in STATUSES},
        "parcel_count": len(stages), "parcel_stage_counts": stage_counts,
        "notified_area_ha": f"{notified:.4f}", "acquired_area_ha": f"{acquired:.4f}",
        "award_count": awards[0], "compensation_assessed_inr": f"{awards[1]:.2f}",
        "compensation_paid_inr": f"{paid:.2f}", "compensation_estimate_records": estimates,
        "compensation_parcels_with_estimates": db.scalar(select(func.count()).select_from(estimate_ids)),
        "compensation_latest_per_parcel_total_inr": f"{estimate_total:.2f}",
        "rr_household_count": households[0], "rr_affected_persons": households[1],
        "rr_relocation_anticipated_households": households[2],
        "rr_indicative_assistance_total_inr": f"{households[3]:.2f}",
        "rr_status_counts": rr_status, "milestone_count": milestones,
        "milestone_completed_count": completed, "milestone_overdue_count": overdue,
    }


@router.get("/state-summary")
def state_summary(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.execute(select(Project.state, func.count(Project.id),
        func.coalesce(func.sum(Project.proposed_area_ha), 0)).where(
        project_scope(user)).group_by(Project.state).order_by(Project.state)).all()
    visible = scoped_ids(user)
    approved = dict(db.execute(select(Project.state, func.count()).where(
        Project.id.in_(visible), Project.status == "APPROVED").group_by(Project.state)).all())
    awards = dict(db.execute(select(Project.state, func.coalesce(func.sum(AcquisitionAward.amount), 0))
        .join(Project, Project.id == AcquisitionAward.project_id).where(
        Project.id.in_(visible)).group_by(Project.state)).all())
    payments = dict(db.execute(select(Project.state, func.coalesce(func.sum(CompensationPayment.amount), 0))
        .join(Project, Project.id == CompensationPayment.project_id).where(
        Project.id.in_(visible)).group_by(Project.state)).all())
    possession_ids = select(distinct(ParcelProgressEvent.parcel_id)).where(
        ParcelProgressEvent.project_id.in_(visible),
        ParcelProgressEvent.new_stage == "POSSESSION_RECORDED")
    acquired = dict(db.execute(select(Project.state, func.coalesce(func.sum(Parcel.area_ha), 0))
        .join(Parcel, Parcel.project_id == Project.id).where(
        Project.id.in_(visible), Parcel.id.in_(possession_ids)).group_by(Project.state)).all())
    return [{"state": state, "projects": count, "approved": approved.get(state, 0),
             "proposed_area_ha": str(area), "acquired_area_ha": str(acquired.get(state, 0)),
             "assessed_inr": str(awards.get(state, 0)), "paid_inr": str(payments.get(state, 0))}
            for state, count, area in rows]


@router.get("/export.csv")
def export_csv(state: str | None = Query(None, max_length=100),
               district: str | None = Query(None, max_length=100),
               status: str | None = Query(None, max_length=30),
               db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Project ID", "Project", "State", "District", "Status", "Proposed ha", "Target date"])
    def safe(value):
        raw = str(value or "")
        return "'" + raw if raw.lstrip().startswith(("=", "+", "-", "@")) else raw
    for project in db.scalars(select(Project).where(Project.id.in_(
            scoped_ids(user, state, district, status))).order_by(Project.id)):
        writer.writerow([project.id, safe(project.name), safe(project.state), safe(project.district),
            safe(project.status), str(project.proposed_area_ha),
            project.target_date.isoformat() if project.target_date else ""])
    return Response(output.getvalue(), media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="nlam-projects.csv"',
                 "Cache-Control": "no-store"})


@router.get("/projects/{project_id}/forecast")
def project_forecast(project_id: int, project: Project = Depends(get_accessible_project),
                     db: Session = Depends(get_db)):
    total = db.scalar(select(func.count()).where(Parcel.project_id == project_id))
    acquired = db.scalar(select(func.count(distinct(ParcelProgressEvent.parcel_id))).where(
        ParcelProgressEvent.project_id == project_id,
        ParcelProgressEvent.new_stage == "POSSESSION_RECORDED"))
    overdue = db.scalar(select(func.count()).where(ProjectMilestone.project_id == project_id,
        ProjectMilestone.target_date < date.today(), ProjectMilestone.completed_date.is_(None)))
    elapsed = max((date.today() - project.created_at.date()).days, 1)
    remaining = max(total - acquired, 0)
    forecast = None
    if acquired and total:
        forecast = (date.today() + timedelta(days=min(3650,
            (remaining * elapsed + acquired - 1) // acquired))).isoformat()
    late = bool(project.target_date and project.target_date < date.today() and remaining > 0)
    score = min(100, overdue * 20 + (35 if late else 0) +
                (20 if total and acquired == 0 and elapsed > 30 else 0))
    return {"project_id": project_id, "method": "observed parcel completion rate",
        "parcel_count": total, "possession_recorded": acquired,
        "overdue_milestones": overdue, "risk_score": score,
        "risk_level": "high" if score >= 60 else "moderate" if score >= 25 else "low",
        "estimated_completion_date": forecast,
        "note": "Illustrative trend based on elapsed days and recorded parcel events; insufficient history yields no date."}
