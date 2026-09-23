"""Payments ledger, R&R progress, milestones, and scoped activity feed."""
from datetime import date, datetime, time
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, require_roles
from app.core.project_access_dependency import get_accessible_project, project_scope
from app.database import get_db
from app.models.acquisition import AcquisitionAward, AcquisitionNotification
from app.models.document import ProjectDocument
from app.models.compensation import CompensationEstimate
from app.models.operations import CompensationPayment, ProjectMilestone, RRProgressEvent
from app.models.parcel import Parcel, ParcelBoundaryRevision
from app.models.possession import ParcelProgressEvent
from app.models.project import Project
from app.models.rr import RRHousehold
from app.models.user import User
from app.models.workflow import ProjectWorkflowEvent

router = APIRouter(prefix="/api/v1", tags=["Operations"], dependencies=[Depends(get_current_user)])


class PaymentInput(BaseModel):
    award_id: int = Field(gt=0)
    reference: str = Field(min_length=2, max_length=100)
    amount: Decimal = Field(gt=0, max_digits=16, decimal_places=2)
    payment_date: date
    notes: str | None = Field(default=None, max_length=1000)


class PaymentOutput(PaymentInput):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    recorded_by: str
    created_at: str


class MilestoneInput(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    target_date: date
    notes: str | None = Field(default=None, max_length=1000)


class MilestoneComplete(BaseModel):
    completed_date: date
    notes: str | None = Field(default=None, max_length=1000)


class RRStatusInput(BaseModel):
    status: Literal["VERIFIED", "ASSISTANCE_APPROVED", "ASSISTANCE_DELIVERED"]
    remarks: str | None = Field(default=None, max_length=1000)


@router.get("/projects/{project_id}/payments", dependencies=[Depends(get_accessible_project)])
def list_payments(project_id: int, db: Session = Depends(get_db)):
    return db.scalars(select(CompensationPayment).where(
        CompensationPayment.project_id == project_id).order_by(CompensationPayment.id.desc())).all()


@router.post("/projects/{project_id}/payments", status_code=201)
def record_payment(project_id: int, payload: PaymentInput,
                   actor: User = Depends(require_roles("DISTRICT_AUTHORITY", "STATE_AUTHORITY", "SYSTEM_ADMIN")),
                   project: Project = Depends(get_accessible_project), db: Session = Depends(get_db)):
    if project.status != "APPROVED":
        raise HTTPException(409, "Approve the project before recording disbursement.")
    award = db.scalar(select(AcquisitionAward).where(
        AcquisitionAward.id == payload.award_id,
        AcquisitionAward.project_id == project_id).with_for_update())
    if not award:
        raise HTTPException(422, "Select an award belonging to this project.")
    if payload.payment_date < award.award_date:
        raise HTTPException(422, "Payment date cannot precede the award date.")
    already = db.scalar(select(func.coalesce(func.sum(CompensationPayment.amount), 0)).where(
        CompensationPayment.award_id == award.id))
    if Decimal(already) + payload.amount > award.amount:
        raise HTTPException(409, "Payments against this award would exceed its assessed amount.")
    payment = CompensationPayment(project_id=project_id, award_id=award.id,
        reference=payload.reference.strip(), amount=payload.amount,
        payment_date=payload.payment_date, notes=payload.notes,
        recorded_by=actor.username)
    db.add(payment)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Payment reference already exists for this project.")
    db.refresh(payment)
    return payment


@router.get("/projects/{project_id}/milestones", dependencies=[Depends(get_accessible_project)])
def list_milestones(project_id: int, db: Session = Depends(get_db)):
    return db.scalars(select(ProjectMilestone).where(
        ProjectMilestone.project_id == project_id).order_by(ProjectMilestone.target_date)).all()


@router.post("/projects/{project_id}/milestones", status_code=201)
def create_milestone(project_id: int, payload: MilestoneInput,
                     actor: User = Depends(require_roles("PROJECT_OFFICER", "DISTRICT_AUTHORITY", "STATE_AUTHORITY", "SYSTEM_ADMIN")),
                     project: Project = Depends(get_accessible_project), db: Session = Depends(get_db)):
    title = payload.title.strip()
    if len(title) < 2:
        raise HTTPException(422, "Milestone title is required.")
    item = ProjectMilestone(project_id=project.id, title=title, target_date=payload.target_date,
                            notes=payload.notes, recorded_by=actor.username)
    db.add(item)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "A milestone with this title already exists.")
    db.refresh(item)
    return item


