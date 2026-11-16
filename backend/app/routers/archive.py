from datetime import datetime
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models as m
from ..database import get_db
from ..security import require
from ..serializers import (community_out, family_out, owner_out, parking_space_out,
                           room_out, unit_out)

router = APIRouter(prefix="/api", tags=["archive"])


# ---------- 小区信息 ----------
class CommunityIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    address: Optional[str] = Field(None, max_length=200)
    contact_name: Optional[str] = Field(None, max_length=50)
    contact_phone: Optional[str] = Field(None, max_length=20)


@router.get("/community")
def get_community(_=Depends(require("archive:read")), db: Session = Depends(get_db)):
    c = db.query(m.Community).first()
    if not c:
        c = m.Community(name="我的小区")
        db.add(c)
        db.commit()
        db.refresh(c)
    return community_out(c)


@router.put("/community")
def update_community(body: CommunityIn, _=Depends(require("archive:write")),
                     db: Session = Depends(get_db)):
    c = db.query(m.Community).first()
    if not c:
        c = m.Community(**body.model_dump())
        db.add(c)
    else:
        for k, v in body.model_dump().items():
            setattr(c, k, v)
    db.commit()
    return community_out(c)


# ---------- 楼栋 ----------
class BuildingPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    floors: Optional[int] = Field(None, ge=1, le=200)


@router.patch("/buildings/{building_id}")
def update_building(building_id: int, body: BuildingPatch,
                    _=Depends(require("archive:write")), db: Session = Depends(get_db)):
    b = db.get(m.Building, building_id)
    if not b:
        raise HTTPException(404, "楼栋不存在")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(b, k, v)
    db.commit()
    return {"id": b.id, "name": b.name, "floors": b.floors}


@router.delete("/buildings/{building_id}", status_code=204)
def delete_building(building_id: int, _=Depends(require("archive:write")),
                    db: Session = Depends(get_db)):
    b = db.get(m.Building, building_id)
    if not b:
        raise HTTPException(404, "楼栋不存在")
    if db.query(m.Room).filter_by(building_id=building_id).count():
        raise HTTPException(400, "该楼栋下还有房屋，不能删除")
    if db.query(m.Unit).filter_by(building_id=building_id).count():
        raise HTTPException(400, "该楼栋下还有单元，不能删除")
    db.delete(b)
    db.commit()


# ---------- 单元 ----------
class UnitIn(BaseModel):
    building_id: int
    name: str = Field(min_length=1, max_length=50)


class UnitPatch(BaseModel):
    building_id: Optional[int] = None
    name: Optional[str] = Field(None, min_length=1, max_length=50)


@router.get("/units")
def list_units(building_id: Optional[int] = None, _=Depends(require("archive:read")),
               db: Session = Depends(get_db)):
    q = db.query(m.Unit)
    if building_id:
        q = q.filter(m.Unit.building_id == building_id)
    return [unit_out(u) for u in q.order_by(m.Unit.building_id, m.Unit.id)]


@router.post("/units", status_code=201)
def create_unit(body: UnitIn, _=Depends(require("archive:write")), db: Session = Depends(get_db)):
    if not db.get(m.Building, body.building_id):
        raise HTTPException(404, "楼栋不存在")
    u = m.Unit(**body.model_dump())
    db.add(u)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "该楼栋下已存在同名单元")
    return unit_out(u)


@router.patch("/units/{unit_id}")
def update_unit(unit_id: int, body: UnitPatch, _=Depends(require("archive:write")),
                db: Session = Depends(get_db)):
    u = db.get(m.Unit, unit_id)
    if not u:
        raise HTTPException(404, "单元不存在")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(u, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "该楼栋下已存在同名单元")
    return unit_out(u)


@router.delete("/units/{unit_id}", status_code=204)
def delete_unit(unit_id: int, _=Depends(require("archive:write")), db: Session = Depends(get_db)):
    u = db.get(m.Unit, unit_id)
    if not u:
        raise HTTPException(404, "单元不存在")
    if db.query(m.Room).filter_by(unit_id=unit_id).count():
        raise HTTPException(400, "该单元下还有房屋，不能删除")
    db.delete(u)
    db.commit()


