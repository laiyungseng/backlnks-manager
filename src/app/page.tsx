'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function LandingPage() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleNavigate = (path: string) => {
    setIsNavigating(true);
    setTimeout(() => router.push(path), 600);
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 relative overflow-hidden transition-opacity duration-700 ${isNavigating ? 'opacity-0 scale-105' : 'opacity-100'}`}>
      {/* Ambient background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-purple-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-400/5 rounded-full blur-[150px]" />
      </div>

      {/* Subtle grid overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '60px 60px'
      }} />

      <div className="relative z-10 flex flex-col items-center px-6">
        {/* DF Logo */}
        <div className={`transition-all duration-1000 ease-out ${isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
          <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30 mb-8 relative group">
            <span className="text-5xl font-black text-white tracking-wider">DF</span>
            {/* Pulse ring */}
            <div className="absolute inset-0 rounded-2xl border-2 border-indigo-400/30 animate-ping" style={{ animationDuration: '3s' }} />
          </div>
        </div>

        {/* Branding text */}
        <div className={`text-center transition-all duration-1000 delay-300 ease-out ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight mb-3">
            Drive-Future
          </h1>
          <p className="text-lg sm:text-xl text-indigo-300/80 font-medium tracking-wide mb-2">
            Backlinks Tracker
          </p>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            A centralized platform for tracking and managing your SEO backlinks placement campaigns.
          </p>
        </div>

        {/* Divider */}
        <div className={`w-16 h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent my-10 transition-all duration-1000 delay-500 ${isLoaded ? 'opacity-100 w-24' : 'opacity-0 w-0'}`} />

        {/* Entry Buttons */}
        <div className={`grid grid-cols-2 gap-4 w-full max-w-md transition-all duration-1000 delay-700 ease-out ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <button
            onClick={() => handleNavigate('/login')}
            className="group relative px-6 py-4 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:from-indigo-500 hover:to-indigo-400 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
              Admin
            </span>
          </button>

          <button
            onClick={() => handleNavigate('/vendor')}
            className="group relative px-6 py-4 bg-white/5 backdrop-blur-sm text-white font-bold rounded-xl border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-black/10"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
              Vendor Portal
            </span>
          </button>

          <button
            onClick={() => handleNavigate('/client')}
            className="group relative px-6 py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:from-emerald-500 hover:to-emerald-400 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              Client Portal
            </span>
          </button>

          <button
            onClick={() => handleNavigate('/guest')}
            className="group relative px-6 py-4 bg-white/5 backdrop-blur-sm text-white font-bold rounded-xl border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0 shadow-lg shadow-black/10"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Guest
            </span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className={`absolute bottom-8 text-center text-xs text-slate-500 transition-all duration-1000 delay-1000 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}>
        &copy; {new Date().getFullYear()} Drive-Future &mdash; Internal SEO Management System
      </div>
    </div>
  );
}
