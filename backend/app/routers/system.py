from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from .. import models as m
from ..database import get_db
from ..security import ROLE_PERMS, current_user, hash_password, require
from ..serializers import log_out, user_out

router = APIRouter(prefix="/api", tags=["system"])

ROLE_LABELS = {
    "admin": "超级管理员", "manager": "物业经理", "cashier": "收费员",
    "finance": "财务", "repairman": "维修工",
}


class UserIn(BaseModel):
    username: str = Field(min_length=2, max_length=50)
    password: str = Field(min_length=6, max_length=50)
    real_name: str = Field(min_length=1, max_length=50)
    role: Literal["admin", "manager", "cashier", "finance", "repairman"] = "cashier"


class UserPatch(BaseModel):
    real_name: Optional[str] = Field(None, min_length=1, max_length=50)
    role: Optional[Literal["admin", "manager", "cashier", "finance", "repairman"]] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=6, max_length=50)


@router.get("/users")
def list_users(_=Depends(require("system:read")), db: Session = Depends(get_db)):
    return [user_out(u) for u in db.query(m.User).order_by(m.User.id)]


@router.post("/users", status_code=201)
def create_user(body: UserIn, _=Depends(require("system:write")), db: Session = Depends(get_db)):
    if db.query(m.User).filter_by(username=body.username).first():
        raise HTTPException(409, "账号已存在")
    u = m.User(username=body.username, password_hash=hash_password(body.password),
               real_name=body.real_name, role=body.role)
    db.add(u)
    db.commit()
    return user_out(u)


@router.patch("/users/{uid}")
def update_user(uid: int, body: UserPatch, user: m.User = Depends(require("system:write")),
                db: Session = Depends(get_db)):
    u = db.get(m.User, uid)
    if not u:
        raise HTTPException(404, "用户不存在")
    if uid == user.id and body.is_active is False:
        raise HTTPException(400, "不能停用当前登录账号")
    data = body.model_dump(exclude_none=True)
    if "password" in data:
        u.password_hash = hash_password(data.pop("password"))
    for k, v in data.items():
        setattr(u, k, v)
    db.commit()
    return user_out(u)


@router.delete("/users/{uid}", status_code=204)
def delete_user(uid: int, user: m.User = Depends(require("system:write")),
                db: Session = Depends(get_db)):
    u = db.get(m.User, uid)
    if not u:
        raise HTTPException(404, "用户不存在")
    if uid == user.id:
        raise HTTPException(400, "不能删除当前登录账号")
    db.delete(u)
    db.commit()


@router.get("/roles")
def list_roles(_=Depends(require("system:read"))):
    return [{"role": role, "label": ROLE_LABELS.get(role, role),
             "perms": sorted(perms)} for role, perms in ROLE_PERMS.items()]


@router.get("/logs")
def list_logs(username: Optional[str] = None, method: Optional[str] = None,
              _=Depends(require("system:read")), db: Session = Depends(get_db)):
    q = db.query(m.OperationLog)
    if username:
        q = q.filter(m.OperationLog.username.contains(username))
    if method:
        q = q.filter(m.OperationLog.method == method)
    return [log_out(x) for x in q.order_by(m.OperationLog.id.desc()).limit(500)]


@router.delete("/logs", status_code=204)
def clear_logs(user: m.User = Depends(require("system:write")), db: Session = Depends(get_db)):
    db.query(m.OperationLog).filter(m.OperationLog.username != user.username).delete()
    db.commit()
