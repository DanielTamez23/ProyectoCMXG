"use client";

import { useState, useEffect } from "react";
import { Upload, FileUp, CheckCircle, AlertCircle, RefreshCw, Save, Trash2, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { getSession, UserRole } from "@/lib/auth";

type StationEmployee = {
  id: number;
  assignment_id: number;
  name: string;
  payroll_id: string;
  shift: string;
  order_id: string;
};

type Station = {
  id: number;
  name: string;
  employees: StationEmployee[];
};

type LastUpload = {
  timestamp: string | null;
  rows_processed: number | null;
  filename: string | null;
};

export default function DashboardPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: "" });
  const [stations, setStations] = useState<Station[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [renameDrafts, setRenameDrafts] = useState<Record<number, string>>({});
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [lastUpload, setLastUpload] = useState<LastUpload | null>(null);

  useEffect(() => {
    const session = getSession();
    setUserRole(session?.role ?? null);
  }, []);

  const fetchLastUpload = async () => {
    try {
      const res = await api.get<LastUpload>("/last-upload");
      setLastUpload(res.data);
    } catch {
      // silently ignore
    }
  };

  useEffect(() => {
    fetchLastUpload();
  }, []);

  const fetchStations = async () => {
    setLoadingData(true);
    try {
      const res = await api.get<Station[]>("/stations");
      setStations(res.data);
      setRenameDrafts((prev) => {
        const next = { ...prev };
        res.data.forEach((station) => {
          if (!next[station.id]) next[station.id] = station.name;
        });
        return next;
      });
    } catch (err) {
      console.error("Failed to load stations", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchStations();
    fetchLastUpload();
    // Auto-refresh every 30 seconds to pick up changes from Excel macro uploads
    const interval = setInterval(() => {
      fetchStations();
      fetchLastUpload();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRenameStation = async (stationId: number) => {
    const nextName = (renameDrafts[stationId] || "").trim();
    if (!nextName) {
      setStatus({ type: "error", message: "Station name cannot be empty." });
      return;
    }

    setBusyAction(`rename-${stationId}`);
    try {
      await api.patch(`/stations/${stationId}`, { name: nextName });
      setStatus({ type: "success", message: "Station name updated." });
      await fetchStations();
    } catch (err: any) {
      setStatus({ type: "error", message: err.response?.data?.detail || "Failed to rename station." });
    } finally {
      setBusyAction(null);
    }
  };

  const handleRemoveOperator = async (assignmentId: number) => {
    setBusyAction(`delete-${assignmentId}`);
    try {
      await api.delete(`/assignments/${assignmentId}`);
      setStatus({ type: "success", message: "Operator removed." });
      await fetchStations();
    } catch (err: any) {
      setStatus({ type: "error", message: err.response?.data?.detail || "Failed to remove operator." });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selectedFile = e.dataTransfer.files[0];
      if (selectedFile.name.endsWith(".xlsx")) {
        setFile(selectedFile);
        setStatus({ type: null, message: "" });
      } else {
        setStatus({ type: 'error', message: "Please upload a valid Excel (.xlsx) file" });
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    setUploading(true);
    setStatus({ type: null, message: "" });
    
    const formData = new FormData();
    formData.append("file", file);
    
    try {
      const res = await api.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setStatus({ type: 'success', message: `Successfully uploaded and processed ${res.data.rows_processed} rows.` });
      setFile(null);
      fetchStations();
      fetchLastUpload();
    } catch (err: any) {
      setStatus({ type: 'error', message: err.response?.data?.detail || "An error occurred during upload." });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <header className="flex justify-between items-end mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Data Management</h1>
          <p className="text-slate-600">Upload schedules and manage station assignments</p>
        </div>
        {lastUpload?.timestamp ? (
          <div className="text-right bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <p className="text-xs text-green-700 font-semibold uppercase tracking-wide mb-0.5">Última actualización</p>
            <p className="text-sm font-bold text-green-900">
              {new Date(lastUpload.timestamp).toLocaleString("es-MX", {
                day: "2-digit", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </p>
            <p className="text-xs text-green-700 mt-0.5">
              {lastUpload.rows_processed} filas · {lastUpload.filename}
            </p>
          </div>
        ) : (
          <div className="text-right bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-0.5">Última actualización</p>
            <p className="text-sm text-slate-400 italic">Sin datos aún</p>
          </div>
        )}
      </header>

      {/* Upload Section */}
      <section className="glass-card stagger-1">
        <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <FileUp className="w-5 h-5 text-blue-700" />
          Import Schedule
        </h2>

        {/* Mini tutorial for Excel format */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="font-semibold text-blue-900 mb-2 text-sm">Formato requerido del archivo Excel:</div>
          <div className="overflow-x-auto">
            <table className="text-xs w-full border border-blue-100 bg-white rounded">
              <thead>
                <tr className="bg-blue-100 text-blue-900">
                  <th className="px-2 py-1 border-r border-blue-200">Operator</th>
                  <th className="px-2 py-1 border-r border-blue-200">Station</th>
                  <th className="px-2 py-1 border-r border-blue-200">Payroll ID</th>
                  <th className="px-2 py-1 border-r border-blue-200">Shift</th>
                  <th className="px-2 py-1">Station Order ID</th>
                </tr>
              </thead>
              <tbody>
                <tr className="text-slate-700">
                  <td className="px-2 py-1 border-r border-blue-100">Juan Pérez</td>
                  <td className="px-2 py-1 border-r border-blue-100">Estación 1</td>
                  <td className="px-2 py-1 border-r border-blue-100">12345</td>
                  <td className="px-2 py-1 border-r border-blue-100">A</td>
                  <td className="px-2 py-1">1</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="text-xs text-slate-600 mt-2">Asegúrate de que tu archivo tenga exactamente estos encabezados de columna y al menos una fila de datos.</div>
        </div>
        
        <div 
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="border-2 border-dashed border-slate-300 hover:border-blue-700/40 hover:bg-blue-50 transition-all rounded-2xl p-10 flex flex-col items-center justify-center text-center cursor-pointer"
        >
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 shadow-inner border border-slate-300">
            <Upload className="w-8 h-8 text-blue-700" />
          </div>
          
          {file ? (
            <div className="space-y-2">
              <p className="text-lg font-medium text-slate-900">{file.name}</p>
              <p className="text-sm text-slate-600">{(file.size / 1024).toFixed(2)} KB</p>
              <button 
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                className="text-sm text-red-700 hover:text-red-800 underline mt-2"
              >
                Remove file
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-lg font-medium text-slate-800">Drag and drop your Excel file here</p>
              <p className="text-sm text-slate-600">Supported formats: .xlsx, .xlsm</p>
            </div>
          )}
          
          <input 
            type="file" 
            accept=".xlsx,.xlsm" 
            className="hidden" 
            id="file-upload"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                setFile(e.target.files[0]);
                setStatus({ type: null, message: "" });
              }
            }}
          />
          {!file && (
            <button 
              onClick={() => document.getElementById('file-upload')?.click()}
              className="mt-6 btn-secondary px-4 py-2 text-sm"
            >
              Browse Files
            </button>
          )}
        </div>

        {status.message && (
          <div className={`mt-4 p-4 rounded-xl flex items-center gap-3 ${status.type === 'success' ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
            {status.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            {status.message}
          </div>
        )}

        {file && (
          <div className="mt-6 flex justify-end">
            <button 
              onClick={handleUpload} 
              disabled={uploading}
              className="btn-primary"
            >
              {uploading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Upload and Process Data</>
              )}
            </button>
          </div>
        )}
      </section>

      {/* Data Table Preview */}
      <section className="glass-card stagger-2">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-slate-900">Current Assignments</h2>
          <button onClick={fetchStations} className="text-slate-600 hover:text-slate-900 transition-colors">
            <RefreshCw className={`w-5 h-5 ${loadingData ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {userRole === "admin" && stations.length > 0 && (
          <div className="mb-6 border border-blue-200 bg-blue-50 rounded-xl p-4">
            <div className="flex items-center gap-2 text-blue-900 font-semibold mb-3">
              <ShieldCheck className="w-4 h-4" />
              Admin Station Controls
            </div>
            <div className="space-y-2">
              {stations.map((station) => (
                <div key={station.id} className="flex flex-col md:flex-row gap-2 md:items-center">
                  <span className="text-xs text-slate-600 md:w-24">ID {station.id}</span>
                  <input
                    type="text"
                    value={renameDrafts[station.id] ?? station.name}
                    onChange={(e) =>
                      setRenameDrafts((prev) => ({
                        ...prev,
                        [station.id]: e.target.value,
                      }))
                    }
                    className="glass-input py-2"
                  />
                  <button
                    type="button"
                    onClick={() => handleRenameStation(station.id)}
                    disabled={busyAction === `rename-${station.id}`}
                    className="btn-secondary px-3 py-2 text-sm"
                  >
                    <Save className="w-4 h-4" />
                    Save Name
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {loadingData ? (
          <div className="py-12 flex justify-center">
            <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : stations.length === 0 ? (
          <div className="py-12 text-center border border-dashed border-slate-300 rounded-xl bg-slate-100/70">
            <p className="text-slate-600">No data available. Please upload an Excel file to see assignments.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-300 text-slate-700 text-sm">
                  <th className="pb-3 px-4 font-medium">Station</th>
                  <th className="pb-3 px-4 font-medium">Operator</th>
                  <th className="pb-3 px-4 font-medium">Payroll ID</th>
                  <th className="pb-3 px-4 font-medium">Shift</th>
                  <th className="pb-3 px-4 font-medium text-right">Order ID</th>
                  {userRole === "admin" && <th className="pb-3 px-4 font-medium text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="text-sm text-slate-700">
                {stations.map((station) => (
                  station.employees.map((emp, idx: number) => (
                    <tr key={`${station.id}-${emp.assignment_id}`} className="border-b border-slate-200 hover:bg-slate-100 transition-colors">
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-900 border border-blue-300">
                          {station.name}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-medium text-slate-900">{emp.name}</td>
                      <td className="py-4 px-4 font-mono text-slate-600">{emp.payroll_id}</td>
                      <td className="py-4 px-4">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300">
                          {emp.shift}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right font-mono text-slate-700">{emp.order_id}</td>
                      {userRole === "admin" && (
                        <td className="py-4 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveOperator(emp.assignment_id)}
                            disabled={busyAction === `delete-${emp.assignment_id}`}
                            className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-60"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
