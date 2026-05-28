from datetime import datetime
from zoneinfo import ZoneInfo
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy.pool import StaticPool

DATABASE_URL = "sqlite:///./neural_studio.db"

engine = create_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

def now_lima() -> datetime:
    return datetime.now(ZoneInfo("America/Lima"))

def create_db():
    SQLModel.metadata.create_all(engine)

def migrate_db():
    from sqlalchemy import text
    with engine.connect() as conn:
        existing = [row[1] for row in conn.execute(text("PRAGMA table_info(videometrics)"))]
        if "published_at" not in existing:
            conn.execute(text("ALTER TABLE videometrics ADD COLUMN published_at DATETIME"))
            conn.commit()

def get_session():
    with Session(engine) as session:
        yield session
