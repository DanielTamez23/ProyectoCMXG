from fastapi import FastAPI, UploadFile, File, HTTPException, Header, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timezone
import hashlib
import re
import pandas as pd
import io
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
EXCEL_PATH = DATA_DIR / "current.xlsx"

last_upload_info: dict | None = None
REQUIRED_COLUMNS = ["Operator", "Station", "Payroll ID", "Shift", "Station Order ID"]

DATA_DIR.mkdir(parents=True, exist_ok=True)

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


def station_id_from_name(station_name: str):
    normalized = str(station_name).strip().lower()
    if not normalized:
        normalized = "station"
    return int(hashlib.sha1(normalized.encode("utf-8")).hexdigest()[:8], 16)


def load_current_excel():
    if not EXCEL_PATH.exists():
        return pd.DataFrame(columns=REQUIRED_COLUMNS)
    try:
        df = pd.read_excel(EXCEL_PATH, engine="openpyxl")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to read stored Excel file: {e}")

    if not all(col in df.columns for col in REQUIRED_COLUMNS):
        raise HTTPException(status_code=500, detail=f"Stored Excel file is missing required columns: {', '.join(REQUIRED_COLUMNS)}")

    return df.reset_index(drop=True)


def save_current_excel(df: pd.DataFrame):
    df.to_excel(EXCEL_PATH, index=False, engine="openpyxl")


def build_stations_from_df(df: pd.DataFrame):
    stations: dict[str, dict] = {}

    for idx, row in df.reset_index(drop=True).iterrows():
        operator_name = str(row.get("Operator", "")).strip()
        station_name = str(row.get("Station", "")).strip()
        payroll_id = str(row.get("Payroll ID", "")).strip()
        shift = str(row.get("Shift", "")).strip()
        order_id = str(row.get("Station Order ID", "")).strip()

        if not station_name:
            continue

        station_key = station_name
        if station_key not in stations:
            stations[station_key] = {
                "id": station_id_from_name(station_name),
                "qr_id": build_station_qr_id(station_name),
                "name": station_name,
                "employees": [],
            }

        stations[station_key]["employees"].append({
            "id": idx,
            "assignment_id": idx,
            "name": operator_name,
            "payroll_id": payroll_id,
            "shift": shift,
            "order_id": order_id,
        })

    for station_data in stations.values():
        station_data["employees"].sort(key=lambda emp: (parse_int_or_max(emp.get("order_id")), emp.get("name", "")))

    return sorted(stations.values(), key=lambda s: s["name"].lower())


def find_station(stations, station_identifier: str):
    for station in stations:
        if str(station["id"]) == station_identifier or station["qr_id"] == station_identifier:
            return station
    return None

@app.get("/")
def read_root():
    return {"message": "Station Management API is running"}

@app.post("/upload")
async def upload_excel(file: UploadFile = File(...), _auth: None = Depends(verify_upload_api_key)):
    if not (file.filename.endswith(".xlsx") or file.filename.endswith(".xlsm")):
        raise HTTPException(status_code=400, detail="Only .xlsx or .xlsm files are supported")

    contents = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(contents), engine="openpyxl")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse Excel file: {e}")

    if not all(col in df.columns for col in REQUIRED_COLUMNS):
        raise HTTPException(status_code=400, detail=f"Excel must contain columns: {', '.join(REQUIRED_COLUMNS)}")

    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        EXCEL_PATH.write_bytes(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save uploaded Excel file: {e}")

    global last_upload_info
    last_upload_info = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "rows_processed": len(df),
        "filename": file.filename,
    }

    return {"message": "Data uploaded successfully", "rows_processed": len(df)}

@app.get("/last-upload")
def get_last_upload():
    if last_upload_info is None:
        return {"timestamp": None, "rows_processed": None, "filename": None}
    return last_upload_info

@app.get("/stations")
def get_stations():
    df = load_current_excel()
    return build_stations_from_df(df)

@app.get("/qr-stations")
def get_qr_stations():
    stations = build_stations_from_df(load_current_excel())
    return [
        {
            **station,
            "active": True,
            "employee_count": len(station["employees"]),
        }
        for station in stations
    ]

@app.get("/stations/{station_identifier}")
def get_station(station_identifier: str):
    stations = build_stations_from_df(load_current_excel())
    station = find_station(stations, station_identifier)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")
    return station

@app.patch("/stations/{station_identifier}")
def rename_station(station_identifier: str, payload: RenameStationRequest):
    new_name = payload.name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="Station name cannot be empty")

    df = load_current_excel()
    stations = build_stations_from_df(df)
    station = find_station(stations, station_identifier)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    if any(s["name"] == new_name for s in stations if s["id"] != station["id"]):
        raise HTTPException(status_code=400, detail="Station name already exists")

    df.loc[df["Station"] == station["name"], "Station"] = new_name
    save_current_excel(df)

    updated_stations = build_stations_from_df(df)
    updated_station = next((s for s in updated_stations if s["name"] == new_name), None)
    return updated_station

@app.delete("/assignments/{assignment_id}")
def delete_assignment(assignment_id: int):
    df = load_current_excel()
    if assignment_id < 0 or assignment_id >= len(df):
        raise HTTPException(status_code=404, detail="Assignment not found")

    df = df.reset_index(drop=True)
    df = df.drop(index=assignment_id).reset_index(drop=True)
    save_current_excel(df)
    return {"message": "Operator removed from station"}

@app.delete("/qr-stations/{station_identifier}")
def delete_inactive_qr_station(station_identifier: str):
    stations = build_stations_from_df(load_current_excel())
    station = find_station(stations, station_identifier)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    if len(station["employees"]) > 0:
        raise HTTPException(status_code=400, detail="Cannot delete an active station")

    raise HTTPException(status_code=404, detail="No inactive station entries exist in Excel")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
