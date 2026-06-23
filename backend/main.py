from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, joinedload
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
    frontend_origins = ["http://localhost:3000", "http://127.0.0.1:3000", "http://10.42.69.41:3000"]

print(f"[CORS] Allowing origins: {frontend_origins}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request, call_next):
    print(f"[REQUEST] {request.method} {request.url.path} from {request.client.host if request.client else 'unknown'}")
    response = await call_next(request)
    print(f"[RESPONSE] {request.method} {request.url.path} - Status: {response.status_code}")
    return response


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


def station_to_response(station: models.Station, has_percentage: bool = False, has_low_percentage: bool = False):
    # Use pre-loaded assignments from eager loading
    employees = [
        {
            "id": a.employee.id,
            "assignment_id": a.id,
            "name": a.employee.name,
            "payroll_id": a.employee.payroll_id,
            "shift": a.employee.shift,
            "order_id": a.station_order_id,
            "has_percentage": has_percentage,
            "has_low_percentage": has_low_percentage,
        }
        for a in station.assignments
    ]
    qr_id = station.qr_id or build_station_qr_id(station.name)

    return {
        "id": station.id,
        "qr_id": qr_id,
        "name": station.name,
        "employees": employees,
    }


last_upload_info: dict | None = None

# Cache for stations data (loaded at startup, invalidated on upload)
stations_cache = None
qr_stations_cache = None

@app.get("/")
def read_root():
    return {"message": "Station Management API is running"}

@app.post("/upload")
async def upload_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _auth: None = Depends(verify_upload_api_key),
):
    print(f"[UPLOAD] Starting upload process for file: {file.filename}")
    if not (file.filename.endswith('.xlsx') or file.filename.endswith('.xlsm')):
        print(f"[UPLOAD] Invalid file format: {file.filename}")
        raise HTTPException(status_code=400, detail="Only .xlsx or .xlsm files are supported")

    try:
        contents = await file.read()
        print(f"[UPLOAD] File read successfully, size: {len(contents)} bytes")
        df = pd.read_excel(io.BytesIO(contents))
        print(f"[UPLOAD] Excel parsed successfully, columns: {df.columns.tolist()}, rows: {len(df)}")

        required_columns = ["Operator", "Station", "Payroll ID", "Shift", "Station Order ID"]
        if not all(col in df.columns for col in required_columns):
            missing = [col for col in required_columns if col not in df.columns]
            print(f"[UPLOAD] Missing required columns: {missing}")
            raise HTTPException(status_code=400, detail=f"Excel must contain columns: {', '.join(required_columns)}")

        print(f"[UPLOAD] Deleting existing assignments and employees")
        db.query(models.Assignment).delete(synchronize_session=False)
        db.query(models.Employee).delete(synchronize_session=False)
        db.commit()
        print(f"[UPLOAD] Existing data deleted successfully")

        for idx, row in df.iterrows():
            operator_name = str(row["Operator"])
            station_name = str(row["Station"])
            payroll_id = str(row["Payroll ID"])
            shift = str(row["Shift"])
            station_order_id = str(row["Station Order ID"])

            print(f"[UPLOAD] Processing row {idx + 1}/{len(df)}: {operator_name} at {station_name}")

            emp = db.query(models.Employee).filter(models.Employee.payroll_id == payroll_id).first()
            if not emp:
                emp = models.Employee(payroll_id=payroll_id, name=operator_name, shift=shift)
                db.add(emp)
                db.commit()
                db.refresh(emp)
                print(f"[UPLOAD] Created new employee: {payroll_id}")
            else:
                emp.name = operator_name
                emp.shift = shift
                db.commit()
                print(f"[UPLOAD] Updated existing employee: {payroll_id}")

            stat = db.query(models.Station).filter(models.Station.name == station_name).first()
            if not stat:
                # Check if station exists with same qr_id (different name)
                qr_id = build_station_qr_id(station_name)
                stat_by_qr = db.query(models.Station).filter(models.Station.qr_id == qr_id).first()
                if stat_by_qr:
                    stat = stat_by_qr
                    stat.name = station_name
                    db.commit()
                    print(f"[UPLOAD] Updated existing station name: {station_name}")
                else:
                    stat = models.Station(
                        name=station_name,
                        qr_id=qr_id,
                    )
                    db.add(stat)
                    db.commit()
                    db.refresh(stat)
                    print(f"[UPLOAD] Created new station: {station_name}")

            assignment = models.Assignment(
                station_id=stat.id,
                employee_id=emp.id,
                station_order_id=station_order_id
            )
            db.add(assignment)

        db.commit()
        print(f"[UPLOAD] All data committed successfully")

        global last_upload_info
        last_upload_info = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "rows_processed": len(df),
            "filename": file.filename,
        }

        # Invalidate cache after upload
        global stations_cache, qr_stations_cache
        stations_cache = None
        qr_stations_cache = None
        print("[UPLOAD] Cache invalidated")

        print(f"[UPLOAD] Upload completed successfully: {len(df)} rows processed")
        return {"message": "Data uploaded successfully", "rows_processed": len(df)}

    except Exception as e:
        print(f"[UPLOAD] ERROR: {str(e)}")
        print(f"[UPLOAD] ERROR TYPE: {type(e).__name__}")
        import traceback
        print(f"[UPLOAD] TRACEBACK: {traceback.format_exc()}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/last-upload")