# ---------- 房屋 ----------
class RoomUpdate(BaseModel):
    building_id: Optional[int] = None
    unit_id: Optional[int] = None
    room_no: Optional[str] = Field(None, min_length=1, max_length=20)
    area: Optional[float] = Field(None, gt=0)
    status: Optional[Literal["owner_occupied", "rented", "vacant"]] = None
    handover_status: Optional[Literal["received", "pending"]] = None
    fee_per_sqm_cents: Optional[int] = Field(None, ge=0)


@router.patch("/rooms/{room_id}")
def update_room(room_id: int, body: RoomUpdate, _=Depends(require("house:write")),
                db: Session = Depends(get_db)):
    r = db.get(m.Room, room_id)
    if not r:
        raise HTTPException(404, "房屋不存在")
    data = body.model_dump(exclude_unset=True)
    if data.get("unit_id"):
        unit = db.get(m.Unit, data["unit_id"])
        if not unit:
            raise HTTPException(404, "单元不存在")
        data.setdefault("building_id", unit.building_id)
    for k, v in data.items():
        setattr(r, k, v)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "该楼栋已存在相同房号")
    return room_out(r)


@router.delete("/rooms/{room_id}", status_code=204)
def delete_room(room_id: int, _=Depends(require("house:write")), db: Session = Depends(get_db)):
    r = db.get(m.Room, room_id)
    if not r:
        raise HTTPException(404, "房屋不存在")
    for model, label in [(m.Bill, "账单"), (m.RepairOrder, "报修单"), (m.Visitor, "访客记录"),
                         (m.Complaint, "投诉记录")]:
        if db.query(model).filter_by(room_id=room_id).count():
            raise HTTPException(400, f"该房屋存在{label}，不能删除")
    if db.query(m.Owner).filter_by(room_id=room_id).count():
        raise HTTPException(400, "该房屋仍关联业主，请先解除关联")
    db.delete(r)
    db.commit()


# ---------- 业主 ----------
class OwnerPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    phone: Optional[str] = Field(None, min_length=6, max_length=20)
    id_card_masked: Optional[str] = Field(None, max_length=30)
    is_tenant: Optional[bool] = None
    room_id: Optional[int] = None


@router.patch("/owners/{owner_id}")
def update_owner(owner_id: int, body: OwnerPatch, _=Depends(require("house:write")),
                 db: Session = Depends(get_db)):
    o = db.get(m.Owner, owner_id)
    if not o:
        raise HTTPException(404, "业主不存在")
    data = body.model_dump(exclude_unset=True)
    if data.get("room_id") and not db.get(m.Room, data["room_id"]):
        raise HTTPException(404, "房屋不存在")
    for k, v in data.items():
        setattr(o, k, v)
    db.commit()
    return owner_out(o)


@router.delete("/owners/{owner_id}", status_code=204)
def delete_owner(owner_id: int, _=Depends(require("house:write")), db: Session = Depends(get_db)):
    o = db.get(m.Owner, owner_id)
    if not o:
        raise HTTPException(404, "业主不存在")
    db.delete(o)
    db.commit()


# ---------- 家庭成员 ----------
class FamilyIn(BaseModel):
    owner_id: int
    name: str = Field(min_length=1, max_length=50)
    relation: str = Field("家属", max_length=20)
    phone: Optional[str] = Field(None, max_length=20)


class FamilyPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    relation: Optional[str] = Field(None, max_length=20)
    phone: Optional[str] = Field(None, max_length=20)


@router.get("/family-members")
def list_family(owner_id: Optional[int] = None, _=Depends(require("house:read")),
                db: Session = Depends(get_db)):
    q = db.query(m.FamilyMember)
    if owner_id:
        q = q.filter(m.FamilyMember.owner_id == owner_id)
    return [family_out(f) for f in q.order_by(m.FamilyMember.owner_id, m.FamilyMember.id)]


