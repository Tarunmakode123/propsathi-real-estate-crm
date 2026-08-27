'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, ArrowRight, ShieldAlert, Check } from 'lucide-react';

interface Tenant {
  id: string;
  name: string;
  createdAt: string;
}

export default function WorkspaceSelector() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          router.push('/inbox');
        } else {
          router.push('/login');
        }
      } catch {
        router.push('/login');
      }
    }
    checkAuth();
  }, []);

  const handleLaunch = () => {
    if (!selectedTenant) return;
    const tenant = tenants.find((t) => t.id === selectedTenant);
    if (!tenant) return;

    localStorage.setItem('tenantId', tenant.id);
    localStorage.setItem('tenantName', tenant.name);
    router.push('/inbox');
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl border border-slate-100 shadow-xl shadow-slate-200/30">
        <div className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            PropSathi CRM
          </h1>
          <p className="text-sm text-slate-500">
            AI-Powered Multi-Tenant Real Estate Inbox
          </p>
        </div>
 
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-xs text-slate-400">Loading your workspaces...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-red-800 font-bold">Error Loading Workspaces</h4>
              <p className="text-xs text-red-600 leading-relaxed">{error}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="mt-2 text-xs text-indigo-600 hover:text-indigo-700 underline font-semibold"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Select Workspace / Account
              </label>
              
              <div className="space-y-2">
                {tenants.map((tenant) => {
                  const isSelected = selectedTenant === tenant.id;
                  return (
                    <button
                      key={tenant.id}
                      onClick={() => setSelectedTenant(tenant.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/40 text-indigo-700 font-semibold'
                          : 'border-slate-100 hover:border-slate-200 bg-slate-50/50 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Building2 className={`w-5 h-5 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                        <div>
                          <p className="text-sm font-bold">{tenant.name}</p>
                          <p className="text-[10px] text-slate-400 font-medium">ID: {tenant.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center text-white">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
 
            <button
              onClick={handleLaunch}
              disabled={!selectedTenant}
              className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white rounded-xl font-semibold shadow-lg shadow-indigo-600/10 transition-all flex items-center justify-center gap-2 group"
            >
              Enter CRM Console
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        )}
        
        <div className="pt-4 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400 font-medium">
            Secure client account routing with strict data boundaries
          </p>
        </div>
      </div>
    </main>
  );
}
