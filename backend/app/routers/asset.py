from datetime import datetime, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import models as m
from ..database import get_db
from ..security import current_user, require
from ..serializers import (facility_out, inspection_point_out, inspection_record_out,
                           maintenance_out, material_out, stock_record_out)

router = APIRouter(prefix="/api", tags=["asset"])


# ---------- 物料库存 ----------
class MaterialIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    category: str = Field("其他", max_length=30)
    unit: str = Field("件", max_length=10)
    stock: int = Field(0, ge=0)
    warning_stock: int = Field(0, ge=0)


class MaterialPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=80)
    category: Optional[str] = Field(None, max_length=30)
    unit: Optional[str] = Field(None, max_length=10)
    warning_stock: Optional[int] = Field(None, ge=0)


@router.get("/materials")
def list_materials(low_stock: bool = False, _=Depends(require("asset:read")),
                   db: Session = Depends(get_db)):
    items = db.query(m.Material).order_by(m.Material.id).all()
    if low_stock:
        items = [x for x in items if x.stock <= x.warning_stock]
    return [material_out(x) for x in items]


@router.post("/materials", status_code=201)
def create_material(body: MaterialIn, _=Depends(require("asset:write")),
                    db: Session = Depends(get_db)):
    x = m.Material(**body.model_dump())
    db.add(x)
    db.commit()
    return material_out(x)


@router.patch("/materials/{mid}")
def update_material(mid: int, body: MaterialPatch, _=Depends(require("asset:write")),
                    db: Session = Depends(get_db)):
    x = db.get(m.Material, mid)
    if not x:
        raise HTTPException(404, "物料不存在")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(x, k, v)
    db.commit()
    return material_out(x)


@router.delete("/materials/{mid}", status_code=204)
def delete_material(mid: int, _=Depends(require("asset:write")), db: Session = Depends(get_db)):
    x = db.get(m.Material, mid)
    if not x:
        raise HTTPException(404, "物料不存在")
    if db.query(m.StockRecord).filter_by(material_id=mid).count():
        raise HTTPException(400, "该物料存在出入库记录，不能删除")
    db.delete(x)
    db.commit()


class StockIn(BaseModel):
    record_type: Literal["in", "out"]
    quantity: int = Field(ge=1)
    amount_cents: int = Field(0, ge=0)
    note: Optional[str] = Field(None, max_length=255)


@router.post("/materials/{mid}/stock")
def change_stock(mid: int, body: StockIn, user: m.User = Depends(require("asset:write")),
                 db: Session = Depends(get_db)):
    x = db.get(m.Material, mid)
    if not x:
        raise HTTPException(404, "物料不存在")
    if body.record_type == "out" and x.stock < body.quantity:
        raise HTTPException(400, f"库存不足，当前库存 {x.stock}{x.unit}")
    x.stock += body.quantity if body.record_type == "in" else -body.quantity
    db.add(m.StockRecord(material_id=mid, record_type=body.record_type,
                         quantity=body.quantity, amount_cents=body.amount_cents,
                         operator=user.real_name, note=body.note))
    db.commit()
    return material_out(x)


@router.get("/stock-records")
def list_stock_records(material_id: Optional[int] = None,
                       _=Depends(require("asset:read")), db: Session = Depends(get_db)):
    q = db.query(m.StockRecord)
    if material_id:
        q = q.filter(m.StockRecord.material_id == material_id)
    return [stock_record_out(x) for x in q.order_by(m.StockRecord.id.desc()).limit(300)]


# ---------- 公共设施 ----------
class FacilityIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    category: str = Field("其他", max_length=30)
    location: Optional[str] = Field(None, max_length=100)
    status: Literal["normal", "repairing", "stopped"] = "normal"
    next_maintenance_at: Optional[datetime] = None


class FacilityPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=80)
    category: Optional[str] = Field(None, max_length=30)
    location: Optional[str] = Field(None, max_length=100)
    status: Optional[Literal["normal", "repairing", "stopped"]] = None
    next_maintenance_at: Optional[datetime] = None


@router.get("/facilities")
def list_facilities(_=Depends(require("asset:read")), db: Session = Depends(get_db)):
    return [facility_out(x) for x in db.query(m.Facility).order_by(m.Facility.id)]


@router.post("/facilities", status_code=201)
def create_facility(body: FacilityIn, _=Depends(require("asset:write")),
                    db: Session = Depends(get_db)):
    x = m.Facility(**body.model_dump())
    db.add(x)
    db.commit()
    return facility_out(x)


@router.patch("/facilities/{fid}")
def update_facility(fid: int, body: FacilityPatch, _=Depends(require("asset:write")),
                    db: Session = Depends(get_db)):
    x = db.get(m.Facility, fid)
    if not x:
        raise HTTPException(404, "设施不存在")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(x, k, v)
    db.commit()
    return facility_out(x)


