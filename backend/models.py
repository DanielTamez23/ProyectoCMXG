from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

Base = declarative_base()

class Station(Base):
    __tablename__ = "stations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    qr_id = Column(String, unique=True, index=True, nullable=True)
    assignments = relationship("Assignment", back_populates="station")

class Employee(Base):
    __tablename__ = "employees"
    id = Column(Integer, primary_key=True, index=True)
    payroll_id = Column(String, unique=True, index=True)
    name = Column(String)
    shift = Column(String)
    assignments = relationship("Assignment", back_populates="employee")

class Assignment(Base):
    __tablename__ = "assignments"
    id = Column(Integer, primary_key=True, index=True)
    station_id = Column(Integer, ForeignKey("stations.id"))
    employee_id = Column(Integer, ForeignKey("employees.id"))
    station_order_id = Column(String)
    
    station = relationship("Station", back_populates="assignments")
    employee = relationship("Employee", back_populates="assignments")

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sql_app.db")

if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
elif SQLALCHEMY_DATABASE_URL.startswith("postgresql"):
    engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True, pool_recycle=300)
else:
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"sslmode": "require"})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def backfill_station_qr_ids():
    from sqlalchemy import inspect, text
    import hashlib
    import re

    def build_qr_id(station_name: str) -> str:
        normalized = str(station_name).strip().lower()
        slug = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-") or "station"
        digest = hashlib.sha1(normalized.encode("utf-8")).hexdigest()[:8]
        return f"{slug}-{digest}"

    inspector = inspect(engine)
    if "stations" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("stations")}
    if "qr_id" not in columns:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE stations ADD COLUMN qr_id VARCHAR"))

    db = SessionLocal()
    try:
        stations = db.query(Station).filter(Station.qr_id.is_(None)).all()
        for station in stations:
            station.qr_id = build_qr_id(station.name)
        if stations:
            db.commit()
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    backfill_station_qr_ids()