def get_last_upload():
    if last_upload_info is None:
        return {"timestamp": None, "rows_processed": None, "filename": None}
    return last_upload_info

def normalize_station_name(station_name: str):
    """Remove ' - 0.x' suffix from station names for grouping"""
    import re
    pattern = r' - 0\.\d+$'
    return re.sub(pattern, '', station_name.strip())

def has_percentage_suffix(station_name: str):
    """Check if station name has ' - 0.x' suffix and return the value"""
    import re
    pattern = r' - 0\.(\d+)$'
    match = re.search(pattern, station_name.strip())
    if match:
        return float(f"0.{match.group(1)}")
    return None

@app.get("/stations")
def get_stations(db: Session = Depends(get_db)):
    global stations_cache
    
    # Return cached data if available
    if stations_cache is not None:
        print("[CACHE] Using cached stations data")
        return stations_cache
    
    print("[CACHE] Cache miss, loading from database")
    
    # Use eager loading to load assignments and employees in one query
    stations = db.query(models.Station).options(
        joinedload(models.Station.assignments)
        .joinedload(models.Assignment.employee)
    ).order_by(models.Station.id.asc()).all()
    
    # Group stations by normalized name
    grouped_stations = {}
    for station in stations:
        # Check if this station has percentage suffix and determine if it's low (<= 0.7)
        percentage_value = has_percentage_suffix(station.name)
        station_has_percentage = False
        station_has_low_percentage = False
        if percentage_value is not None:
            if percentage_value <= 0.7:
                station_has_low_percentage = True
            else:
                station_has_percentage = True
        
        data = station_to_response(station, has_percentage=station_has_percentage, has_low_percentage=station_has_low_percentage)
        if data["employees"]:
            normalized_name = normalize_station_name(data["name"])
            if normalized_name not in grouped_stations:
                grouped_stations[normalized_name] = {
                    "name": normalized_name,
                    "employees": [],
                    "original_names": set(),
                }
            grouped_stations[normalized_name]["employees"].extend(data["employees"])
            grouped_stations[normalized_name]["original_names"].add(data["name"])
    
    # Build final station list
    active_stations = []
    for normalized_name, station_data in grouped_stations.items():
        # Check if this is a grouped station (multiple original names)
        is_grouped = len(station_data["original_names"]) > 1
        
        print(f"[GROUPING] {normalized_name}: original_names={station_data['original_names']}, is_grouped={is_grouped}")
        
        # Deduplicate employees by ID, merging has_percentage and has_low_percentage flags
        unique_employees = {}
        for emp in station_data["employees"]:
            if emp["id"] not in unique_employees:
                unique_employees[emp["id"]] = emp
            else:
                # If employee already exists, merge flags (true if any source has it)
                old_has_percentage = unique_employees[emp["id"]]["has_percentage"]
                new_has_percentage = emp["has_percentage"]
                merged_has_percentage = old_has_percentage or new_has_percentage
                
                old_has_low_percentage = unique_employees[emp["id"]]["has_low_percentage"]
                new_has_low_percentage = emp["has_low_percentage"]
                merged_has_low_percentage = old_has_low_percentage or new_has_low_percentage
                
                print(f"[DEDUPLICATE] Employee {emp['id']} ({emp['name']}): has_percentage old={old_has_percentage}, new={new_has_percentage}, merged={merged_has_percentage} | has_low_percentage old={old_has_low_percentage}, new={new_has_low_percentage}, merged={merged_has_low_percentage}")
                unique_employees[emp["id"]]["has_percentage"] = merged_has_percentage
                unique_employees[emp["id"]]["has_low_percentage"] = merged_has_low_percentage
        
        # If not grouped, find the original station to get id and qr_id
        station_id = None
        station_qr_id = None
        if not is_grouped:
            # Find the original station with this name
            original_station = db.query(models.Station).filter(models.Station.name == list(station_data["original_names"])[0]).first()
            if original_station:
                station_id = original_station.id
                station_qr_id = original_station.qr_id
        
        active_stations.append({
            "id": station_id,
            "qr_id": station_qr_id,
            "name": normalized_name,
            "employees": list(unique_employees.values()),
        })

    def station_order_key(station_data):
        order_ids = [parse_int_or_max(emp.get("order_id")) for emp in station_data["employees"]]
        first_order = min(order_ids) if order_ids else 10**9
        return (first_order, station_data["name"].lower())

    active_stations.sort(key=station_order_key)
    
    # Cache the result
    stations_cache = active_stations
    print(f"[CACHE] Loaded {len(active_stations)} stations into cache")
    
    return active_stations


