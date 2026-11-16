from datetime import datetime
from typing import Optional
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True)
    password_hash: Mapped[str] = mapped_column(String(100))
    real_name: Mapped[str] = mapped_column(String(50))
    role: Mapped[str] = mapped_column(String(20))  # admin / manager / cashier / repairman
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class Community(Base):
    """小区信息（单条记录）"""
    __tablename__ = "communities"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    address: Mapped[Optional[str]] = mapped_column(String(200), default=None)
    contact_name: Mapped[Optional[str]] = mapped_column(String(50), default=None)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(20), default=None)


class Building(Base):
    __tablename__ = "buildings"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50))
    floors: Mapped[int] = mapped_column(Integer, default=1)


class Unit(Base):
    """楼栋下的单元"""
    __tablename__ = "units"
    __table_args__ = (UniqueConstraint("building_id", "name"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.id"))
    name: Mapped[str] = mapped_column(String(50))
    building: Mapped[Building] = relationship()


class Room(Base):
    __tablename__ = "rooms"
    __table_args__ = (UniqueConstraint("building_id", "room_no"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    building_id: Mapped[int] = mapped_column(ForeignKey("buildings.id"))
    unit_id: Mapped[Optional[int]] = mapped_column(ForeignKey("units.id"), default=None)
    room_no: Mapped[str] = mapped_column(String(20))
    area: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String(20), default="vacant")  # owner_occupied / rented / vacant
    handover_status: Mapped[str] = mapped_column(String(20), default="received")  # received / pending
    fee_per_sqm_cents: Mapped[int] = mapped_column(Integer, default=200)  # 物业费单价：分/㎡/月
    building: Mapped[Building] = relationship()
    unit: Mapped[Optional[Unit]] = relationship()
    owners: Mapped[list["Owner"]] = relationship(back_populates="room")


class Owner(Base):
    __tablename__ = "owners"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50))
    phone: Mapped[str] = mapped_column(String(20), index=True)
    id_card_masked: Mapped[Optional[str]] = mapped_column(String(30), default=None)
    is_tenant: Mapped[bool] = mapped_column(Boolean, default=False)
    room_id: Mapped[Optional[int]] = mapped_column(ForeignKey("rooms.id"), default=None)
    room: Mapped[Optional[Room]] = relationship(back_populates="owners")
    family: Mapped[list["FamilyMember"]] = relationship(back_populates="owner",
                                                        cascade="all, delete-orphan")


class FamilyMember(Base):
    """业主家庭成员 / 同住人"""
    __tablename__ = "family_members"
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("owners.id"))
    name: Mapped[str] = mapped_column(String(50))
    relation: Mapped[str] = mapped_column(String(20), default="家属")
    phone: Mapped[Optional[str]] = mapped_column(String(20), default=None)
    owner: Mapped[Owner] = relationship(back_populates="family")


class FeeItem(Base):
    """收费项目：按面积计价或按户固定金额"""
    __tablename__ = "fee_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50))
    code: Mapped[str] = mapped_column(String(20), unique=True)
    calc_type: Mapped[str] = mapped_column(String(10), default="area")  # area / fixed
    unit_price_cents: Mapped[int] = mapped_column(Integer, default=0)  # 分/㎡ 或 分/户
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class Bill(Base):
    __tablename__ = "bills"
    __table_args__ = (UniqueConstraint("room_id", "period", "fee_type"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"))
    fee_item_id: Mapped[Optional[int]] = mapped_column(ForeignKey("fee_items.id"), default=None)
    period: Mapped[str] = mapped_column(String(7), index=True)  # 2026-11
    fee_type: Mapped[str] = mapped_column(String(20))  # property / parking / water / electric / garbage
    amount_cents: Mapped[int] = mapped_column(Integer)  # 金额统一用整数分，避免浮点误差
    paid_cents: Mapped[int] = mapped_column(Integer, default=0)
    late_fee_cents: Mapped[int] = mapped_column(Integer, default=0)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime, default=None)
    room: Mapped[Room] = relationship()
    fee_item: Mapped[Optional[FeeItem]] = relationship()

    @property
    def status(self) -> str:
        if self.paid_cents >= self.amount_cents + self.late_fee_cents:
            return "paid"
        return "partial" if self.paid_cents > 0 else "unpaid"


class Payment(Base):
    __tablename__ = "payments"
    id: Mapped[int] = mapped_column(primary_key=True)
    bill_id: Mapped[int] = mapped_column(ForeignKey("bills.id"))
    amount_cents: Mapped[int] = mapped_column(Integer)
    method: Mapped[str] = mapped_column(String(20))  # cash / wechat / alipay / bank
    operator: Mapped[str] = mapped_column(String(50))
    receipt_no: Mapped[Optional[str]] = mapped_column(String(40), default=None)
    paid_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    bill: Mapped[Bill] = relationship()


class RepairOrder(Base):
    __tablename__ = "repair_orders"
    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"))
    category: Mapped[str] = mapped_column(String(20))
    description: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    assignee: Mapped[Optional[str]] = mapped_column(String(50), default=None)
    rating: Mapped[Optional[int]] = mapped_column(Integer, default=None)
    comment: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)
    room: Mapped[Room] = relationship()


