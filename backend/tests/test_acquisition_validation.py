"""Pure-schema regression tests. DB integration must run in Docker separately."""
from datetime import date
import pytest
from pydantic import ValidationError
from app.schemas.acquisition import AwardCreate, NotificationCreate


def notice(**overrides):
    values = dict(reference='N-1', notification_type='Preliminary', legal_framework='Demo framework', notification_date=date(2026, 9, 23), parcel_ids=[1, 2], status='RECORDED')
    values.update(overrides)
    return NotificationCreate(**values)


def test_valid_notification():
    assert notice().parcel_ids == [1, 2]


@pytest.mark.parametrize('parcel_ids', [[1, 1], [0], [], [-1]])
def test_invalid_parcel_ids(parcel_ids):
    with pytest.raises(ValidationError):
        notice(parcel_ids=parcel_ids)


def test_blank_reference_rejected():
    with pytest.raises(ValidationError):
        notice(reference='  ')


def test_invalid_status_rejected():
    with pytest.raises(ValidationError):
        notice(status='PUBLISHED')


def test_negative_award_rejected():
    with pytest.raises(ValidationError):
        AwardCreate(notification_id=1, parcel_id=2, reference='A1', award_date=date.today(), amount='-1')


def test_valid_award():
    record = AwardCreate(notification_id=1, parcel_id=2, reference='A1', award_date=date.today(), amount='1200.50')
    assert str(record.amount) == '1200.50'
