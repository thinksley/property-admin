from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models as m
from ..database import get_db
from ..security import require
from ..serializers import bill_out, csv_response, payment_out

router = APIRouter(prefix="/api", tags=["report"])


def current_period() -> str:
    return datetime.now().strftime("%Y-%m")


@router.get("/reports/overview")
def overview(period: Optional[str] = None, _=Depends(require("report:read")),
             db: Session = Depends(get_db)):
    period = period or current_period()
    bills = db.query(m.Bill).filter(m.Bill.period == period).all()
    today = datetime.now().date()
    return {
        "period": period,
        "rooms": db.query(m.Room).count(),
        "occupied": db.query(m.Room).filter(m.Room.status != "vacant").count(),
        "receivable_cents": sum(b.amount_cents + b.late_fee_cents for b in bills),
        "collected_cents": sum(b.paid_cents for b in bills),
        "arrears_cents": sum(b.amount_cents + b.late_fee_cents - b.paid_cents for b in bills),
        "arrears_count": sum(1 for b in bills if b.status != "paid"),
        "open_repairs": db.query(m.RepairOrder).filter(
            m.RepairOrder.status.in_(["pending", "assigned", "processing"])).count(),
        "open_complaints": db.query(m.Complaint).filter(
            m.Complaint.status.in_(["pending", "processing"])).count(),
        "visitors_today": db.query(m.Visitor).filter(
            m.Visitor.visit_at >= datetime.combine(today, datetime.min.time())).count(),
        "low_stock": sum(1 for x in db.query(m.Material).all() if x.stock <= x.warning_stock),
        "facility_alerts": db.query(m.Facility).filter(
            m.Facility.status != "normal").count(),
        "inspections_today": db.query(m.InspectionRecord).filter(
            m.InspectionRecord.created_at >= datetime.combine(today, datetime.min.time())).count(),
    }


@router.get("/reports/revenue")
def revenue(period: Optional[str] = None, _=Depends(require("report:read")),
            db: Session = Depends(get_db)):
    period = period or current_period()
    bills = db.query(m.Bill).filter(m.Bill.period == period).all()
    fee_map: dict[str, dict] = {}
    for b in bills:
        row = fee_map.setdefault(b.fee_type, {"fee_type": b.fee_type, "name": None, "count": 0,
                                              "amount_cents": 0, "paid_cents": 0,
                                              "late_fee_cents": 0})
        if b.fee_item:
            row["name"] = b.fee_item.name
        row["count"] += 1
        row["amount_cents"] += b.amount_cents
        row["paid_cents"] += b.paid_cents
        row["late_fee_cents"] += b.late_fee_cents
    payments = db.query(m.Payment).join(m.Bill, m.Payment.bill_id == m.Bill.id).filter(
        m.Bill.period == period).all()
    method_map: dict[str, dict] = {}
    for p in payments:
        row = method_map.setdefault(p.method, {"method": p.method, "count": 0, "amount_cents": 0})
        row["count"] += 1
        row["amount_cents"] += p.amount_cents
    return {
        "period": period,
        "receivable_cents": sum(b.amount_cents + b.late_fee_cents for b in bills),
        "collected_cents": sum(b.paid_cents for b in bills),
        "by_fee_type": sorted(fee_map.values(), key=lambda x: x["fee_type"]),
        "by_method": sorted(method_map.values(), key=lambda x: x["method"]),
    }


@router.get("/reports/arrears")
def arrears(period: Optional[str] = None, _=Depends(require("report:read")),
            db: Session = Depends(get_db)):
    q = db.query(m.Bill)
    if period:
        q = q.filter(m.Bill.period == period)
    rows = []
    for b in q.order_by(m.Bill.period, m.Bill.room_id).all():
        if b.paid_cents >= b.amount_cents + b.late_fee_cents:
            continue
        out = bill_out(b)
        out["owners"] = [o.name for o in b.room.owners]
        rows.append(out)
    return rows


@router.get("/reports/ledger")
def ledger(start: Optional[str] = None, end: Optional[str] = None,
           _=Depends(require("report:read")), db: Session = Depends(get_db)):
    q = db.query(m.Payment)
    if start:
        q = q.filter(m.Payment.paid_at >= datetime.strptime(start, "%Y-%m-%d"))
    if end:
        q = q.filter(m.Payment.paid_at <= datetime.strptime(end + " 23:59", "%Y-%m-%d %H:%M"))
    return [payment_out(p) for p in q.order_by(m.Payment.id.desc()).limit(1000)]


@router.get("/reports/income-expense")
def income_expense(period: Optional[str] = None, _=Depends(require("report:read")),
                   db: Session = Depends(get_db)):
    period = period or current_period()
    year, month = map(int, period.split("-"))
    start = datetime(year, month, 1)
    end = datetime(year + (month == 12), month % 12 + 1, 1)
    payments = db.query(m.Payment).filter(m.Payment.paid_at >= start,
                                          m.Payment.paid_at < end).all()
    stock_in = db.query(m.StockRecord).filter(
        m.StockRecord.record_type == "in", m.StockRecord.created_at >= start,
        m.StockRecord.created_at < end).all()
    income = sum(p.amount_cents for p in payments)
    expense = sum(x.amount_cents for x in stock_in)
    return {"period": period, "income_cents": income, "expense_cents": expense,
            "net_cents": income - expense, "payment_count": len(payments),
            "purchase_count": len(stock_in)}


@router.get("/reports/arrears/export")
def export_arrears(period: Optional[str] = None, _=Depends(require("report:read")),
                   db: Session = Depends(get_db)):
    q = db.query(m.Bill)
    if period:
        q = q.filter(m.Bill.period == period)
    rows = []
    for b in q.order_by(m.Bill.period, m.Bill.room_id).all():
        balance = b.amount_cents + b.late_fee_cents - b.paid_cents
        if balance <= 0:
            continue
        rows.append([b.period, b.room.building.name, b.room.room_no,
                     "、".join(o.name for o in b.room.owners), b.fee_type,
                     b.amount_cents / 100, b.paid_cents / 100, b.late_fee_cents / 100,
                     balance / 100])
    return csv_response(
        f"arrears_{period or 'all'}.csv",
        ["账期", "楼栋", "房号", "业主", "费用类型", "应收(元)", "已收(元)", "滞纳金(元)", "欠费(元)"],
        rows)


@router.get("/reports/ledger/export")
def export_ledger(start: Optional[str] = None, end: Optional[str] = None,
                  _=Depends(require("report:read")), db: Session = Depends(get_db)):
    q = db.query(m.Payment)
    if start:
        q = q.filter(m.Payment.paid_at >= datetime.strptime(start, "%Y-%m-%d"))
    if end:
        q = q.filter(m.Payment.paid_at <= datetime.strptime(end + " 23:59", "%Y-%m-%d %H:%M"))
    rows = [[p.receipt_no, p.paid_at.strftime("%Y-%m-%d %H:%M"), p.bill.period,
             p.bill.room.building.name, p.bill.room.room_no, p.bill.fee_type,
             p.amount_cents / 100, p.method, p.operator] for p in q.order_by(m.Payment.id).all()]
    return csv_response(
        "ledger.csv",
        ["票据号", "缴费时间", "账期", "楼栋", "房号", "费用类型", "金额(元)", "方式", "经办人"],
        rows)
