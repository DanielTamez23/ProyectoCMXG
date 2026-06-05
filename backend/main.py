from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timezone
import hashlib
import re
import pandas as pd
import io
import os

import models

models.init_db()

app = FastAPI(title="Station Management API")

frontend_origins_env = os.getenv("FRONTEND_ORIGINS", "")
frontend_origins = [origin.strip() for origin in frontend_origins_env.split(",") if origin.strip()]
if not frontend_origins:
    frontend_origins = ["http://localhost:3000", "http://127.0.0.1:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = models.SessionLocal()
    try:
        yield db
    finally:
        db.close()


def verify_upload_api_key(x_api_key: str = Header(default="")):
    required_key = os.getenv("BACKEND_UPLOAD_API_KEY", "").strip()
    if not required_key:
        return

    if x_api_key != required_key:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


class RenameStationRequest(BaseModel):
    name: str


def parse_int_or_max(value: str):
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return 10**9


def build_station_qr_id(station_name: str):
    normalized = str(station_name).strip().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", normalized).strip("-")
    if not slug:
        slug = "station"
    digest = hashlib.sha1(normalized.encode("utf-8")).hexdigest()[:8]
    return f"{slug}-{digest}"


def station_to_response(station: models.Station, db: Session):
    assignments = db.query(models.Assignment).filter(models.Assignment.station_id == station.id).all()
    employees = [
        {
            "id": a.employee.id,
            "assignment_id": a.id,
            "name": a.employee.name,
            "payroll_id": a.employee.payroll_id,
            "shift": a.employee.shift,
            "order_id": a.station_order_id,
        }
        for a in assignments
    ]
    qr_id = station.qr_id or build_station_qr_id(station.name)
    if not station.qr_id:
        station.qr_id = qr_id
        db.commit()
        db.refresh(station)

    return {
        "id": station.id,
        "qr_id": qr_id,
        "name": station.name,
        "employees": employees,
    }


last_upload_info: dict | None = None

@app.get("/")
def read_root():
    return {"message": "Station Management API is running"}

@app.post("/upload")
async def upload_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _auth: None = Depends(verify_upload_api_key),
):
    if not (file.filename.endswith('.xlsx') or file.filename.endswith('.xlsm')):
        raise HTTPException(status_code=400, detail="Only .xlsx or .xlsm files are supported")
    
    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents))
        
        required_columns = ["Operator", "Station", "Payroll ID", "Shift", "Station Order ID"]
        if not all(col in df.columns for col in required_columns):
            raise HTTPException(status_code=400, detail=f"Excel must contain columns: {', '.join(required_columns)}")
        
        db.query(models.Assignment).delete(synchronize_session=False)
        db.query(models.Employee).delete(synchronize_session=False)
        db.commit()
        
        for _, row in df.iterrows():
            operator_name = str(row["Operator"])
            station_name = str(row["Station"])
            payroll_id = str(row["Payroll ID"])
            shift = str(row["Shift"])
            station_order_id = str(row["Station Order ID"])
            
            emp = db.query(models.Employee).filter(models.Employee.payroll_id == payroll_id).first()
            if not emp:
                emp = models.Employee(payroll_id=payroll_id, name=operator_name, shift=shift)
                db.add(emp)
                db.commit()
                db.refresh(emp)
            else:
                emp.name = operator_name
                emp.shift = shift
                db.commit()
                
            stat = db.query(models.Station).filter(models.Station.name == station_name).first()
            if not stat:
                stat = models.Station(
                    name=station_name,
                    qr_id=build_station_qr_id(station_name),
                )
                db.add(stat)
                db.commit()
                db.refresh(stat)
                
            assignment = models.Assignment(
                station_id=stat.id,
                employee_id=emp.id,
                station_order_id=station_order_id
            )
            db.add(assignment)
            
        db.commit()

        global last_upload_info
        last_upload_info = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "rows_processed": len(df),
            "filename": file.filename,
        }
        
        return {"message": "Data uploaded successfully", "rows_processed": len(df)}
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/last-upload")
def get_last_upload():
    if last_upload_info is None:
        return {"timestamp": None, "rows_processed": None, "filename": None}
    return last_upload_info

@app.get("/stations")
def get_stations(db: Session = Depends(get_db)):
    stations = db.query(models.Station).order_by(models.Station.id.asc()).all()
    active_stations = []
    for station in stations:
        data = station_to_response(station, db)
        if data["employees"]:
            active_stations.append(data)

    def station_order_key(station_data):
        order_ids = [parse_int_or_max(emp.get("order_id")) for emp in station_data["employees"]]
        first_order = min(order_ids) if order_ids else 10**9
        return (first_order, station_data["name"].lower())

    active_stations.sort(key=station_order_key)
    return active_stations


@app.get("/qr-stations")
def get_qr_stations(db: Session = Depends(get_db)):
    stations = db.query(models.Station).order_by(models.Station.name.asc()).all()
    result = []

    for station in stations:
        data = station_to_response(station, db)
        employee_count = len(data["employees"])
        result.append(
            {
                **data,
                "active": employee_count > 0,
                "employee_count": employee_count,
            }
        )

    result.sort(key=lambda s: (not s["active"], s["name"].lower()))
    return result

@app.get("/stations/{station_id}")
def get_station(station_id: int, db: Session = Depends(get_db)):
    s = db.query(models.Station).filter(models.Station.id == station_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Station not found")

    return station_to_response(s, db)


@app.patch("/stations/{station_id}")
def rename_station(station_id: int, payload: RenameStationRequest, db: Session = Depends(get_db)):
    new_name = payload.name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Station name cannot be empty")

    station = db.query(models.Station).filter(models.Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    duplicate = (
        db.query(models.Station)
        .filter(models.Station.name == new_name, models.Station.id != station_id)
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=400, detail="Station name already exists")

    # Keep qr_id unchanged so printed QR codes remain valid after renames.
    station.name = new_name
    db.commit()
    db.refresh(station)
    return station_to_response(station, db)


@app.delete("/assignments/{assignment_id}")
def delete_assignment(assignment_id: int, db: Session = Depends(get_db)):
    assignment = db.query(models.Assignment).filter(models.Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    employee_id = assignment.employee_id
    db.delete(assignment)
    db.commit()

    remaining = db.query(models.Assignment).filter(models.Assignment.employee_id == employee_id).count()
    if remaining == 0:
        employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
        if employee:
            db.delete(employee)
            db.commit()

    return {"message": "Operator removed from station"}


@app.delete("/qr-stations/{station_id}")
def delete_inactive_qr_station(station_id: int, db: Session = Depends(get_db)):
    station = db.query(models.Station).filter(models.Station.id == station_id).first()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    assignment_count = (
        db.query(models.Assignment)
        .filter(models.Assignment.station_id == station_id)
        .count()
    )
    if assignment_count > 0:
        raise HTTPException(status_code=400, detail="Cannot delete an active station")

    db.delete(station)
    db.commit()
    return {"message": "Inactive station deleted"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
