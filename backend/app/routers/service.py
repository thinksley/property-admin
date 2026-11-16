from datetime import datetime
from typing import Literal, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import models as m
from ..database import get_db
from ..security import current_user, require
from ..serializers import announcement_out, complaint_out, repair_out, visitor_out

router = APIRouter(prefix="/api", tags=["service"])


# ---------- 访客 & 门禁 ----------
class VisitorIn(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    phone: str = Field(min_length=6, max_length=20)
    room_id: Optional[int] = None
    host_name: Optional[str] = Field(None, max_length=50)
    purpose: Optional[str] = Field(None, max_length=100)
    visit_at: Optional[datetime] = None


class VisitorStatusIn(BaseModel):
    status: Literal["approved", "rejected", "checked_in", "checked_out"]


@router.get("/visitors")
def list_visitors(status: Optional[str] = None, keyword: Optional[str] = None,
                  _=Depends(require("visitor:read")), db: Session = Depends(get_db)):
    q = db.query(m.Visitor)
    if status:
        q = q.filter(m.Visitor.status == status)
    if keyword:
        q = q.filter(m.Visitor.name.contains(keyword) | m.Visitor.phone.contains(keyword))
    return [visitor_out(v) for v in q.order_by(m.Visitor.id.desc())]


@router.post("/visitors", status_code=201)
def create_visitor(body: VisitorIn, _=Depends(require("visitor:write")),
                   db: Session = Depends(get_db)):
    if body.room_id and not db.get(m.Room, body.room_id):
        raise HTTPException(404, "房屋不存在")
    v = m.Visitor(**body.model_dump(exclude={"visit_at"}),
                  visit_at=body.visit_at or datetime.now(),
                  pass_code=uuid4().hex[:6].upper())
    db.add(v)
    db.commit()
    return visitor_out(v)


@router.post("/visitors/{vid}/status")
def set_visitor_status(vid: int, body: VisitorStatusIn,
                       _=Depends(require("visitor:write")), db: Session = Depends(get_db)):
    v = db.get(m.Visitor, vid)
    if not v:
        raise HTTPException(404, "访客记录不存在")
    v.status = body.status
    db.commit()
    return visitor_out(v)


@router.delete("/visitors/{vid}", status_code=204)
def delete_visitor(vid: int, _=Depends(require("visitor:write")), db: Session = Depends(get_db)):
    v = db.get(m.Visitor, vid)
    if not v:
        raise HTTPException(404, "访客记录不存在")
    db.delete(v)
    db.commit()


# ---------- 投诉建议 ----------
class ComplaintIn(BaseModel):
    room_id: Optional[int] = None
    owner_name: str = Field(min_length=1, max_length=50)
    phone: Optional[str] = Field(None, max_length=20)
    category: str = Field("其他", max_length=20)
    content: str = Field(min_length=2)


class ComplaintHandleIn(BaseModel):
    status: Literal["processing", "resolved", "closed"]
    reply: Optional[str] = None
    follow_up: Optional[str] = Field(None, max_length=255)


@router.get("/complaints")
def list_complaints(status: Optional[str] = None, _=Depends(require("complaint:read")),
                    db: Session = Depends(get_db)):
    q = db.query(m.Complaint)
    if status:
        q = q.filter(m.Complaint.status == status)
    return [complaint_out(c) for c in q.order_by(m.Complaint.id.desc())]


@router.post("/complaints", status_code=201)
def create_complaint(body: ComplaintIn, _=Depends(require("complaint:write")),
                     db: Session = Depends(get_db)):
    if body.room_id and not db.get(m.Room, body.room_id):
        raise HTTPException(404, "房屋不存在")
    c = m.Complaint(**body.model_dump())
    db.add(c)
    db.commit()
    return complaint_out(c)


@router.post("/complaints/{cid}/handle")
def handle_complaint(cid: int, body: ComplaintHandleIn,
                     user: m.User = Depends(require("complaint:write")),
                     db: Session = Depends(get_db)):
    c = db.get(m.Complaint, cid)
    if not c:
        raise HTTPException(404, "投诉记录不存在")
    c.status = body.status
    if body.reply is not None:
        c.reply = body.reply
    if body.follow_up is not None:
        c.follow_up = body.follow_up
    c.handler = user.real_name
    db.commit()
    return complaint_out(c)


@router.delete("/complaints/{cid}", status_code=204)
def delete_complaint(cid: int, _=Depends(require("complaint:write")),
                     db: Session = Depends(get_db)):
    c = db.get(m.Complaint, cid)
    if not c:
        raise HTTPException(404, "投诉记录不存在")
    db.delete(c)
    db.commit()


# ---------- 通知公告 ----------
class AnnouncementIn(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    content: str = Field(min_length=2)
    category: Literal["notice", "water", "electric", "fee", "other"] = "notice"


class AnnouncementPatch(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    content: Optional[str] = Field(None, min_length=2)
    category: Optional[Literal["notice", "water", "electric", "fee", "other"]] = None


@router.get("/announcements")
def list_announcements(status: Optional[str] = None, category: Optional[str] = None,
                       _=Depends(require("notice:read")), db: Session = Depends(get_db)):
    q = db.query(m.Announcement)
    if status:
        q = q.filter(m.Announcement.status == status)
    if category:
        q = q.filter(m.Announcement.category == category)
    return [announcement_out(a) for a in q.order_by(m.Announcement.id.desc())]


@router.post("/announcements", status_code=201)
def create_announcement(body: AnnouncementIn, _=Depends(require("notice:write")),
                        db: Session = Depends(get_db)):
    a = m.Announcement(**body.model_dump())
    db.add(a)
    db.commit()
    return announcement_out(a)


@router.patch("/announcements/{aid}")
def update_announcement(aid: int, body: AnnouncementPatch,
                        _=Depends(require("notice:write")), db: Session = Depends(get_db)):
    a = db.get(m.Announcement, aid)
    if not a:
        raise HTTPException(404, "公告不存在")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(a, k, v)
    db.commit()
    return announcement_out(a)


@router.post("/announcements/{aid}/publish")
def publish_announcement(aid: int, push: bool = False,
                         _=Depends(require("notice:write")), db: Session = Depends(get_db)):
    a = db.get(m.Announcement, aid)
    if not a:
        raise HTTPException(404, "公告不存在")
    now = datetime.now()
    a.status = "published"
    a.published_at = a.published_at or now
    if push:
        a.pushed_at = now
    db.commit()
    return announcement_out(a)


@router.delete("/announcements/{aid}", status_code=204)
def delete_announcement(aid: int, _=Depends(require("notice:write")),
                        db: Session = Depends(get_db)):
    a = db.get(m.Announcement, aid)
    if not a:
        raise HTTPException(404, "公告不存在")
    db.delete(a)
    db.commit()


# ---------- 报修评价 ----------
class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=255)


@router.post("/repairs/{rid}/review")
def review_repair(rid: int, body: ReviewIn, _: m.User = Depends(require("repair:read")),
                  db: Session = Depends(get_db)):
    r = db.get(m.RepairOrder, rid)
    if not r:
        raise HTTPException(404, "工单不存在")
    if r.status not in ("done", "closed"):
        raise HTTPException(400, "工单完工后才能评价")
    r.rating = body.rating
    r.comment = body.comment
    db.commit()
    return repair_out(r)
