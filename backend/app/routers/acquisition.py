"""Project-scoped demonstration records; no official publication or payment occurs."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.dependencies import get_current_user, require_roles
from app.core.project_access_dependency import get_accessible_project
from app.database import get_db
from app.models.project import Project
from app.models.parcel import Parcel
from app.models.acquisition import AcquisitionAward, AcquisitionNotification, NotificationParcel
from app.schemas.acquisition import AwardCreate, AwardResponse, NotificationCreate, NotificationResponse

router = APIRouter(prefix='/api/v1/projects', tags=['Acquisition records'], dependencies=[Depends(get_current_user)])


def existing_project(db: Session, project_id: int) -> Project:
    project = db.get(Project, project_id)
    if not project:
        raise HTTPException(404, 'Project not found.')
    return project


def serialize_notification(db: Session, item: AcquisitionNotification) -> NotificationResponse:
    ids = db.scalars(select(NotificationParcel.parcel_id).where(NotificationParcel.notification_id == item.id).order_by(NotificationParcel.parcel_id)).all()
    return NotificationResponse.model_validate({**{field: getattr(item, field) for field in NotificationResponse.model_fields if field != 'parcel_ids'}, 'parcel_ids': list(ids)})


@router.get('/{project_id}/notifications', dependencies=[Depends(get_accessible_project)], response_model=list[NotificationResponse])
def list_notifications(project_id: int, db: Session = Depends(get_db)):
    existing_project(db, project_id)
    items = db.scalars(select(AcquisitionNotification).where(AcquisitionNotification.project_id == project_id).order_by(AcquisitionNotification.id.desc())).all()
    return [serialize_notification(db, item) for item in items]


@router.post('/{project_id}/notifications', dependencies=[Depends(require_roles('DISTRICT_AUTHORITY', 'STATE_AUTHORITY', 'SYSTEM_ADMIN')), Depends(get_accessible_project)], response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
def create_notification(project_id: int, payload: NotificationCreate, db: Session = Depends(get_db), actor=Depends(require_roles('DISTRICT_AUTHORITY', 'STATE_AUTHORITY', 'SYSTEM_ADMIN'))):
    project = existing_project(db, project_id)
    if project.status != 'APPROVED':
        raise HTTPException(409, 'Project must be approved before recording an acquisition notification.')
    parcel_ids = set(db.scalars(select(Parcel.id).where(Parcel.project_id == project_id, Parcel.id.in_(payload.parcel_ids))).all())
    if parcel_ids != set(payload.parcel_ids):
        raise HTTPException(422, 'All selected parcels must belong to this project.')
    item = AcquisitionNotification(project_id=project_id, reference=payload.reference, notification_type=payload.notification_type, legal_framework=payload.legal_framework, notification_date=payload.notification_date, status=payload.status, notes=payload.notes, actor_reference=actor.username)
    try:
        db.add(item)
        db.flush()
        db.add_all([NotificationParcel(notification_id=item.id, parcel_id=parcel_id) for parcel_id in payload.parcel_ids])
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'Notification reference already exists for this project.')
    db.refresh(item)
    return serialize_notification(db, item)


@router.get('/{project_id}/awards', dependencies=[Depends(get_accessible_project)], response_model=list[AwardResponse])
def list_awards(project_id: int, db: Session = Depends(get_db)):
    existing_project(db, project_id)
    return db.scalars(select(AcquisitionAward).where(AcquisitionAward.project_id == project_id).order_by(AcquisitionAward.id.desc())).all()


@router.post('/{project_id}/awards', dependencies=[Depends(require_roles('DISTRICT_AUTHORITY', 'STATE_AUTHORITY', 'SYSTEM_ADMIN')), Depends(get_accessible_project)], response_model=AwardResponse, status_code=status.HTTP_201_CREATED)
def create_award(project_id: int, payload: AwardCreate, db: Session = Depends(get_db), actor=Depends(require_roles('DISTRICT_AUTHORITY', 'STATE_AUTHORITY', 'SYSTEM_ADMIN'))):
    project = existing_project(db, project_id)
    if project.status != 'APPROVED':
        raise HTTPException(409, 'Project must be approved before recording an award.')
    notification = db.get(AcquisitionNotification, payload.notification_id)
    if notification is None or notification.project_id != project_id or notification.status != 'RECORDED':
        raise HTTPException(422, 'Choose a recorded notification belonging to this project.')
    parcel = db.get(Parcel, payload.parcel_id)
    if parcel is None or parcel.project_id != project_id:
        raise HTTPException(422, 'Parcel must belong to this project.')
    link = db.scalar(select(NotificationParcel.id).where(NotificationParcel.notification_id == notification.id, NotificationParcel.parcel_id == parcel.id))
    if link is None:
        raise HTTPException(422, 'Parcel must be associated with the selected notification.')
    if payload.award_date < notification.notification_date:
        raise HTTPException(422, 'Award date cannot precede the notification date.')
    item = AcquisitionAward(project_id=project_id, notification_id=notification.id, parcel_id=parcel.id, reference=payload.reference, award_date=payload.award_date, amount=payload.amount, notes=payload.notes, actor_reference=actor.username)
    try:
        db.add(item)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, 'Award reference already exists for this project.')
    db.refresh(item)
    return item
