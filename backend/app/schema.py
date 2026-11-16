"""轻量级表结构升级：create_all 不会给已有表补列，这里做幂等 ALTER。"""
from sqlalchemy import inspect, text
from .database import engine

# 表名 -> [(列名, MySQL 列定义)]
NEW_COLUMNS = {
    "rooms": [
        ("unit_id", "INT NULL"),
        ("handover_status", "VARCHAR(20) NOT NULL DEFAULT 'received'"),
    ],
    "bills": [
        ("fee_item_id", "INT NULL"),
        ("late_fee_cents", "INT NOT NULL DEFAULT 0"),
        ("due_date", "DATETIME NULL"),
    ],
    "payments": [
        ("receipt_no", "VARCHAR(40) NULL"),
    ],
    "repair_orders": [
        ("rating", "INT NULL"),
        ("comment", "VARCHAR(255) NULL"),
    ],
}


def ensure_columns() -> None:
    if not engine.url.get_backend_name().startswith("mysql"):
        return
    insp = inspect(engine)
    tables = set(insp.get_table_names())
    with engine.begin() as conn:
        for table, columns in NEW_COLUMNS.items():
            if table not in tables:
                continue
            existing = {c["name"] for c in insp.get_columns(table)}
            for name, ddl in columns:
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE `{table}` ADD COLUMN `{name}` {ddl}"))