@router.patch("/projects/{project_id}/milestones/{milestone_id}")
def complete_milestone(project_id: int, milestone_id: int, payload: MilestoneComplete,
                       actor: User = Depends(require_roles("PROJECT_OFFICER", "DISTRICT_AUTHORITY", "STATE_AUTHORITY", "SYSTEM_ADMIN")),
                       project: Project = Depends(get_accessible_project), db: Session = Depends(get_db)):
    item = db.scalar(select(ProjectMilestone).where(ProjectMilestone.id == milestone_id,
        ProjectMilestone.project_id == project.id).with_for_update())
    if not item:
        raise HTTPException(404, "Milestone not found.")
    if item.completed_date:
        raise HTTPException(409, "Milestone already completed.")
    if payload.completed_date > date.today():
        raise HTTPException(422, "Completion date cannot be in the future.")
    item.completed_date = payload.completed_date
    item.notes = payload.notes or item.notes
    item.updated_by = actor.username
    db.commit()
    db.refresh(item)
    return item


@router.patch("/projects/{project_id}/rr-households/{household_id}/progress")
def update_rr_status(project_id: int, household_id: int, payload: RRStatusInput,
                     actor: User = Depends(require_roles("DISTRICT_AUTHORITY", "STATE_AUTHORITY", "SYSTEM_ADMIN")),
                     project: Project = Depends(get_accessible_project), db: Session = Depends(get_db)):
    household = db.scalar(select(RRHousehold).where(RRHousehold.id == household_id,
        RRHousehold.project_id == project.id).with_for_update())
    if household is None:
        raise HTTPException(404, "Household not found in this project.")
    following = {"IDENTIFIED": "VERIFIED", "VERIFIED": "ASSISTANCE_APPROVED",
                 "ASSISTANCE_APPROVED": "ASSISTANCE_DELIVERED"}
    if following.get(household.progress_status) != payload.status:
        raise HTTPException(409, "R&R progress must follow the next stage in order.")
    event = RRProgressEvent(project_id=project.id, household_id=household.id,
        previous_status=household.progress_status, new_status=payload.status,
        remarks=payload.remarks, recorded_by=actor.username)
    household.progress_status = payload.status
    db.add(event)
    db.commit()
    db.refresh(event)
    return {"household_id": household.id, "status": payload.status, "event_id": event.id}


@router.get("/projects/{project_id}/rr-households/{household_id}/history",
            dependencies=[Depends(get_accessible_project)])
def rr_history(project_id: int, household_id: int, db: Session = Depends(get_db)):
    if not db.scalar(select(RRHousehold.id).where(RRHousehold.id == household_id,
                                                  RRHousehold.project_id == project_id)):
        raise HTTPException(404, "Household not found in this project.")
    return db.scalars(select(RRProgressEvent).where(RRProgressEvent.project_id == project_id,
        RRProgressEvent.household_id == household_id).order_by(RRProgressEvent.id.desc())).all()


@router.get("/alerts")
def alerts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    today = date.today()
    entries = []
    projects = db.scalars(select(Project).where(project_scope(user)).order_by(Project.id.desc()).limit(200)).all()
    ids = [p.id for p in projects]
    if not ids:
        return entries
    for project in projects:
        if project.status == "SUBMITTED" and user.role in ("DISTRICT_AUTHORITY", "SYSTEM_ADMIN"):
            entries.append({"id": f"review-{project.id}", "project_id": project.id,
                            "level": "action", "title": "Proposal awaiting district scrutiny",
                            "detail": project.name})
        if project.status == "UNDER_REVIEW" and user.role in ("STATE_AUTHORITY", "SYSTEM_ADMIN"):
            entries.append({"id": f"approval-{project.id}", "project_id": project.id,
                            "level": "action", "title": "Proposal awaiting state decision",
                            "detail": project.name})
        if project.target_date and project.target_date < today and project.status != "APPROVED":
            entries.append({"id": f"target-{project.id}", "project_id": project.id,
                            "level": "overdue", "title": "Project target date passed",
                            "detail": f"{project.name} · {project.target_date.isoformat()}"})
    items = db.scalars(select(ProjectMilestone).where(ProjectMilestone.project_id.in_(ids),
        ProjectMilestone.completed_date.is_(None), ProjectMilestone.target_date <= today).limit(200)).all()
    for milestone in items:
        entries.append({"id": f"milestone-{milestone.id}", "project_id": milestone.project_id,
                        "level": "overdue" if milestone.target_date < today else "due",
                        "title": milestone.title, "detail": f"Milestone due {milestone.target_date.isoformat()}"})
    return entries[:200]


