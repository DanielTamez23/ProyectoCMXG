"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Lock, User } from "lucide-react";
import { motion } from "framer-motion";
import { createSession, getAllowedUsers, getSession, saveSession } from "@/lib/auth";
import CarrierLogo from "@/components/CarrierLogo";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (session) {
      router.replace("/dashboard");
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    setTimeout(() => {
      const matchedUser = getAllowedUsers().find(
        (u) => u.username === username && u.password === password,
      );

      if (matchedUser) {
        saveSession(createSession(matchedUser.username, matchedUser.role));
        router.push("/dashboard");
      } else {
        setError("Invalid username or password");
        setIsLoading(false);
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#f1f5f9]">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-card w-full max-w-md animate-fade-in"
      >
        <div className="flex flex-col items-center mb-8">
          <CarrierLogo height={56} className="mb-5" />
          <h1 className="text-2xl font-bold tracking-tight text-[#152C73]">Station Flow</h1>
          <p className="text-slate-600 mt-2 text-center text-sm">Manage production personnel across all stations</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm text-center"
            >
              {error}
            </motion.div>
          )}
          
          <div className="space-y-2 relative">
            <label className="text-sm font-medium text-slate-700 ml-1">Username</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="glass-input pl-11"
                placeholder="Enter username"
                required
              />
            </div>
          </div>

          <div className="space-y-2 relative stagger-1">
            <label className="text-sm font-medium text-slate-700 ml-1">Password</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input pl-11"
                placeholder="Enter password"
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="btn-primary w-full mt-8 h-12"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                Sign In to Dashboard
              </>
            )}
          </button>
        </form>
        
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">Secure Production Management System v1.0</p>
        </div>
      </motion.div>
    </div>
  );
}