@router.post("/family-members", status_code=201)
def create_family(body: FamilyIn, _=Depends(require("house:write")),
                  db: Session = Depends(get_db)):
    if not db.get(m.Owner, body.owner_id):
        raise HTTPException(404, "业主不存在")
    f = m.FamilyMember(**body.model_dump())
    db.add(f)
    db.commit()
    return family_out(f)


@router.patch("/family-members/{mid}")
def update_family(mid: int, body: FamilyPatch, _=Depends(require("house:write")),
                  db: Session = Depends(get_db)):
    f = db.get(m.FamilyMember, mid)
    if not f:
        raise HTTPException(404, "成员不存在")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(f, k, v)
    db.commit()
    return family_out(f)


@router.delete("/family-members/{mid}", status_code=204)
def delete_family(mid: int, _=Depends(require("house:write")), db: Session = Depends(get_db)):
    f = db.get(m.FamilyMember, mid)
    if not f:
        raise HTTPException(404, "成员不存在")
    db.delete(f)
    db.commit()


# ---------- 车位档案 ----------
class ParkingSpaceIn(BaseModel):
    code: str = Field(min_length=1, max_length=30)
    building_id: Optional[int] = None
    space_type: Literal["fixed", "temp"] = "fixed"
    status: Literal["free", "rented", "sold"] = "free"
    plate_no: Optional[str] = Field(None, max_length=20)
    owner_name: Optional[str] = Field(None, max_length=50)
    monthly_fee_cents: int = Field(0, ge=0)
    expire_date: Optional[datetime] = None


class ParkingSpacePatch(BaseModel):
    building_id: Optional[int] = None
    space_type: Optional[Literal["fixed", "temp"]] = None
    status: Optional[Literal["free", "rented", "sold"]] = None
    plate_no: Optional[str] = Field(None, max_length=20)
    owner_name: Optional[str] = Field(None, max_length=50)
    monthly_fee_cents: Optional[int] = Field(None, ge=0)
    expire_date: Optional[datetime] = None


@router.get("/parking-spaces")
def list_parking_spaces(status: Optional[str] = None, space_type: Optional[str] = None,
                        _=Depends(require("archive:read")), db: Session = Depends(get_db)):
    q = db.query(m.ParkingSpace)
    if status:
        q = q.filter(m.ParkingSpace.status == status)
    if space_type:
        q = q.filter(m.ParkingSpace.space_type == space_type)
    return [parking_space_out(s) for s in q.order_by(m.ParkingSpace.code)]


@router.post("/parking-spaces", status_code=201)
def create_parking_space(body: ParkingSpaceIn, _=Depends(require("archive:write")),
                         db: Session = Depends(get_db)):
    if db.query(m.ParkingSpace).filter_by(code=body.code).first():
        raise HTTPException(409, "车位编号已存在")
    s = m.ParkingSpace(**body.model_dump())
    db.add(s)
    db.commit()
    return parking_space_out(s)


@router.patch("/parking-spaces/{sid}")
def update_parking_space(sid: int, body: ParkingSpacePatch,
                         _=Depends(require("archive:write")), db: Session = Depends(get_db)):
    s = db.get(m.ParkingSpace, sid)
    if not s:
        raise HTTPException(404, "车位不存在")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(s, k, v)
    db.commit()
    return parking_space_out(s)


@router.delete("/parking-spaces/{sid}", status_code=204)
def delete_parking_space(sid: int, _=Depends(require("archive:write")),
                         db: Session = Depends(get_db)):
    s = db.get(m.ParkingSpace, sid)
    if not s:
        raise HTTPException(404, "车位不存在")
    if db.query(m.ParkingRecord).filter_by(parking_space_id=sid).count():
        raise HTTPException(400, "该车位存在出入场记录，不能删除")
    db.delete(s)
    db.commit()