@router.delete("/facilities/{fid}", status_code=204)
def delete_facility(fid: int, _=Depends(require("asset:write")), db: Session = Depends(get_db)):
    x = db.get(m.Facility, fid)
    if not x:
        raise HTTPException(404, "设施不存在")
    if db.query(m.MaintenanceRecord).filter_by(facility_id=fid).count():
        raise HTTPException(400, "该设施存在保养记录，不能删除")
    db.delete(x)
    db.commit()


class MaintainIn(BaseModel):
    content: str = Field(min_length=2, max_length=255)


@router.post("/facilities/{fid}/maintain")
def maintain_facility(fid: int, body: MaintainIn,
                      user: m.User = Depends(require("asset:write")),
                      db: Session = Depends(get_db)):
    x = db.get(m.Facility, fid)
    if not x:
        raise HTTPException(404, "设施不存在")
    now = datetime.now()
    x.last_maintenance_at = now
    x.next_maintenance_at = now + timedelta(days=90)
    x.status = "normal"
    db.add(m.MaintenanceRecord(facility_id=fid, content=body.content, operator=user.real_name))
    db.commit()
    return facility_out(x)


@router.get("/maintenance-records")
def list_maintenance(facility_id: Optional[int] = None, _=Depends(require("asset:read")),
                     db: Session = Depends(get_db)):
    q = db.query(m.MaintenanceRecord)
    if facility_id:
        q = q.filter(m.MaintenanceRecord.facility_id == facility_id)
    return [maintenance_out(x) for x in q.order_by(m.MaintenanceRecord.id.desc()).limit(300)]


# ---------- 巡检管理 ----------
class InspectionPointIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    location: Optional[str] = Field(None, max_length=100)
    qr_code: str = Field(min_length=1, max_length=50)
    enabled: bool = True


class InspectionPointPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=80)
    location: Optional[str] = Field(None, max_length=100)
    enabled: Optional[bool] = None


@router.get("/inspection-points")
def list_inspection_points(_=Depends(require("inspection:read")), db: Session = Depends(get_db)):
    return [inspection_point_out(x) for x in db.query(m.InspectionPoint).order_by(m.InspectionPoint.id)]


@router.post("/inspection-points", status_code=201)
def create_inspection_point(body: InspectionPointIn,
                            _=Depends(require("inspection:write")),
                            db: Session = Depends(get_db)):
    if db.query(m.InspectionPoint).filter_by(qr_code=body.qr_code).first():
        raise HTTPException(409, "巡检码已存在")
    x = m.InspectionPoint(**body.model_dump())
    db.add(x)
    db.commit()
    return inspection_point_out(x)


@router.patch("/inspection-points/{pid}")
def update_inspection_point(pid: int, body: InspectionPointPatch,
                            _=Depends(require("inspection:write")),
                            db: Session = Depends(get_db)):
    x = db.get(m.InspectionPoint, pid)
    if not x:
        raise HTTPException(404, "巡检点不存在")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(x, k, v)
    db.commit()
    return inspection_point_out(x)


@router.delete("/inspection-points/{pid}", status_code=204)
def delete_inspection_point(pid: int, _=Depends(require("inspection:write")),
                            db: Session = Depends(get_db)):
    x = db.get(m.InspectionPoint, pid)
    if not x:
        raise HTTPException(404, "巡检点不存在")
    if db.query(m.InspectionRecord).filter_by(point_id=pid).count():
        raise HTTPException(400, "该巡检点已有打卡记录，不能删除")
    db.delete(x)
    db.commit()


class InspectionCheckIn(BaseModel):
    point_id: int
    result: Literal["normal", "abnormal"] = "normal"
    note: Optional[str] = Field(None, max_length=255)


@router.get("/inspection-records")
def list_inspection_records(point_id: Optional[int] = None, result: Optional[str] = None,
                            _=Depends(require("inspection:read")), db: Session = Depends(get_db)):
    q = db.query(m.InspectionRecord)
    if point_id:
        q = q.filter(m.InspectionRecord.point_id == point_id)
    if result:
        q = q.filter(m.InspectionRecord.result == result)
    return [inspection_record_out(x) for x in q.order_by(m.InspectionRecord.id.desc()).limit(300)]


@router.post("/inspection-records", status_code=201)
def inspection_check_in(body: InspectionCheckIn,
                        user: m.User = Depends(require("inspection:write")),
                        db: Session = Depends(get_db)):
    if not db.get(m.InspectionPoint, body.point_id):
        raise HTTPException(404, "巡检点不存在")
    x = m.InspectionRecord(point_id=body.point_id, inspector=user.real_name,
                           result=body.result, note=body.note)
    db.add(x)
    db.commit()
    return inspection_record_out(x)
