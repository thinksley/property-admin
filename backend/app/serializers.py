"""统一的接口序列化，避免各路由重复拼装字段。"""
import csv
import io
from datetime import datetime
from typing import Iterable, Optional

from fastapi.responses import StreamingResponse

from . import models as m


def dt(v: Optional[datetime]) -> Optional[str]:
    return v.strftime("%Y-%m-%d %H:%M") if v else None


def d(v: Optional[datetime]) -> Optional[str]:
    return v.strftime("%Y-%m-%d") if v else None


def community_out(c: m.Community) -> dict:
    return {"id": c.id, "name": c.name, "address": c.address,
            "contact_name": c.contact_name, "contact_phone": c.contact_phone}


def unit_out(u: m.Unit) -> dict:
    return {"id": u.id, "building_id": u.building_id,
            "building_name": u.building.name if u.building else None, "name": u.name}


def room_out(r: m.Room) -> dict:
    return {"id": r.id, "building_id": r.building_id, "building_name": r.building.name,
            "unit_id": r.unit_id, "unit_name": r.unit.name if r.unit else None,
            "room_no": r.room_no, "area": r.area, "status": r.status,
            "handover_status": r.handover_status,
            "fee_per_sqm_cents": r.fee_per_sqm_cents, "owners": [o.name for o in r.owners]}


def owner_out(o: m.Owner) -> dict:
    return {"id": o.id, "name": o.name, "phone": o.phone, "id_card_masked": o.id_card_masked,
            "is_tenant": o.is_tenant, "room_id": o.room_id,
            "room_no": o.room.room_no if o.room else None,
            "building_name": o.room.building.name if o.room else None,
            "family_count": len(o.family)}


def family_out(f: m.FamilyMember) -> dict:
    return {"id": f.id, "owner_id": f.owner_id, "owner_name": f.owner.name if f.owner else None,
            "name": f.name, "relation": f.relation, "phone": f.phone}


def fee_item_out(f: m.FeeItem) -> dict:
    return {"id": f.id, "name": f.name, "code": f.code, "calc_type": f.calc_type,
            "unit_price_cents": f.unit_price_cents, "enabled": f.enabled}


def bill_out(b: m.Bill) -> dict:
    return {"id": b.id, "room_id": b.room_id, "room_no": b.room.room_no,
            "building_name": b.room.building.name,
            "period": b.period, "fee_type": b.fee_type, "fee_item_id": b.fee_item_id,
            "fee_item_name": b.fee_item.name if b.fee_item else None,
            "amount_cents": b.amount_cents, "paid_cents": b.paid_cents,
            "late_fee_cents": b.late_fee_cents,
            "balance_cents": b.amount_cents + b.late_fee_cents - b.paid_cents,
            "due_date": d(b.due_date), "status": b.status}


def payment_out(p: m.Payment) -> dict:
    b = p.bill
    return {"id": p.id, "bill_id": p.bill_id, "receipt_no": p.receipt_no,
            "amount_cents": p.amount_cents, "method": p.method, "operator": p.operator,
            "paid_at": dt(p.paid_at), "period": b.period if b else None,
            "fee_type": b.fee_type if b else None,
            "room_no": b.room.room_no if b and b.room else None,
            "building_name": b.room.building.name if b and b.room else None}


def repair_out(r: m.RepairOrder) -> dict:
    return {"id": r.id, "room_id": r.room_id, "room_no": r.room.room_no,
            "building_name": r.room.building.name,
            "category": r.category, "description": r.description, "status": r.status,
            "assignee": r.assignee, "rating": r.rating, "comment": r.comment,
            "created_at": r.created_at.strftime("%Y-%m-%d %H:%M"),
            "updated_at": r.updated_at.strftime("%Y-%m-%d %H:%M")}


def visitor_out(v: m.Visitor) -> dict:
    return {"id": v.id, "name": v.name, "phone": v.phone, "room_id": v.room_id,
            "room_no": v.room.room_no if v.room else None,
            "building_name": v.room.building.name if v.room else None,
            "host_name": v.host_name, "purpose": v.purpose, "visit_at": dt(v.visit_at),
            "status": v.status, "pass_code": v.pass_code, "created_at": dt(v.created_at)}


