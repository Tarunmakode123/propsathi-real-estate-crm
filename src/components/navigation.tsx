'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Inbox, Building, Settings, LayoutDashboard, Key, LogOut } from 'lucide-react';

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [tenantName, setTenantName] = useState<string>('');

  useEffect(() => {
    const storedName = localStorage.getItem('tenantName');
    const storedId = localStorage.getItem('tenantId');
    if (!storedId) {
      router.push('/');
    } else {
      setTenantName(storedName || 'Unknown Workspace');
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('tenantId');
    localStorage.removeItem('tenantName');
    router.push('/');
  };

  const navItems = [
    { name: 'Unified Inbox', href: '/inbox', icon: Inbox },
    { name: 'Properties', href: '/listings', icon: LayoutDashboard },
    { name: 'Integrations', href: '/settings', icon: Settings },
  ];

  return (
    <nav className="bg-white border-b border-slate-100 text-slate-700 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            {/* Logo */}
            <div className="flex items-center gap-2 font-bold text-lg text-slate-900">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-600/10">
                <Building className="w-4 h-4 text-white" />
              </div>
              <span className="bg-gradient-to-r from-indigo-600 to-indigo-800 bg-clip-text text-transparent">
                PropSathi
              </span>
            </div>
 
            {/* Links */}
            <div className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
                      isActive
                        ? 'bg-slate-50 text-indigo-600 border-b-2 border-indigo-600 rounded-b-none'
                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
 
          {/* Right side: Tenant Indicator and Switch button */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-full text-xs text-slate-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {tenantName}
            </div>
 
            <button
              onClick={handleLogout}
              title="Switch Workspace"
              className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all flex items-center gap-1 text-xs font-medium border border-transparent hover:border-red-100"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Switch Workspace</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
