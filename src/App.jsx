import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  History,
  ReceiptText,
  RotateCcw,
  Pill,
  BarChart3,
  Truck,
  RefreshCw,
  Wallet,
  Clock,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Printer,
  Settings,
  Database
} from 'lucide-react';
import { getOne } from './utils/db';

// Module Page Views
import Dashboard from './pages/Dashboard';
import BillRetail from './pages/BillRetail';
import SalesHistory from './pages/SalesHistory';
import Receipt from './pages/Receipt';
import Returns from './pages/Returns';
import Medicines from './pages/Medicines';
import StockStatus from './pages/StockStatus';
import Purchases from './pages/Purchases';
import Vendors from './pages/Vendors';
import ReOrder from './pages/ReOrder';
import Payment from './pages/Payment';
import Outstanding from './pages/Outstanding';
import SettingsModal from './components/settings/SettingsModal';
import { Building2 } from 'lucide-react';

const NAV_SECTIONS = [
  {
    category: 'MAIN',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: null }
    ]
  },
  {
    category: 'BILLING',
    items: [
      { id: 'bill-retail', label: 'Bill - Retail', icon: ShoppingCart, badge: 'POS', badgeColor: 'bg-emerald-500' },
      { id: 'sales-history', label: 'Sales History', icon: History, badge: null },
      { id: 'receipt', label: 'Receipt', icon: ReceiptText, badge: null },
      { id: 'returns', label: 'Returns (S/R)', icon: RotateCcw, badge: null }
    ]
  },
  {
    category: 'INVENTORY',
    items: [
      { id: 'medicines', label: 'Medicines', icon: Pill, badge: null },
      { id: 'stock-status', label: 'Stock Status', icon: BarChart3, badge: null },
      { id: 'purchases', label: 'Purchases (P/R)', icon: Truck, badge: null },
      { id: 'vendors', label: 'Vendors (Suppliers)', icon: Building2, badge: null },
      { id: 'reorder', label: 'Re-Order', icon: RefreshCw, badge: 'Alert', badgeColor: 'bg-amber-500' }
    ]
  },
  {
    category: 'ACCOUNTS',
    items: [
      { id: 'payment', label: 'Payment', icon: Wallet, badge: null },
      { id: 'outstanding', label: 'Outstanding', icon: Clock, badge: null }
    ]
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('bill-retail');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [storeInfo, setStoreInfo] = useState({
    name: 'Madina Medical',
    subtitle: 'Pharmacy & Billing',
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadSettings = async () => {
    try {
      const nameRes = await getOne("SELECT value FROM settings WHERE key = 'store_name'");
      const subRes = await getOne("SELECT value FROM settings WHERE key = 'store_subtitle'");
      if (nameRes && nameRes.value) {
        setStoreInfo({
          name: nameRes.value,
          subtitle: subRes ? subRes.value : 'Pharmacy & Billing',
        });
      }
    } catch (err) {
      console.warn('Using default store info:', err);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const renderActiveModule = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onNavigate={setActiveTab} />;
      case 'bill-retail':
        return <BillRetail />;
      case 'sales-history':
        return <SalesHistory onNavigate={setActiveTab} />;
      case 'receipt':
        return <Receipt />;
      case 'returns':
        return <Returns />;
      case 'medicines':
        return <Medicines />;
      case 'stock-status':
        return <StockStatus />;
      case 'purchases':
        return <Purchases onNavigate={setActiveTab} />;
      case 'vendors':
        return <Vendors onNavigate={setActiveTab} />;
      case 'reorder':
        return <ReOrder />;
      case 'payment':
        return <Payment />;
      case 'outstanding':
        return <Outstanding onNavigate={setActiveTab} />;
      default:
        return <Dashboard onNavigate={setActiveTab} />;
    }
  };

  const currentItem = NAV_SECTIONS.flatMap((s) => s.items).find((i) => i.id === activeTab);

  return (
    <div className="flex h-screen w-screen bg-slate-900 text-slate-100 font-sans select-none overflow-hidden">
      {/* ================= ROYAL-BLUE SIDEBAR ================= */}
      <aside
        className={`relative flex flex-col bg-[#0b192c] border-r border-[#1e3e62]/50 shadow-2xl transition-all duration-300 ease-in-out z-20 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Header Branding */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-[#1e3e62]/40 bg-gradient-to-b from-[#0f2847] to-[#0b192c]">
          <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-700 to-sky-500 text-white shadow-lg shadow-blue-500/20 shrink-0 ring-2 ring-blue-400/30">
            <Pill className="w-6 h-6 transform -rotate-45" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col min-w-0 transition-opacity duration-200">
              <span className="font-bold text-lg leading-tight tracking-wide text-white truncate">
                {storeInfo.name}
              </span>
              <span className="text-xs font-medium text-sky-400 tracking-wider uppercase truncate">
                {storeInfo.subtitle}
              </span>
            </div>
          )}
        </div>

        {/* Collapsible toggle button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-20 bg-blue-600 hover:bg-blue-500 text-white p-1 rounded-full shadow-md z-30 transition-transform active:scale-95"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 scrollbar-thin scrollbar-thumb-[#1e3e62] scrollbar-track-transparent">
          {NAV_SECTIONS.map((section) => (
            <div key={section.category} className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 pb-1 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  {section.category}
                </div>
              )}
              {isCollapsed && (
                <div className="border-t border-[#1e3e62]/40 my-2 mx-2"></div>
              )}
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 font-semibold'
                        : 'text-slate-300 hover:bg-[#1e3e62]/60 hover:text-white'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-110 ${
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-sky-400'
                      }`}
                    />
                    {!isCollapsed && (
                      <span className="truncate flex-1 text-left">{item.label}</span>
                    )}
                    {!isCollapsed && item.badge && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white shadow-sm ${
                          item.badgeColor || 'bg-blue-500'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer / Offline Status Indicator */}
        <div className="p-3 border-t border-[#1e3e62]/40 bg-[#081220]">
          <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg bg-[#0f2847]/80 border border-blue-500/20 text-xs text-slate-300">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            {!isCollapsed && (
              <div className="flex flex-col truncate">
                <span className="font-semibold text-emerald-400 leading-tight">Offline POS Active</span>
                <span className="text-[10px] text-slate-400">Local SQLite Engine</span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ================= MAIN CONTENT WORKSPACE ================= */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-950 text-slate-100 overflow-hidden">
        {/* Top App Bar */}
        <header className="h-16 border-b border-slate-800 bg-slate-900/90 backdrop-blur px-6 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <span>{currentItem?.label || 'Madina Medical'}</span>
            </h1>
            <span className="text-xs px-2.5 py-1 rounded-full bg-blue-950 text-blue-400 border border-blue-800/60 font-medium flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              Counter Billing Engine
            </span>
          </div>

          {/* Quick POS Hotkeys Bar */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700">
            <button
              onClick={() => setActiveTab('bill-retail')}
              className="flex items-center gap-1 hover:text-white transition cursor-pointer"
              title="F1 or Alt+S or Ctrl+F"
            >
              <span className="font-mono text-amber-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 font-bold">F1</span> Search
            </button>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => setActiveTab('bill-retail')}
              className="flex items-center gap-1 hover:text-white transition cursor-pointer"
              title="F2 or Alt+P"
            >
              <span className="font-mono text-emerald-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 font-bold">F2</span> Payment
            </button>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => setActiveTab('bill-retail')}
              className="flex items-center gap-1 hover:text-white transition cursor-pointer"
              title="F3 or Alt+Enter"
            >
              <span className="font-mono text-sky-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 font-bold">F3</span> Save & Print
            </button>
            <span className="text-slate-600">|</span>
            <button
              onClick={() => setActiveTab('bill-retail')}
              className="flex items-center gap-1 hover:text-white transition cursor-pointer"
              title="F4 or Ctrl+N"
            >
              <span className="font-mono text-purple-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 font-bold">F4</span> New Bill
            </button>
          </div>

          {/* Header Right Tools */}
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold font-mono text-slate-200">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="text-[11px] text-slate-400">
                {currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
            <div className="h-6 w-px bg-slate-800"></div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Store & Printer Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={() => setActiveTab('bill-retail')}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="POS Billing"
              >
                <ShoppingCart className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content Canvas */}
        <section className="flex-1 overflow-auto bg-slate-950 p-6">
          <div className="max-w-7xl mx-auto h-full">
            {renderActiveModule()}
          </div>
        </section>

        {/* Settings Modal */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          onSettingsUpdated={loadSettings}
        />
      </main>
    </div>
  );
}
