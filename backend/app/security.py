from datetime import datetime, timedelta, timezone
import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from .database import SECRET_KEY, get_db
from .models import User

ALGO = "HS256"
oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# RBAC：角色 -> 权限点。admin 拥有全部权限
ROLE_PERMS: dict[str, set[str]] = {
    "admin": {"*"},
    "manager": {"house:read", "house:write", "bill:read", "bill:write",
                "repair:read", "repair:write", "repair:handle", "dashboard:read",
                "archive:read", "archive:write", "fee:read", "fee:write",
                "visitor:read", "visitor:write", "parking:read", "parking:write",
                "complaint:read", "complaint:write", "notice:read", "notice:write",
                "asset:read", "asset:write", "inspection:read", "inspection:write",
                "report:read"},
    "cashier": {"house:read", "bill:read", "bill:write", "dashboard:read",
                "archive:read", "fee:read", "fee:write", "visitor:read",
                "parking:read", "parking:write", "complaint:read", "notice:read",
                "report:read"},
    "finance": {"house:read", "bill:read", "dashboard:read", "archive:read",
                "fee:read", "report:read"},
    "repairman": {"repair:read", "repair:handle", "inspection:read",
                  "inspection:write", "asset:read"},
}


def has_perm(role: str, perm: str) -> bool:
    perms = ROLE_PERMS.get(role, set())
    return "*" in perms or perm in perms


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())


def make_token(user: User) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=12)
    return jwt.encode({"sub": str(user.id), "exp": exp}, SECRET_KEY, algorithm=ALGO)


def current_user(token: str = Depends(oauth2), db: Session = Depends(get_db)) -> User:
    try:
        uid = int(jwt.decode(token, SECRET_KEY, algorithms=[ALGO])["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(401, "登录已失效，请重新登录")
    user = db.get(User, uid)
    if not user or not user.is_active:
        raise HTTPException(401, "登录已失效，请重新登录")
    return user


def require(perm: str):
    def checker(user: User = Depends(current_user)) -> User:
        if not has_perm(user.role, perm):
            raise HTTPException(403, "没有权限执行此操作")
        return user
    return checker
