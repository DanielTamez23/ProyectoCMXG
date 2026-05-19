"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Download, Printer, RefreshCw, Search } from "lucide-react";
import { api } from "@/lib/api";

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
  qr_id?: string;
  name: string;
  employees: StationEmployee[];
  active: boolean;
  employee_count: number;
};

export default function QRPrintPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [busyDelete, setBusyDelete] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const sortedStations = useMemo(
    () => [...stations].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)),
    [stations],
  );

  const filteredStations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sortedStations;

    return sortedStations.filter((station) => {
      const stationFields = [station.name, station.id, station.qr_id].join(" ").toLowerCase();
      const employeeFields = (station.employees || [])
        .map((emp) => [emp.name, emp.payroll_id, emp.shift, emp.order_id, emp.assignment_id, emp.id].join(" "))
        .join(" ")
        .toLowerCase();
      return (stationFields + " " + employeeFields).includes(term);
    });
  }, [sortedStations, search]);

  const fetchStations = async () => {
    setLoading(true);
    try {
      const res = await api.get<Station[]>("/qr-stations");
      setStations(res.data);
    } catch (err) {
      // Backward compatibility: if backend has not been restarted/deployed yet,
      // use /stations and mark all as active.
      try {
        const fallback = await api.get<any[]>("/stations");
        const mapped: Station[] = fallback.data.map((s) => ({
          ...s,
          active: true,
          employee_count: Array.isArray(s.employees) ? s.employees.length : 0,
        }));
        setStations(mapped);
      } catch (fallbackErr) {
        console.error("Failed to load stations", err, fallbackErr);
        setStations([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStations();
  }, []);

  const stationRef = (station: Station) => station.qr_id || String(station.id);

  const stationUrl = (station: Station) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    return `${origin}/station/${encodeURIComponent(stationRef(station))}`;
  };

  const qrElementId = (station: Station) => `qr-print-${stationRef(station).replace(/[^a-zA-Z0-9_-]/g, "_")}`;

  const downloadStationQR = (station: Station) => {
    const svg = document.getElementById(qrElementId(station));
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      if (ctx) {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      }
      const png = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `QR_${station.name.replace(/\s+/g, "_")}.png`;
      link.href = png;
      link.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const downloadAllQrs = async () => {
    setDownloadingAll(true);
    try {
      for (const station of filteredStations) {
        downloadStationQR(station);
        await sleep(220);
      }
    } finally {
      setDownloadingAll(false);
    }
  };

  const deleteInactiveStation = async (station: Station) => {
    if (station.active) return;
    const confirmed = window.confirm(`Delete inactive station '${station.name}' from QR catalog?`);
    if (!confirmed) return;

    setBusyDelete(station.id);
    try {
      await api.delete(`/qr-stations/${station.id}`);
      await fetchStations();
    } catch (err) {
      console.error("Failed to delete station", err);
      alert("Could not delete station. Only inactive stations can be deleted.");
    } finally {
      setBusyDelete(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#152C73] mb-2">QR Print Center</h1>
          <p className="text-slate-600">All station QRs ready to print. Title stays above each QR.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={fetchStations}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:border-[#152C73] hover:text-[#152C73]"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            type="button"
            onClick={downloadAllQrs}
            disabled={downloadingAll || filteredStations.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#152C73] bg-white text-[#152C73] hover:bg-[#152C73] hover:text-white disabled:opacity-60"
          >
            <Download className="w-4 h-4" />
            {downloadingAll ? "Downloading..." : "Download All"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#152C73] text-white hover:bg-[#0f1f54]"
          >
            <Printer className="w-4 h-4" />
            Print Sheet
          </button>
        </div>
      </header>

      <div className="max-w-xl print:hidden">
        <label className="relative block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar general: estación, operador, nómina, turno, order ID..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#152C73]/20 focus:border-[#152C73]"
          />
        </label>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-10 h-10 border-2 border-[#152C73]/30 border-t-[#152C73] rounded-full animate-spin" />
        </div>
      ) : filteredStations.length === 0 ? (
        <div className="glass-card text-center py-12">
          <p className="text-slate-600">No matches found for your search.</p>
        </div>
      ) : (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 print:grid-cols-3 print:gap-3">
          {filteredStations.map((station) => (
            <article
              key={stationRef(station)}
              className={`bg-white rounded-2xl p-5 shadow-sm print:shadow-none print:rounded-lg print:p-3 ${station.active ? "border-2 border-green-500" : "border border-slate-300"}`}
            >
              <div className="mb-2 flex justify-center">
                {station.active ? (
                  <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-green-100 text-green-800 border border-green-300">
                    In current Excel
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-300">
                    Not in current Excel
                  </span>
                )}
              </div>

              <h2 className="text-center text-base font-bold text-[#152C73] leading-tight min-h-[3rem] print:min-h-0">
                {station.name}
              </h2>

              <div className="mt-4 flex justify-center">
                <div className="bg-white p-2 border border-slate-200 rounded-xl">
                  <QRCodeSVG
                    id={qrElementId(station)}
                    value={stationUrl(station)}
                    size={170}
                    bgColor="#ffffff"
                    fgColor="#152C73"
                    level="H"
                  />
                </div>
              </div>

              <p className="mt-3 text-xs text-center text-slate-500 break-all print:hidden">{stationUrl(station)}</p>

              <p className="mt-1 text-xs text-center text-slate-500 print:hidden">
                {station.employee_count} operador{station.employee_count !== 1 ? "es" : ""} activos
              </p>

              <div className="mt-4 flex justify-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => downloadStationQR(station)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:border-[#152C73] hover:text-[#152C73] text-sm"
                >
                  <Download className="w-4 h-4" />
                  Download QR
                </button>
                {!station.active && (
                  <button
                    type="button"
                    onClick={() => deleteInactiveStation(station)}
                    disabled={busyDelete === station.id}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:opacity-60 text-sm"
                  >
                    {busyDelete === station.id ? "Deleting..." : "Delete"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
