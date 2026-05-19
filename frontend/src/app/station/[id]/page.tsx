"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Activity, User, Briefcase, MapPin, Loader2, CheckCircle2, Lock, ChevronLeft, ChevronRight, LogIn, Workflow, ArrowUpDown, Clock3 } from "lucide-react";
import { motion } from "framer-motion";
import { createSession, getAllowedUsers, getSession, saveSession } from "@/lib/auth";
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
  qr_id: string;
  name: string;
  employees: StationEmployee[];
};

type LastUpload = {
  timestamp: string | null;
  rows_processed: number | null;
  filename: string | null;
};

export default function StationPage() {
  const router = useRouter();
  const params = useParams();
  const stationRef = String(params.id);

  const [stations, setStations] = useState<Station[]>([]);
  const [station, setStation] = useState<Station | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [lastUpload, setLastUpload] = useState<LastUpload | null>(null);
  const [shiftSort, setShiftSort] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    const session = getSession();
    setIsAuthenticated(!!session);
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchStation = async () => {
      try {
        const [stationsRes, lastUploadRes] = await Promise.all([
          api.get<Station[]>("/stations"),
          api.get<LastUpload>("/last-upload"),
        ]);
        const orderedStations = stationsRes.data;
        setStations(orderedStations);
        setLastUpload(lastUploadRes.data);

        const current = orderedStations.find(
          (s) => s.qr_id === stationRef || String(s.id) === stationRef,
        );
        if (!current) {
          setError("Station not found");
          setStation(null);
        } else {
          setError("");
          setStation(current);
        }
      } catch (err: any) {
        setError("Failed to load station data");
      } finally {
        setLoading(false);
      }
    };
    
    fetchStation();
    const interval = setInterval(fetchStation, 10000); // Live updates
    return () => clearInterval(interval);
  }, [isAuthenticated, stationRef]);

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    const matchedUser = getAllowedUsers().find(
      (u) => u.username === username && u.password === password,
    );

    if (!matchedUser) {
      setAuthError("Invalid username or password");
      setAuthLoading(false);
      return;
    }

    saveSession(createSession(matchedUser.username, matchedUser.role));
    setIsAuthenticated(true);
    setAuthLoading(false);
  };

  const currentIndex = stations.findIndex((s) => s.qr_id === stationRef || String(s.id) === stationRef);
  const previousStation = currentIndex > 0 ? stations[currentIndex - 1] : null;
  const nextStation = currentIndex >= 0 && currentIndex < stations.length - 1 ? stations[currentIndex + 1] : null;

  const shiftToNumber = (shiftValue: string) => {
    const num = Number(String(shiftValue).trim());
    return Number.isNaN(num) ? Number.MAX_SAFE_INTEGER : num;
  };

  const employees = station?.employees ?? [];

  const sortedEmployees = [...employees].sort((a, b) => {
    const diff = shiftToNumber(a.shift) - shiftToNumber(b.shift);
    if (diff === 0) return a.name.localeCompare(b.name);
    return shiftSort === "asc" ? diff : -diff;
  });

  if (!authChecked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
        <p className="text-slate-600">Checking session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.form
          onSubmit={handleAuthSubmit}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card w-full max-w-md"
        >
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-blue-100 border border-blue-300 flex items-center justify-center text-blue-900">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Secure QR Access</h1>
              <p className="text-sm text-slate-600">Log in once to view station QR pages.</p>
            </div>
          </div>

          {authError && (
            <div className="mb-4 bg-red-100 text-red-700 border border-red-300 px-3 py-2 rounded-lg text-sm">
              {authError}
            </div>
          )}

          <div className="space-y-3">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="glass-input"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="glass-input"
              required
            />
          </div>

          <button type="submit" disabled={authLoading} className="btn-primary w-full mt-5">
            {authLoading ? (
              <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Access Station
              </>
            )}
          </button>
        </motion.form>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
        <p className="text-slate-600">Loading station data...</p>
      </div>
    );
  }

  if (error || !station) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="glass-card text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">{error}</h2>
          <p className="text-slate-600">Please scan a valid QR code.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-10">
      <div className="bg-white border-b border-slate-300 px-6 pt-6 pb-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mb-8">
            <div className="inline-flex gap-2">
              <button
                type="button"
                onClick={() => previousStation && router.push(`/station/${encodeURIComponent(previousStation.qr_id || String(previousStation.id))}`)}
                disabled={!previousStation}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:border-[#152C73] hover:text-[#152C73] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <button
                type="button"
                onClick={() => nextStation && router.push(`/station/${encodeURIComponent(nextStation.qr_id || String(nextStation.id))}`)}
                disabled={!nextStation}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:border-[#152C73] hover:text-[#152C73] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => router.push("/dashboard/flow")}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#152C73] text-white hover:bg-[#0f1f54]"
            >
              <Workflow className="w-4 h-4" />
              Back to Flow
            </button>
          </div>

          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#152C73] mb-4">
              <MapPin className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-black text-[#152C73] tracking-tight mb-2">{station.name}</h1>
            <div className="inline-flex items-center gap-2 bg-white px-4 py-1.5 rounded-full border border-slate-300">
              <Clock3 className="w-4 h-4 text-[#152C73]" />
              <span className="text-sm font-medium text-slate-700">
                {lastUpload?.timestamp
                  ? `Actualizado: ${new Date(lastUpload.timestamp).toLocaleString("es-MX", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : "Sin actualización registrada"}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-3">
              Station {currentIndex >= 0 ? currentIndex + 1 : "-"} of {stations.length || "-"}
            </p>
          </motion.div>
        </div>
      </div>

      <div className="p-6 max-w-lg mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex justify-between items-center mb-6 px-2"
        >
          <h2 className="text-lg font-bold text-[#152C73]">Current Operators</h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShiftSort((prev) => (prev === "asc" ? "desc" : "asc"))}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:border-[#152C73] hover:text-[#152C73] text-sm"
            >
              <ArrowUpDown className="w-4 h-4" />
              Turno {shiftSort === "asc" ? "1→3" : "3→1"}
            </button>
            <span className="text-2xl font-black text-[#152C73]">{station.employees.length}</span>
          </div>
        </motion.div>

        {sortedEmployees.length === 0 ? (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="glass-card text-center py-10"
          >
            <Briefcase className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-lg text-slate-700 font-medium">No personnel assigned</p>
            <p className="text-sm text-slate-600 mt-1">Station is currently inactive.</p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {sortedEmployees.map((emp: any, idx: number) => (
              <motion.div
                key={emp.id}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.1 + (idx * 0.1) }}
                className="bg-white rounded-2xl p-5 border-l-4 border-l-[#152C73] border border-slate-300"
              >
                <div className="flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-300">
                    <User className="w-6 h-6 text-slate-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-slate-900">{emp.name}</h3>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-xs font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                        ID: {emp.payroll_id}
                      </span>
                      <span className="text-xs font-medium text-white bg-[#152C73] px-2 py-0.5 rounded border border-[#152C73]">
                        Turno {emp.shift}
                      </span>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-300">
                      <p className="text-xs text-slate-600 uppercase tracking-wider mb-1">Station Order ID</p>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-mono text-slate-800 font-medium">{emp.order_id}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
