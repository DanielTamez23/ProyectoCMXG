"use client";

import { useState, useEffect } from "react";
import { Activity, Users, Settings2, ShieldCheck, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import QRGenerator from "@/components/QRGenerator";
import { api } from "@/lib/api";

export default function VisualFlowPage() {
  const [stations, setStations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStation, setSelectedStation] = useState<any | null>(null);

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
    
    // Auto refresh every 10 seconds
    const interval = setInterval(fetchStations, 10000);
    return () => clearInterval(interval);
  }, []);

  // Icon mapping based on station name keywords (for better visuals)
  const getStationIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('assembly') || n.includes('ensamble')) return <Settings2 className="w-6 h-6" />;
    if (n.includes('quality') || n.includes('calidad')) return <ShieldCheck className="w-6 h-6" />;
    if (n.includes('tech') || n.includes('machine')) return <Cpu className="w-6 h-6" />;
    return <Activity className="w-6 h-6" />;
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <header className="flex justify-between items-end mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Production Line Flow</h1>
          <p className="text-slate-600">Live monitoring of station personnel assignments</p>
        </div>
      </header>

      {loading ? (
        <div className="py-20 flex justify-center">
          <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : stations.length === 0 ? (
        <div className="py-12 text-center glass-card">
          <p className="text-slate-600">No stations active. Please upload a schedule in the Overview tab.</p>
        </div>
      ) : (
        <div className="relative">
          {/* Decorative background connecting line for the flow */}
          <div className="absolute top-1/2 left-10 right-10 h-1 bg-slate-300 -translate-y-1/2 z-0 hidden lg:block" />
          
          <div className="flex flex-col lg:flex-row flex-wrap gap-8 justify-center items-center relative z-10">
            {stations.map((station, idx) => (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1 }}
                key={station.id}
                onClick={() => setSelectedStation(station)}
                className={`cursor-pointer transition-all duration-300 transform hover:-translate-y-2 ${selectedStation?.id === station.id ? 'ring-2 ring-blue-700 scale-105' : ''}`}
              >
                <div className="glass bg-white/90 backdrop-blur-md border border-slate-300 rounded-2xl p-6 w-64 text-center shadow-xl hover:shadow-blue-900/10 hover:border-blue-700/40 relative overflow-hidden group">
                  
                  {/* Subtle gradient background based on occupancy */}
                  <div className={`absolute inset-0 opacity-10 transition-opacity group-hover:opacity-20 ${station.employees.length > 0 ? 'bg-gradient-to-br from-blue-500 to-slate-900' : 'bg-slate-400'}`} />
                  
                  <div className="relative z-10 flex flex-col items-center">
                    <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 shadow-inner ${station.employees.length > 0 ? 'bg-blue-100 text-blue-800 border border-blue-300' : 'bg-slate-100 text-slate-500 border border-slate-300'}`}>
                      {getStationIcon(station.name)}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-1">{station.name}</h3>
                    
                    <div className="mt-4 flex items-center justify-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-300">
                      <Users className="w-4 h-4 text-slate-600" />
                      <span className="text-sm font-medium text-slate-700">
                        {station.employees.length} Operator{station.employees.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Arrow connecting to next station (lg screens) */}
                {idx < stations.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-6 -translate-y-1/2 text-slate-500">
                    →
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Slide-over panel for selected station details */}
      <AnimatePresence>
        {selectedStation && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedStation(null)}
              className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-slate-50 border-l border-slate-300 shadow-2xl z-50 overflow-y-auto"
            >
              <div className="p-8">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-900 border border-blue-300 text-sm font-medium mb-3">
                      Station Details
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">{selectedStation.name}</h2>
                  </div>
                  <button 
                    onClick={() => setSelectedStation(null)}
                    className="p-2 bg-slate-200 text-slate-700 hover:text-slate-900 rounded-full transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-6">
                  {/* QR Code Section */}
                  <div className="p-6 rounded-2xl glass border-slate-300 text-center">
                    <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4">Station Access QR</h3>
                    <QRGenerator stationId={selectedStation.id} stationName={selectedStation.name} />
                    <p className="text-xs text-slate-600 mt-4">Print and place this QR code at the physical station.</p>
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-slate-300 flex items-center justify-between">
                    <span className="text-slate-700 font-medium">Currently Assigned</span>
                    <span className="text-xl font-bold text-slate-900">{selectedStation.employees.length}</span>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-4">Assigned Personnel</h3>
                    
                    {selectedStation.employees.length === 0 ? (
                      <p className="text-slate-600 italic">No operators currently assigned.</p>
                    ) : (
                      <div className="space-y-3">
                        {selectedStation.employees.map((emp: any) => (
                          <div key={emp.id} className="p-4 rounded-xl glass border-slate-300 hover:border-slate-400 transition-colors">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="text-slate-900 font-medium text-lg">{emp.name}</h4>
                                <p className="text-slate-600 text-sm font-mono mt-1">ID: {emp.payroll_id}</p>
                              </div>
                              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-300">
                                {emp.shift}
                              </span>
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-300 flex justify-between items-center text-sm">
                              <span className="text-slate-600">Order ID:</span>
                              <span className="text-slate-800 font-mono">{emp.order_id}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
