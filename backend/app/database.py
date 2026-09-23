import os

from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import DeclarativeBase, sessionmaker


DATABASE_URL = os.environ.get("DATABASE_URL") or URL.create(
    "postgresql+psycopg", username=os.environ["DB_USER"],
    password=os.environ["DB_PASSWORD"], host=os.environ.get("DB_HOST", "db"),
    port=5432, database=os.environ["DB_NAME"],
)


engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
)


SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()
