from datetime import datetime
from zoneinfo import ZoneInfo
from sqlmodel import SQLModel, create_engine, Session

DATABASE_URL = "sqlite:///./neural_studio.db"
engine = create_engine(DATABASE_URL, echo=False)


def now_lima() -> datetime:
    return datetime.now(ZoneInfo("America/Lima"))


def create_db():
    SQLModel.metadata.create_all(engine)


def migrate_db():
    """Aplica migraciones de columnas nuevas que SQLModel no agrega automáticamente."""
    from sqlalchemy import text
    with engine.connect() as conn:
        existing = [row[1] for row in conn.execute(text("PRAGMA table_info(videometrics)"))]
        if "published_at" not in existing:
            conn.execute(text("ALTER TABLE videometrics ADD COLUMN published_at DATETIME"))
            conn.commit()
            print("[migrate] Columna published_at agregada a videometrics")
        if "impressions" not in existing:
            conn.execute(text("ALTER TABLE videometrics ADD COLUMN impressions INTEGER NOT NULL DEFAULT 0"))
            conn.commit()
            print("[migrate] Columna impressions agregada a videometrics")
        if "is_canal_b" not in existing:
            conn.execute(text("ALTER TABLE videometrics ADD COLUMN is_canal_b BOOLEAN NOT NULL DEFAULT 0"))
            conn.commit()
            print("[migrate] Columna is_canal_b agregada a videometrics")


def get_session():
    with Session(engine) as session:
        yield session
