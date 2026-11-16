"""初始化示例数据：python seed.py（可重复执行，只补缺失数据）"""
from datetime import datetime, timedelta
from uuid import uuid4

from app.database import Base, SessionLocal, engine
from app.models import (Announcement, Building, Community, Complaint, Facility, FamilyMember,
                        FeeItem, InspectionPoint, Material, Owner, ParkingSpace, Room, Unit,
                        User, Visitor)
from app.schema import ensure_columns
from app.security import hash_password


def main():
    Base.metadata.create_all(engine)
    ensure_columns()
    db = SessionLocal()
    try:
        for username, name, role in [("admin", "系统管理员", "admin"), ("manager", "物业经理", "manager"),
                                     ("cashier", "收费员", "cashier"), ("repair01", "张师傅", "repairman"),
                                     ("finance", "财务小李", "finance")]:
            if not db.query(User).filter_by(username=username).first():
                db.add(User(username=username, password_hash=hash_password("123456"),
                            real_name=name, role=role))
        db.commit()

        if not db.query(Building).count():
            b1, b2 = Building(name="1号楼", floors=18), Building(name="2号楼", floors=18)
            db.add_all([b1, b2])
            db.flush()
            rooms = []
            for b in (b1, b2):
                for floor in range(1, 4):
                    for n in (1, 2):
                        rooms.append(Room(building=b, room_no=f"{floor}0{n}", area=89.5 if n == 1 else 120.0,
                                          status="owner_occupied" if n == 1 else "rented",
                                          fee_per_sqm_cents=230))
            db.add_all(rooms)
            db.flush()
            db.add(Owner(name="王敏", phone="13800000001", id_card_masked="310***********1234", room=rooms[0]))
            db.add(Owner(name="李强", phone="13800000002", is_tenant=True, room=rooms[1]))
            db.commit()

        if not db.query(Community).count():
            db.add(Community(name="春江花园", address="上海市浦东新区春江路 88 号",
                             contact_name="客服中心", contact_phone="021-88886666"))
            db.commit()

        buildings = db.query(Building).order_by(Building.id).all()
        if not db.query(Unit).count():
            for b in buildings:
                db.add_all([Unit(building_id=b.id, name="1单元"), Unit(building_id=b.id, name="2单元")])
            db.commit()
            for b in buildings:
                units = db.query(Unit).filter_by(building_id=b.id).order_by(Unit.id).all()
                for i, room in enumerate(db.query(Room).filter_by(building_id=b.id).order_by(Room.id)):
                    room.unit_id = units[i % len(units)].id
            db.commit()

        if not db.query(FeeItem).count():
            db.add_all([
                FeeItem(name="物业费", code="property", calc_type="area", unit_price_cents=230),
                FeeItem(name="公摊水电", code="public_utility", calc_type="fixed", unit_price_cents=3000),
                FeeItem(name="停车费", code="parking", calc_type="fixed", unit_price_cents=15000),
                FeeItem(name="垃圾清运费", code="garbage", calc_type="fixed", unit_price_cents=500),
                FeeItem(name="装修押金", code="decoration_deposit", calc_type="fixed", unit_price_cents=200000),
            ])
            db.commit()

        if not db.query(FamilyMember).count():
            owners = db.query(Owner).order_by(Owner.id).all()
            if owners:
                db.add_all([FamilyMember(owner_id=owners[0].id, name="陈芳", relation="配偶", phone="13900000001"),
                            FamilyMember(owner_id=owners[0].id, name="王小明", relation="子女")])
                if len(owners) > 1:
                    db.add(FamilyMember(owner_id=owners[1].id, name="李小雨", relation="子女"))
                db.commit()

        if not db.query(ParkingSpace).count():
            spaces = []
            for i in range(1, 11):
                spaces.append(ParkingSpace(code=f"A-{i:03d}", building_id=buildings[0].id if buildings else None,
                                           space_type="fixed", status="free", monthly_fee_cents=30000))
            for i in range(1, 6):
                spaces.append(ParkingSpace(code=f"B-{i:03d}", building_id=buildings[-1].id if buildings else None,
                                           space_type="temp"))
            spaces[0].status = "rented"
            spaces[0].plate_no = "沪A12345"
            spaces[0].owner_name = "王敏"
            spaces[0].expire_date = datetime.now() + timedelta(days=300)
            spaces[1].status = "sold"
            spaces[1].plate_no = "沪B67890"
            spaces[1].owner_name = "李强"
            db.add_all(spaces)
            db.commit()

        if not db.query(Material).count():
            db.add_all([
                Material(name="LED 灯泡", category="水电材料", unit="个", stock=60, warning_stock=20),
                Material(name="水龙头", category="水电材料", unit="个", stock=18, warning_stock=10),
                Material(name="电线 2.5㎡", category="水电材料", unit="米", stock=300, warning_stock=100),
                Material(name="消毒液", category="保洁用品", unit="瓶", stock=8, warning_stock=10),
            ])
            db.commit()

        if not db.query(Facility).count():
            db.add_all([
                Facility(name="1号楼电梯", category="电梯", location="1号楼", status="normal",
                         next_maintenance_at=datetime.now() + timedelta(days=20)),
                Facility(name="2号楼电梯", category="电梯", location="2号楼", status="normal",
                         next_maintenance_at=datetime.now() + timedelta(days=45)),
                Facility(name="消防水泵", category="水泵", location="地下车库", status="normal",
                         next_maintenance_at=datetime.now() + timedelta(days=10)),
                Facility(name="配电房", category="配电", location="1号楼负一层", status="repairing",
                         next_maintenance_at=datetime.now()),
            ])
            db.commit()

        if not db.query(InspectionPoint).count():
            db.add_all([
                InspectionPoint(name="地下车库入口", location="B1 车库", qr_code="QR-GARAGE-01"),
                InspectionPoint(name="1号楼大堂", location="1号楼 1F", qr_code="QR-LOBBY-01"),
                InspectionPoint(name="消防通道", location="2号楼东侧", qr_code="QR-FIRE-02"),
                InspectionPoint(name="配电房", location="1号楼负一层", qr_code="QR-POWER-01"),
            ])
            db.commit()

        if not db.query(Announcement).count():
            now = datetime.now()
            db.add_all([
                Announcement(title="关于 11 月 20 日计划停水的通知",
                             content="因市政管网维护，11 月 20 日 09:00-17:00 将暂停供水，请提前储水。",
                             category="water", status="published", published_at=now, pushed_at=now),
                Announcement(title="冬季消防安全提示",
                             content="请勿在楼道堆放杂物，电动车请勿入户充电，感谢配合。",
                             category="notice", status="published", published_at=now),
            ])
            db.commit()

        if not db.query(Visitor).count():
            rooms = db.query(Room).order_by(Room.id).all()
            if rooms:
                db.add(Visitor(name="张先生", phone="13900001111", room_id=rooms[0].id,
                               host_name="王敏", purpose="探亲", visit_at=datetime.now(),
                               status="approved", pass_code=uuid4().hex[:6].upper()))
                db.commit()

        if not db.query(Complaint).count():
            rooms = db.query(Room).order_by(Room.id).all()
            db.add(Complaint(room_id=rooms[1].id if len(rooms) > 1 else None,
                             owner_name="李强", phone="13800000002", category="噪音",
                             content="楼上夜间装修噪音较大，希望物业协调。"))
            db.commit()

        print("初始化完成。账号：admin / manager / cashier / repair01 / finance，密码均为 123456")
    finally:
        db.close()


if __name__ == "__main__":
    main()
