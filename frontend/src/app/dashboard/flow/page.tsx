"use client";

import { useState, useEffect, useMemo } from "react";
import { Activity, Users, Settings2, ShieldCheck, Cpu, Search } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function VisualFlowPage() {
  const router = useRouter();
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const filteredStations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return stations;

    return stations.filter((station) => {
      const baseFields = [station.name, String(station.id), String(station.qr_id ?? "")]
        .join(" ")
        .toLowerCase();

      const employeeFields = (station.employees || [])
        .map((emp: any) => [emp.name, emp.payroll_id, emp.shift, emp.order_id, emp.assignment_id, emp.id].join(" "))
        .join(" ")
        .toLowerCase();

      return (baseFields + " " + employeeFields).includes(term);
    });
  }, [stations, search]);

  useEffect(() => {
    const fetchStations = async () => {
      try {
        const res = await api.get("/stations");
        setStations(res.data);
      } catch (err) {
        console.error("Failed to load stations", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStations();
    
    const interval = setInterval(fetchStations, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStationIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('assembly') || n.includes('ensamble')) return <Settings2 className="w-6 h-6" />;
    if (n.includes('quality') || n.includes('calidad')) return <ShieldCheck className="w-6 h-6" />;
    if (n.includes('tech') || n.includes('machine')) return <Cpu className="w-6 h-6" />;
    return <Activity className="w-6 h-6" />;
  };

  const goToStation = (station: any) => {
    if (!station.qr_id) return;
    router.push(`/station/${encodeURIComponent(station.qr_id)}`);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <header className="flex justify-between items-end mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[#152C73] mb-2">Production Line Flow</h1>
          <p className="text-slate-600">Live monitoring of station personnel assignments</p>
        </div>
      </header>

      <div className="max-w-xl">
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
        <div className="py-20 flex justify-center">
          <div className="w-10 h-10 border-2 border-[#152C73]/30 border-t-[#152C73] rounded-full animate-spin" />
        </div>
      ) : filteredStations.length === 0 ? (
        <div className="py-12 text-center glass-card">
          <p className="text-slate-600">No matches found for your search.</p>
        </div>
      ) : (
        <div className="relative">
          <div className="absolute top-1/2 left-10 right-10 h-0.5 bg-slate-300 -translate-y-1/2 z-0 hidden lg:block" />
          
          <div className="flex flex-col lg:flex-row flex-wrap gap-8 justify-center items-center relative z-10">
            {filteredStations.map((station, idx) => {
              // Deduplicate employees by ID to avoid counting the same operator multiple times
              const uniqueEmployees = (station.employees || []).filter((emp: any, index: number, self: any[]) =>
                index === self.findIndex((e: any) => e.id === emp.id)
              );
              return (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1 }}
                key={station.id}
                onClick={() => goToStation(station)}
                className="cursor-pointer transition-all duration-200 transform hover:-translate-y-1 hover:shadow-md"
              >
                <div className="bg-white border border-slate-300 rounded-2xl p-6 w-64 text-center shadow-sm hover:border-[#152C73]">
                  <div className="flex flex-col items-center">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${uniqueEmployees.length > 0 ? 'bg-[#152C73] text-white' : 'bg-slate-100 text-slate-500 border border-slate-300'}`}>
                      {getStationIcon(station.name)}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">{station.name}</h3>

                    <div className="mt-4 flex items-center justify-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
                      <Users className="w-4 h-4 text-slate-600" />
                      <span className="text-sm font-medium text-slate-700">
                        {uniqueEmployees.length} Operator{uniqueEmployees.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