@router.get("/projects/{project_id}/audit", dependencies=[Depends(get_accessible_project)])
def project_audit(project_id: int, db: Session = Depends(get_db)):
    """Read-only timeline assembled from immutable operational/event records."""
    sources = [
        (ProjectWorkflowEvent, "Workflow", "action", "actor_reference", "created_at"),
        (ParcelProgressEvent, "Parcel progress", "action", "recorded_by_username", "recorded_at"),
        (AcquisitionNotification, "Notification", "reference", "actor_reference", "created_at"),
        (AcquisitionAward, "Award", "reference", "actor_reference", "created_at"),
        (CompensationPayment, "Disbursement record", "reference", "recorded_by", "created_at"),
        (RRProgressEvent, "R&R progress", "new_status", "recorded_by", "created_at"),
        (ProjectDocument, "Document upload", "original_filename", "uploaded_by_username", "uploaded_at"),
        (ProjectMilestone, "Milestone created", "title", "recorded_by", "created_at"),
        (CompensationEstimate, "Compensation estimate", "id", "created_by_username", "created_at"),
        (RRHousehold, "Affected household", "household_reference", "created_by_username", "created_at"),
        (Parcel, "Land parcel", "survey_number", "recorded_by_username", "created_at"),
    ]
    result = []
    for model, kind, title_field, actor_field, date_field in sources:
        for row in db.scalars(select(model).where(model.project_id == project_id)
                              .order_by(getattr(model, "id").desc()).limit(100)):
            result.append({"id": f"{kind}-{row.id}", "kind": kind,
                           "detail": str(getattr(row, title_field)),
                           "actor": getattr(row, actor_field) or "Legacy record",
                           "at": getattr(row, date_field)})
    for revision in db.scalars(select(ParcelBoundaryRevision).where(
        ParcelBoundaryRevision.project_id == project_id)
        .order_by(ParcelBoundaryRevision.id.desc()).limit(100)):
        result.append({
            "id": f"Boundary correction-{revision.id}",
            "kind": "Boundary correction",
            "detail": (
                f"Parcel {revision.parcel_id}: {revision.previous_area_ha:.4f} ha"
                f" to {revision.corrected_area_ha:.4f} ha. {revision.reason}"
            ),
            "actor": revision.actor_reference,
            "at": revision.created_at,
        })
    for milestone in db.scalars(select(ProjectMilestone).where(
        ProjectMilestone.project_id == project_id, ProjectMilestone.completed_date.is_not(None))):
        result.append({"id": f"Milestone completed-{milestone.id}", "kind": "Milestone completed",
                       "detail": milestone.title, "actor": milestone.updated_by or "Legacy record",
                       "at": milestone.completed_date})
    project = db.get(Project, project_id)
    result.append({"id": f"Project-{project_id}", "kind": "Project registered",
                   "detail": project.name, "actor": project.owner_username or "Legacy record",
                   "at": project.created_at})
    def audit_order(entry):
        recorded_at = entry["at"]
        if isinstance(recorded_at, datetime):
            return (recorded_at.date(), 0, recorded_at.time(), entry["id"])
        # A completed milestone stores a date without a time. Keep these
        # entries together at the start of that day's events.
        return (recorded_at, 1, time.min, entry["id"])

    return sorted(result, key=audit_order, reverse=True)[:250]
