from datetime import datetime
from typing import Literal, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import models as m
from ..database import get_db
from ..security import require
from ..serializers import bill_out, csv_response, fee_item_out, payment_out

router = APIRouter(prefix="/api", tags=["fee"])


# ---------- 收费项目 ----------
class FeeItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    code: str = Field(min_length=1, max_length=20, pattern=r"^[a-z][a-z0-9_]*$")
    calc_type: Literal["area", "fixed"] = "area"
    unit_price_cents: int = Field(0, ge=0)
    enabled: bool = True


class FeeItemPatch(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    calc_type: Optional[Literal["area", "fixed"]] = None
    unit_price_cents: Optional[int] = Field(None, ge=0)
    enabled: Optional[bool] = None


@router.get("/fee-items")
def list_fee_items(_=Depends(require("fee:read")), db: Session = Depends(get_db)):
    return [fee_item_out(f) for f in db.query(m.FeeItem).order_by(m.FeeItem.id)]


@router.post("/fee-items", status_code=201)
def create_fee_item(body: FeeItemIn, _=Depends(require("fee:write")),
                    db: Session = Depends(get_db)):
    if db.query(m.FeeItem).filter_by(code=body.code).first():
        raise HTTPException(409, "收费项目编码已存在")
    f = m.FeeItem(**body.model_dump())
    db.add(f)
    db.commit()
    return fee_item_out(f)


@router.patch("/fee-items/{fid}")
def update_fee_item(fid: int, body: FeeItemPatch, _=Depends(require("fee:write")),
                    db: Session = Depends(get_db)):
    f = db.get(m.FeeItem, fid)
    if not f:
        raise HTTPException(404, "收费项目不存在")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(f, k, v)
    db.commit()
    return fee_item_out(f)


@router.delete("/fee-items/{fid}", status_code=204)
def delete_fee_item(fid: int, _=Depends(require("fee:write")), db: Session = Depends(get_db)):
    f = db.get(m.FeeItem, fid)
    if not f:
        raise HTTPException(404, "收费项目不存在")
    if db.query(m.Bill).filter_by(fee_item_id=fid).count():
        raise HTTPException(400, "该收费项目已产生账单，不能删除，可改为停用")
    db.delete(f)
    db.commit()


# ---------- 缴费记录 ----------
@router.get("/payments")
def list_payments(period: Optional[str] = None, method: Optional[str] = None,
                  _=Depends(require("bill:read")), db: Session = Depends(get_db)):
    q = db.query(m.Payment).join(m.Bill, m.Payment.bill_id == m.Bill.id)
    if period:
        q = q.filter(m.Bill.period == period)
    if method:
        q = q.filter(m.Payment.method == method)
    return [payment_out(p) for p in q.order_by(m.Payment.id.desc())]


# ---------- 滞纳金 ----------
class LateFeeIn(BaseModel):
    period: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    daily_rate: float = Field(0.0005, ge=0, le=0.01)
    grace_days: int = Field(0, ge=0, le=60)


@router.post("/bills/apply-late-fee")
def apply_late_fee(body: LateFeeIn, _=Depends(require("bill:write")),
                   db: Session = Depends(get_db)):
    bills = db.query(m.Bill).filter(m.Bill.period == body.period).all()
    now = datetime.now()
    changed, total = 0, 0
    for b in bills:
        if not b.due_date:
            continue
        days = (now - b.due_date).days - body.grace_days
        if days <= 0:
            continue
        late = round(b.amount_cents * body.daily_rate * days)
        if late != b.late_fee_cents:
            b.late_fee_cents = late
            changed += 1
            total += late
    db.commit()
    return {"changed": changed, "late_fee_cents": total}


# ---------- 欠费提醒 ----------
class RemindIn(BaseModel):
    period: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")


@router.post("/bills/remind")
def remind_arrears(body: RemindIn, _=Depends(require("bill:write")),
                   db: Session = Depends(get_db)):
    bills = [b for b in db.query(m.Bill).filter(m.Bill.period == body.period).all()
             if b.paid_cents < b.amount_cents + b.late_fee_cents]
    total = sum(b.amount_cents + b.late_fee_cents - b.paid_cents for b in bills)
    if bills:
        now = datetime.now()
        a = m.Announcement(
            title=f"{body.period} 物业费催缴通知",
            content=(f"截至 {now:%Y-%m-%d}，本期共有 {len(bills)} 户未结清账单，"
                     f"欠费合计 {(total / 100):.2f} 元。请尽快通过微信、支付宝或物业前台缴纳。"),
            category="fee", status="published", published_at=now, pushed_at=now)
        db.add(a)
        db.commit()
    return {"count": len(bills), "balance_cents": total,
            "message": f"已生成催缴通知，覆盖 {len(bills)} 户"}


# ---------- 线上缴费 ----------
class OnlinePayIn(BaseModel):
    method: Literal["wechat", "alipay"]


@router.post("/bills/{bill_id}/online-pay")
def online_pay(bill_id: int, body: OnlinePayIn,
               user: m.User = Depends(require("bill:write")), db: Session = Depends(get_db)):
    b = db.get(m.Bill, bill_id)
    if not b:
        raise HTTPException(404, "账单不存在")
    balance = b.amount_cents + b.late_fee_cents - b.paid_cents
    if balance <= 0:
        raise HTTPException(400, "该账单已结清")
    b.paid_cents += balance
    db.add(m.Payment(bill_id=b.id, amount_cents=balance, method=body.method,
                     operator=f"线上-{user.real_name}",
                     receipt_no=f"R{datetime.now():%Y%m%d%H%M%S}{uuid4().hex[:4].upper()}"))
    db.commit()
    return bill_out(b)


# ---------- 对账 & 导出 ----------
@router.get("/bills/reconcile")
def reconcile(period: Optional[str] = None, _=Depends(require("bill:read")),
              db: Session = Depends(get_db)):
    q = db.query(m.Bill)
    if period:
        q = q.filter(m.Bill.period == period)
    bills = q.all()
    fee_map: dict[str, dict] = {}
    for b in bills:
        row = fee_map.setdefault(b.fee_type, {"fee_type": b.fee_type, "amount_cents": 0,
                                              "paid_cents": 0, "late_fee_cents": 0, "count": 0})
        row["amount_cents"] += b.amount_cents
        row["paid_cents"] += b.paid_cents
        row["late_fee_cents"] += b.late_fee_cents
        row["count"] += 1
    pq = db.query(m.Payment).join(m.Bill, m.Payment.bill_id == m.Bill.id)
    if period:
        pq = pq.filter(m.Bill.period == period)
    method_map: dict[str, dict] = {}
    for p in pq.all():
        row = method_map.setdefault(p.method, {"method": p.method, "amount_cents": 0, "count": 0})
        row["amount_cents"] += p.amount_cents
        row["count"] += 1
    return {
        "period": period or "all",
        "receivable_cents": sum(b.amount_cents + b.late_fee_cents for b in bills),
        "collected_cents": sum(b.paid_cents for b in bills),
        "arrears_cents": sum(b.amount_cents + b.late_fee_cents - b.paid_cents for b in bills),
        "bill_count": len(bills),
        "unpaid_count": sum(1 for b in bills if b.status != "paid"),
        "by_fee_type": sorted(fee_map.values(), key=lambda x: x["fee_type"]),
        "by_method": sorted(method_map.values(), key=lambda x: x["method"]),
    }


@router.get("/bills/export")
def export_bills(period: Optional[str] = None, _=Depends(require("bill:read")),
                 db: Session = Depends(get_db)):
    q = db.query(m.Bill)
    if period:
        q = q.filter(m.Bill.period == period)
    bills = q.order_by(m.Bill.period, m.Bill.room_id).all()
    rows = [[b.period, b.room.building.name, b.room.room_no, b.fee_type, b.amount_cents / 100,
             b.paid_cents / 100, b.late_fee_cents / 100,
             (b.amount_cents + b.late_fee_cents - b.paid_cents) / 100, b.status]
            for b in bills]
    return csv_response(
        f"bills_{period or 'all'}.csv",
        ["账期", "楼栋", "房号", "费用类型", "应收(元)", "已收(元)", "滞纳金(元)", "欠费(元)", "状态"],
        rows)


@router.get("/payments/export")
def export_payments(period: Optional[str] = None, _=Depends(require("bill:read")),
                    db: Session = Depends(get_db)):
    q = db.query(m.Payment).join(m.Bill, m.Payment.bill_id == m.Bill.id)
    if period:
        q = q.filter(m.Bill.period == period)
    rows = [[p.receipt_no, p.bill.period, p.bill.room.building.name, p.bill.room.room_no,
             p.bill.fee_type, p.amount_cents / 100, p.method, p.operator,
             p.paid_at.strftime("%Y-%m-%d %H:%M")] for p in q.order_by(m.Payment.id).all()]
    return csv_response(
        f"payments_{period or 'all'}.csv",
        ["票据号", "账期", "楼栋", "房号", "费用类型", "金额(元)", "方式", "经办人", "缴费时间"],
        rows)
