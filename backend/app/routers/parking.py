from datetime import datetime, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import models as m
from ..database import get_db
from ..security import require
from ..serializers import parking_record_out

router = APIRouter(prefix="/api", tags=["parking"])

HOURLY_CENTS = 500      # 临停 5 元/小时
FREE_MINUTES = 30       # 前 30 分钟免费
DAILY_CAP_CENTS = 5000  # 单日封顶 50 元


class ParkingEntryIn(BaseModel):
    plate_no: str = Field(min_length=2, max_length=20)
    parking_space_id: Optional[int] = None
    billing_type: Literal["temp", "monthly"] = "temp"
    entry_at: Optional[datetime] = None


@router.get("/parking-records")
def list_parking_records(status: Optional[Literal["in", "out"]] = None,
                         plate_no: Optional[str] = None,
                         _=Depends(require("parking:read")), db: Session = Depends(get_db)):
    q = db.query(m.ParkingRecord)
    if status:
        q = q.filter(m.ParkingRecord.status == status)
    if plate_no:
        q = q.filter(m.ParkingRecord.plate_no.contains(plate_no))
    return [parking_record_out(r) for r in q.order_by(m.ParkingRecord.id.desc())]


@router.post("/parking-records", status_code=201)
def parking_entry(body: ParkingEntryIn, _=Depends(require("parking:write")),
                  db: Session = Depends(get_db)):
    if body.parking_space_id and not db.get(m.ParkingSpace, body.parking_space_id):
        raise HTTPException(404, "车位不存在")
    r = m.ParkingRecord(plate_no=body.plate_no.upper(), parking_space_id=body.parking_space_id,
                        billing_type=body.billing_type, entry_at=body.entry_at or datetime.now())
    db.add(r)
    db.commit()
    return parking_record_out(r)


@router.post("/parking-records/{rid}/exit")
def parking_exit(rid: int, _=Depends(require("parking:write")), db: Session = Depends(get_db)):
    r = db.get(m.ParkingRecord, rid)
    if not r:
        raise HTTPException(404, "入场记录不存在")
    if r.status == "out":
        raise HTTPException(400, "该车辆已出场")
    now = datetime.now()
    minutes = max(0, int((now - r.entry_at).total_seconds() // 60))
    if r.billing_type == "monthly":
        amount = 0
    else:
        charge_minutes = max(0, minutes - FREE_MINUTES)
        hours = (charge_minutes + 59) // 60
        days = max(1, (minutes + 1439) // 1440)
        amount = min(hours * HOURLY_CENTS, days * DAILY_CAP_CENTS)
    r.exit_at = now
    r.amount_cents = amount
    r.status = "out"
    db.commit()
    return parking_record_out(r)


class RenewIn(BaseModel):
    months: int = Field(1, ge=1, le=24)


@router.post("/parking-spaces/{sid}/renew")
def renew_parking_space(sid: int, body: RenewIn, _=Depends(require("parking:write")),
                        db: Session = Depends(get_db)):
    s = db.get(m.ParkingSpace, sid)
    if not s:
        raise HTTPException(404, "车位不存在")
    base = s.expire_date if s.expire_date and s.expire_date > datetime.now() else datetime.now()
    s.expire_date = base + timedelta(days=30 * body.months)
    s.status = "rented"
    db.commit()
    return {"id": s.id, "code": s.code, "expire_date": s.expire_date.strftime("%Y-%m-%d"),
            "amount_cents": s.monthly_fee_cents * body.months}