def parking_space_out(s: m.ParkingSpace) -> dict:
    return {"id": s.id, "code": s.code, "building_id": s.building_id,
            "building_name": s.building.name if s.building else None,
            "space_type": s.space_type, "status": s.status, "plate_no": s.plate_no,
            "owner_name": s.owner_name, "monthly_fee_cents": s.monthly_fee_cents,
            "expire_date": d(s.expire_date)}


def parking_record_out(r: m.ParkingRecord) -> dict:
    return {"id": r.id, "plate_no": r.plate_no, "parking_space_id": r.parking_space_id,
            "space_code": r.parking_space.code if r.parking_space else None,
            "billing_type": r.billing_type, "entry_at": dt(r.entry_at),
            "exit_at": dt(r.exit_at), "amount_cents": r.amount_cents, "status": r.status}


def complaint_out(c: m.Complaint) -> dict:
    return {"id": c.id, "room_id": c.room_id,
            "room_no": c.room.room_no if c.room else None,
            "building_name": c.room.building.name if c.room else None,
            "owner_name": c.owner_name, "phone": c.phone, "category": c.category,
            "content": c.content, "status": c.status, "handler": c.handler,
            "reply": c.reply, "follow_up": c.follow_up,
            "created_at": dt(c.created_at), "updated_at": dt(c.updated_at)}


def announcement_out(a: m.Announcement) -> dict:
    return {"id": a.id, "title": a.title, "content": a.content, "category": a.category,
            "status": a.status, "published_at": dt(a.published_at),
            "pushed_at": dt(a.pushed_at), "created_at": dt(a.created_at)}


def material_out(x: m.Material) -> dict:
    return {"id": x.id, "name": x.name, "category": x.category, "unit": x.unit,
            "stock": x.stock, "warning_stock": x.warning_stock,
            "low_stock": x.stock <= x.warning_stock}


def stock_record_out(x: m.StockRecord) -> dict:
    return {"id": x.id, "material_id": x.material_id,
            "material_name": x.material.name if x.material else None,
            "material_unit": x.material.unit if x.material else None,
            "record_type": x.record_type, "quantity": x.quantity,
            "amount_cents": x.amount_cents, "operator": x.operator, "note": x.note,
            "created_at": dt(x.created_at)}


def facility_out(x: m.Facility) -> dict:
    return {"id": x.id, "name": x.name, "category": x.category, "location": x.location,
            "status": x.status, "last_maintenance_at": dt(x.last_maintenance_at),
            "next_maintenance_at": dt(x.next_maintenance_at)}


def maintenance_out(x: m.MaintenanceRecord) -> dict:
    return {"id": x.id, "facility_id": x.facility_id,
            "facility_name": x.facility.name if x.facility else None,
            "content": x.content, "operator": x.operator, "maintained_at": dt(x.maintained_at)}


def inspection_point_out(x: m.InspectionPoint) -> dict:
    return {"id": x.id, "name": x.name, "location": x.location,
            "qr_code": x.qr_code, "enabled": x.enabled}


def inspection_record_out(x: m.InspectionRecord) -> dict:
    return {"id": x.id, "point_id": x.point_id,
            "point_name": x.point.name if x.point else None,
            "location": x.point.location if x.point else None,
            "inspector": x.inspector, "result": x.result, "note": x.note,
            "created_at": dt(x.created_at)}


def log_out(x: m.OperationLog) -> dict:
    return {"id": x.id, "username": x.username, "method": x.method, "path": x.path,
            "status_code": x.status_code, "ip": x.ip, "created_at": dt(x.created_at)}


def user_out(u: m.User) -> dict:
    return {"id": u.id, "username": u.username, "real_name": u.real_name,
            "role": u.role, "is_active": u.is_active}


def csv_response(filename: str, headers: Iterable[str], rows: Iterable[Iterable]) -> StreamingResponse:
    buf = io.StringIO()
    buf.write("\ufeff")  # 让 Excel 正确识别 UTF-8
    writer = csv.writer(buf)
    writer.writerow(list(headers))
    writer.writerows(rows)
    return StreamingResponse(
        iter([buf.getvalue()]), media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