class Visitor(Base):
    """访客预约与临时通行码"""
    __tablename__ = "visitors"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50))
    phone: Mapped[str] = mapped_column(String(20))
    room_id: Mapped[Optional[int]] = mapped_column(ForeignKey("rooms.id"), default=None)
    host_name: Mapped[Optional[str]] = mapped_column(String(50), default=None)
    purpose: Mapped[Optional[str]] = mapped_column(String(100), default=None)
    visit_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending/approved/checked_in/checked_out/rejected
    pass_code: Mapped[str] = mapped_column(String(10), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    room: Mapped[Optional[Room]] = relationship()


class ParkingSpace(Base):
    """车位档案"""
    __tablename__ = "parking_spaces"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True)
    building_id: Mapped[Optional[int]] = mapped_column(ForeignKey("buildings.id"), default=None)
    space_type: Mapped[str] = mapped_column(String(10), default="fixed")  # fixed / temp
    status: Mapped[str] = mapped_column(String(10), default="free")  # free / rented / sold
    plate_no: Mapped[Optional[str]] = mapped_column(String(20), default=None)
    owner_name: Mapped[Optional[str]] = mapped_column(String(50), default=None)
    monthly_fee_cents: Mapped[int] = mapped_column(Integer, default=0)
    expire_date: Mapped[Optional[datetime]] = mapped_column(DateTime, default=None)
    building: Mapped[Optional[Building]] = relationship()


class ParkingRecord(Base):
    """车辆出入场记录"""
    __tablename__ = "parking_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    plate_no: Mapped[str] = mapped_column(String(20), index=True)
    parking_space_id: Mapped[Optional[int]] = mapped_column(ForeignKey("parking_spaces.id"), default=None)
    billing_type: Mapped[str] = mapped_column(String(10), default="temp")  # temp / monthly
    entry_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    exit_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=None)
    amount_cents: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(10), default="in")  # in / out
    parking_space: Mapped[Optional[ParkingSpace]] = relationship()


class Complaint(Base):
    """投诉建议"""
    __tablename__ = "complaints"
    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[Optional[int]] = mapped_column(ForeignKey("rooms.id"), default=None)
    owner_name: Mapped[str] = mapped_column(String(50))
    phone: Mapped[Optional[str]] = mapped_column(String(20), default=None)
    category: Mapped[str] = mapped_column(String(20), default="其他")
    content: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending/processing/resolved/closed
    handler: Mapped[Optional[str]] = mapped_column(String(50), default=None)
    reply: Mapped[Optional[str]] = mapped_column(Text, default=None)
    follow_up: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now, onupdate=datetime.now)
    room: Mapped[Optional[Room]] = relationship()


class Announcement(Base):
    """通知公告与催缴通知"""
    __tablename__ = "announcements"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(100))
    content: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(20), default="notice")  # notice/water/electric/fee/other
    status: Mapped[str] = mapped_column(String(20), default="draft")  # draft/published
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=None)
    pushed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)


class Material(Base):
    """物料库存"""
    __tablename__ = "materials"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    category: Mapped[str] = mapped_column(String(30), default="其他")
    unit: Mapped[str] = mapped_column(String(10), default="件")
    stock: Mapped[int] = mapped_column(Integer, default=0)
    warning_stock: Mapped[int] = mapped_column(Integer, default=0)


class StockRecord(Base):
    """物料出入库流水"""
    __tablename__ = "stock_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    material_id: Mapped[int] = mapped_column(ForeignKey("materials.id"))
    record_type: Mapped[str] = mapped_column(String(10))  # in / out
    quantity: Mapped[int] = mapped_column(Integer)
    amount_cents: Mapped[int] = mapped_column(Integer, default=0)
    operator: Mapped[str] = mapped_column(String(50), default="")
    note: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    material: Mapped[Material] = relationship()


class Facility(Base):
    """公共设施设备"""
    __tablename__ = "facilities"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    category: Mapped[str] = mapped_column(String(30), default="其他")
    location: Mapped[Optional[str]] = mapped_column(String(100), default=None)
    status: Mapped[str] = mapped_column(String(20), default="normal")  # normal/repairing/stopped
    last_maintenance_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=None)
    next_maintenance_at: Mapped[Optional[datetime]] = mapped_column(DateTime, default=None)


class MaintenanceRecord(Base):
    """设施保养记录"""
    __tablename__ = "maintenance_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    facility_id: Mapped[int] = mapped_column(ForeignKey("facilities.id"))
    content: Mapped[str] = mapped_column(String(255))
    operator: Mapped[str] = mapped_column(String(50), default="")
    maintained_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    facility: Mapped[Facility] = relationship()


class InspectionPoint(Base):
    """巡检点位"""
    __tablename__ = "inspection_points"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    location: Mapped[Optional[str]] = mapped_column(String(100), default=None)
    qr_code: Mapped[str] = mapped_column(String(50), unique=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class InspectionRecord(Base):
    """巡检打卡记录"""
    __tablename__ = "inspection_records"
    id: Mapped[int] = mapped_column(primary_key=True)
    point_id: Mapped[int] = mapped_column(ForeignKey("inspection_points.id"))
    inspector: Mapped[str] = mapped_column(String(50))
    result: Mapped[str] = mapped_column(String(10), default="normal")  # normal / abnormal
    note: Mapped[Optional[str]] = mapped_column(String(255), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
    point: Mapped[InspectionPoint] = relationship()


class OperationLog(Base):
    """操作日志"""
    __tablename__ = "operation_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), index=True)
    method: Mapped[str] = mapped_column(String(10))
    path: Mapped[str] = mapped_column(String(200))
    status_code: Mapped[int] = mapped_column(Integer, default=0)
    ip: Mapped[Optional[str]] = mapped_column(String(50), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now)
