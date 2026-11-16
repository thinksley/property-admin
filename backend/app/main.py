import calendar
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Literal, Optional
from uuid import uuid4

import jwt
from fastapi import APIRouter, Body, Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session
from . import models as m
from .database import SECRET_KEY, Base, SessionLocal, engine, get_db
from .routers import archive, asset, fee, parking, report, service, system
from .schema import ensure_columns
from .security import ALGO, current_user, has_perm, make_token, require, verify_password
from .serializers import bill_out, owner_out, repair_out, room_out


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    ensure_columns()
    yield


app = FastAPI(title="物业管理系统 API", version="0.2.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"],
                   allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def operation_log(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if request.method in ("POST", "PUT", "PATCH", "DELETE") and path.startswith("/api") \
            and not path.endswith("/auth/login"):
        try:
            username = "anonymous"
            auth = request.headers.get("authorization", "")
            if auth.startswith("Bearer "):
                payload = jwt.decode(auth[7:], SECRET_KEY, algorithms=[ALGO])
                db = SessionLocal()
                try:
                    u = db.get(m.User, int(payload["sub"]))
                    username = u.username if u else "unknown"
                    db.add(m.OperationLog(
                        username=username, method=request.method, path=path,
                        status_code=response.status_code,
                        ip=request.client.host if request.client else None))
                    db.commit()
                finally:
                    db.close()
        except Exception:
            pass
    return response


api = APIRouter(prefix="/api")

# ---------- 请求体 ----------
ROOM_STATUS = Literal["owner_occupied", "rented", "vacant"]


class BuildingIn(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    floors: int = Field(1, ge=1, le=200)


class RoomIn(BaseModel):
    building_id: int
    unit_id: Optional[int] = None
    room_no: str = Field(min_length=1, max_length=20)
    area: float = Field(gt=0)
    status: ROOM_STATUS = "vacant"
    handover_status: Literal["received", "pending"] = "received"
    fee_per_sqm_cents: int = Field(200, ge=0)


class OwnerIn(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    phone: str = Field(min_length=6, max_length=20)
    id_card_masked: Optional[str] = None
    is_tenant: bool = False
    room_id: Optional[int] = None


class BillGenerateIn(BaseModel):
    period: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")
    fee_type: Literal["property", "parking", "water", "electric", "garbage"] = "property"
    fee_item_id: Optional[int] = None
    fixed_amount_cents: Optional[int] = Field(None, gt=0)


class PaymentIn(BaseModel):
    amount_cents: int = Field(gt=0)
    method: Literal["cash", "wechat", "alipay", "bank"]


class RepairIn(BaseModel):
    room_id: int
    category: str = Field(min_length=1, max_length=20)
    description: str = Field(min_length=2)


class RepairStatusIn(BaseModel):
    status: Literal["assigned", "processing", "done", "closed"]
    assignee: Optional[str] = None


# ---------- 序列化（见 serializers.py） ----------


# ---------- 认证 ----------
@api.post("/auth/login")
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(m.User).filter_by(username=form.username).first()
    if not user or not user.is_active or not verify_password(form.password, user.password_hash):
        raise HTTPException(401, "用户名或密码错误")
    return {"access_token": make_token(user), "token_type": "bearer"}


@api.get("/auth/me")
def me(user: m.User = Depends(current_user)):
    return {"id": user.id, "username": user.username, "real_name": user.real_name, "role": user.role}


# ---------- 房屋 & 业主 ----------
@api.get("/buildings")
def list_buildings(_=Depends(require("house:read")), db: Session = Depends(get_db)):
    return [{"id": b.id, "name": b.name, "floors": b.floors}
            for b in db.query(m.Building).order_by(m.Building.id)]


@api.post("/buildings", status_code=201)
def create_building(body: BuildingIn, _=Depends(require("house:write")), db: Session = Depends(get_db)):
    b = m.Building(**body.model_dump())
    db.add(b)
    db.commit()
    return {"id": b.id, "name": b.name, "floors": b.floors}


@api.get("/rooms")
def list_rooms(building_id: Optional[int] = None, status: Optional[str] = None,
               _=Depends(require("house:read")), db: Session = Depends(get_db)):
    q = db.query(m.Room)
    if building_id:
        q = q.filter(m.Room.building_id == building_id)
    if status:
        q = q.filter(m.Room.status == status)
    return [room_out(r) for r in q.order_by(m.Room.building_id, m.Room.room_no)]


@api.post("/rooms", status_code=201)
def create_room(body: RoomIn, _=Depends(require("house:write")), db: Session = Depends(get_db)):
    if not db.get(m.Building, body.building_id):
        raise HTTPException(404, "楼栋不存在")
    if body.unit_id:
        unit = db.get(m.Unit, body.unit_id)
        if not unit:
            raise HTTPException(404, "单元不存在")
        if unit.building_id != body.building_id:
            raise HTTPException(400, "单元不属于所选楼栋")
    if db.query(m.Room).filter_by(building_id=body.building_id, room_no=body.room_no).first():
        raise HTTPException(409, "该楼栋已存在相同房号")
    room = m.Room(**body.model_dump())
    db.add(room)
    db.commit()
    return room_out(room)


@api.patch("/rooms/{room_id}/status")
def set_room_status(room_id: int, status: ROOM_STATUS = Body(embed=True),
                    _=Depends(require("house:write")), db: Session = Depends(get_db)):
    room = db.get(m.Room, room_id)
    if not room:
        raise HTTPException(404, "房屋不存在")
    room.status = status
    db.commit()
    return room_out(room)


@api.get("/owners")
def list_owners(keyword: Optional[str] = None, _=Depends(require("house:read")),
                db: Session = Depends(get_db)):
    q = db.query(m.Owner)
    if keyword:
        q = q.filter(or_(m.Owner.name.contains(keyword), m.Owner.phone.contains(keyword)))
    return [owner_out(o) for o in q.order_by(m.Owner.id)]


@api.post("/owners", status_code=201)
def create_owner(body: OwnerIn, _=Depends(require("house:write")), db: Session = Depends(get_db)):
    if body.room_id and not db.get(m.Room, body.room_id):
        raise HTTPException(404, "房屋不存在")
    o = m.Owner(**body.model_dump())
    db.add(o)
    db.commit()
    return owner_out(o)


# ---------- 账单 & 收款 ----------
@api.post("/bills/generate")
def generate_bills(body: BillGenerateIn, _=Depends(require("bill:write")), db: Session = Depends(get_db)):
    fee_item = None
    fee_type = body.fee_type
    if body.fee_item_id:
        fee_item = db.get(m.FeeItem, body.fee_item_id)
        if not fee_item:
            raise HTTPException(404, "收费项目不存在")
        if not fee_item.enabled:
            raise HTTPException(400, "收费项目已停用")
        fee_type = fee_item.code
    elif body.fee_type != "property" and not body.fixed_amount_cents:
        raise HTTPException(400, "非物业费账单需要填写固定金额")
    done = {rid for (rid,) in db.query(m.Bill.room_id).filter(
        m.Bill.period == body.period, m.Bill.fee_type == fee_type)}
    year, month = map(int, body.period.split("-"))
    due_date = datetime(year, month, calendar.monthrange(year, month)[1], 23, 59)
    created = 0
    for room in db.query(m.Room).all():
        if room.id in done:
            continue
        # 按面积项目 = 面积 × 单价（分）；固定项目 / 其他费用使用固定金额
        if fee_item:
            amount = (round(room.area * fee_item.unit_price_cents)
                      if fee_item.calc_type == "area" else fee_item.unit_price_cents)
        else:
            amount = (round(room.area * room.fee_per_sqm_cents) if body.fee_type == "property"
                      else body.fixed_amount_cents)
        db.add(m.Bill(room_id=room.id, period=body.period, fee_type=fee_type,
                      fee_item_id=body.fee_item_id, amount_cents=amount, due_date=due_date))
        created += 1
    db.commit()
    return {"created": created, "skipped": len(done)}


@api.get("/bills")
def list_bills(period: Optional[str] = None,
               status: Optional[Literal["unpaid", "partial", "paid"]] = None,
               _=Depends(require("bill:read")), db: Session = Depends(get_db)):
    q = db.query(m.Bill)
    if period:
        q = q.filter(m.Bill.period == period)
    bills = q.order_by(m.Bill.room_id).all()
    if status:
        bills = [b for b in bills if b.status == status]
    return [bill_out(b) for b in bills]


@api.post("/bills/{bill_id}/payments", status_code=201)
def pay_bill(bill_id: int, body: PaymentIn, user: m.User = Depends(require("bill:write")),
             db: Session = Depends(get_db)):
    bill = db.get(m.Bill, bill_id)
    if not bill:
        raise HTTPException(404, "账单不存在")
    balance = bill.amount_cents + bill.late_fee_cents - bill.paid_cents
    if body.amount_cents > balance:
        raise HTTPException(400, f"收款金额超过欠费余额 {balance / 100:.2f} 元")
    bill.paid_cents += body.amount_cents
    db.add(m.Payment(bill_id=bill.id, amount_cents=body.amount_cents,
                     method=body.method, operator=user.real_name,
                     receipt_no=f"R{datetime.now():%Y%m%d%H%M%S}{uuid4().hex[:4].upper()}"))
    db.commit()
    return bill_out(bill)


# ---------- 报修工单 ----------
# 状态流转表：当前状态 -> 允许去往的状态
FLOW = {"pending": {"assigned"}, "assigned": {"processing", "closed"},
        "processing": {"done"}, "done": {"closed"}}


@api.get("/repairs")
def list_repairs(user: m.User = Depends(require("repair:read")), db: Session = Depends(get_db)):
    q = db.query(m.RepairOrder)
    if user.role == "repairman":  # 维修师傅只看派给自己的工单
        q = q.filter(m.RepairOrder.assignee == user.real_name)
    return [repair_out(r) for r in q.order_by(m.RepairOrder.id.desc())]


@api.post("/repairs", status_code=201)
def create_repair(body: RepairIn, _=Depends(require("repair:write")), db: Session = Depends(get_db)):
    if not db.get(m.Room, body.room_id):
        raise HTTPException(404, "房屋不存在")
    r = m.RepairOrder(room_id=body.room_id, category=body.category, description=body.description)
    db.add(r)
    db.commit()
    return repair_out(r)


@api.post("/repairs/{repair_id}/status")
def update_repair(repair_id: int, body: RepairStatusIn, user: m.User = Depends(require("repair:read")),
                  db: Session = Depends(get_db)):
    r = db.get(m.RepairOrder, repair_id)
    if not r:
        raise HTTPException(404, "工单不存在")
    if body.status not in FLOW.get(r.status, set()):
        raise HTTPException(400, f"工单当前为「{r.status}」，不能直接变更为「{body.status}」")
    need = "repair:write" if body.status in ("assigned", "closed") else "repair:handle"
    if not (has_perm(user.role, need) or has_perm(user.role, "repair:write")):
        raise HTTPException(403, "没有权限执行此操作")
    if user.role == "repairman" and r.assignee != user.real_name:
        raise HTTPException(403, "该工单不是派给你的")
    if body.status == "assigned":
        if not body.assignee:
            raise HTTPException(400, "派单需要指定维修人员")
        r.assignee = body.assignee
    r.status = body.status
    db.commit()
    return repair_out(r)


# ---------- 总览 ----------
@api.get("/dashboard/summary")
def summary(_=Depends(require("dashboard:read")), db: Session = Depends(get_db)):
    period = datetime.now().strftime("%Y-%m")
    bills = db.query(m.Bill).filter(m.Bill.period == period).all()
    return {
        "rooms": db.query(m.Room).count(),
        "occupied": db.query(m.Room).filter(m.Room.status != "vacant").count(),
        "period": period,
        "receivable_cents": sum(b.amount_cents for b in bills),
        "collected_cents": sum(b.paid_cents for b in bills),
        "arrears_count": sum(1 for b in bills if b.status != "paid"),
        "open_repairs": db.query(m.RepairOrder).filter(
            m.RepairOrder.status.in_(["pending", "assigned", "processing"])).count(),
    }


app.include_router(api)
for r in (archive.router, fee.router, parking.router, service.router,
          asset.router, system.router, report.router):
    app.include_router(r)