@app.get("/qr-stations")
def get_qr_stations(db: Session = Depends(get_db)):
    global qr_stations_cache
    
    # Return cached data if available
    if qr_stations_cache is not None:
        print("[CACHE] Using cached qr-stations data")
        return qr_stations_cache
    
    print("[CACHE] Cache miss for qr-stations, loading from database")
    
    # Use eager loading to load assignments and employees in one query
    stations = db.query(models.Station).options(
        joinedload(models.Station.assignments)
        .joinedload(models.Assignment.employee)
    ).order_by(models.Station.name.asc()).all()
    
    # Group stations by normalized name (same logic as /stations)
    grouped_stations = {}
    for station in stations:
        # Check if this station has percentage suffix and determine if it's low (<= 0.7)
        percentage_value = has_percentage_suffix(station.name)
        station_has_percentage = False
        station_has_low_percentage = False
        if percentage_value is not None:
            if percentage_value <= 0.7:
                station_has_low_percentage = True
            else:
                station_has_percentage = True
        
        data = station_to_response(station, has_percentage=station_has_percentage, has_low_percentage=station_has_low_percentage)
        if data["employees"]:
            normalized_name = normalize_station_name(data["name"])
            if normalized_name not in grouped_stations:
                grouped_stations[normalized_name] = {
                    "name": normalized_name,
                    "employees": [],
                    "original_names": set(),
                    "original_qr_ids": set(),
                }
            grouped_stations[normalized_name]["employees"].extend(data["employees"])
            grouped_stations[normalized_name]["original_names"].add(data["name"])
            if data["qr_id"]:
                grouped_stations[normalized_name]["original_qr_ids"].add(data["qr_id"])
    
    # Build final station list
    result = []
    for normalized_name, station_data in grouped_stations.items():
        # Deduplicate employees by ID, merging has_percentage and has_low_percentage flags
        unique_employees = {}
        for emp in station_data["employees"]:
            if emp["id"] not in unique_employees:
                unique_employees[emp["id"]] = emp
            else:
                # If employee already exists, merge flags (true if any source has it)
                old_has_percentage = unique_employees[emp["id"]]["has_percentage"]
                new_has_percentage = emp["has_percentage"]
                merged_has_percentage = old_has_percentage or new_has_percentage
                
                old_has_low_percentage = unique_employees[emp["id"]]["has_low_percentage"]
                new_has_low_percentage = emp["has_low_percentage"]
                merged_has_low_percentage = old_has_low_percentage or new_has_low_percentage
                
                unique_employees[emp["id"]]["has_percentage"] = merged_has_percentage
                unique_employees[emp["id"]]["has_low_percentage"] = merged_has_low_percentage
        
        employee_count = len(unique_employees)
        
        # Use the normalized name as QR ID for grouped stations to ensure navigation works
        # For non-grouped stations, use the original QR ID
        is_grouped = len(station_data["original_names"]) > 1
        if is_grouped:
            qr_id = normalized_name
        elif station_data["original_qr_ids"]:
            qr_id = list(station_data["original_qr_ids"])[0]
        else:
            qr_id = build_station_qr_id(normalized_name)
        
        result.append({
            "id": None,  # Grouped stations don't have a single ID
            "qr_id": qr_id,
            "name": normalized_name,
            "employees": list(unique_employees.values()),
            "active": employee_count > 0,
            "employee_count": employee_count,
        })

    result.sort(key=lambda s: (not s["active"], s["name"].lower()))
    
    # Cache the result
    qr_stations_cache = result
    print(f"[CACHE] Loaded {len(result)} qr-stations into cache")
    
    return result

@app.get("/stations/{station_id}")
def get_station(station_id: int, db: Session = Depends(get_db)):
    # Use eager loading to load assignments and employees in one query
    s = db.query(models.Station).options(
        joinedload(models.Station.assignments)
        .joinedload(models.Assignment.employee)
    ).filter(models.Station.id == station_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Station not found")

    return station_to_response(s)


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
    return station_to_response(station)


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
