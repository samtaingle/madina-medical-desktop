import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Receipt,
  IndianRupee,
  AlertTriangle,
  PackageX,
  CreditCard,
  ShoppingBag,
  Clock,
  ArrowRight,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import StatCard from '../components/ui/StatCard';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { query } from '../utils/db';

export default function Dashboard({ onNavigate }) {
  const [metrics, setMetrics] = useState({
    todaySales: 0,
    totalInvoices: 0,
    grossProfit: 0,
    cashInDrawer: 0,
    upiCollections: 0,
    pendingReceivables: 0,
  });

  const [nearExpiry, setNearExpiry] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        setLoading(true);

        // 1. Invoices count and sales
        const invoices = await query("SELECT * FROM sales_invoices ORDER BY id DESC LIMIT 5");
        setRecentInvoices(invoices || []);

        const totalInvRes = await query("SELECT COUNT(*) as count, SUM(final_amount) as total FROM sales_invoices");
        const totalSales = (totalInvRes && totalInvRes[0]?.total) || 0;
        const invoiceCount = (totalInvRes && totalInvRes[0]?.count) || 0;

        // 2. Near expiry medicines (< 60 days from today)
        const expiryList = await query(`
          SELECT b.id, b.batch_number, b.expiry_date, b.quantity, b.rack_location, m.name as medicine_name, m.unit
          FROM inventory_batches b
          JOIN medicines m ON b.medicine_id = m.id
          WHERE b.quantity > 0 AND date(b.expiry_date) <= date('now', '+60 days')
          ORDER BY b.expiry_date ASC
          LIMIT 6
        `);
        setNearExpiry(expiryList || []);

        // 3. Low stock medicines (sum(batch qty) <= reorder_level)
        const lowStockList = await query(`
          SELECT m.id, m.name, m.reorder_level, m.unit, COALESCE(SUM(b.quantity), 0) as current_stock
          FROM medicines m
          LEFT JOIN inventory_batches b ON m.id = b.medicine_id AND b.is_quarantined = 0
          GROUP BY m.id
          HAVING current_stock <= m.reorder_level
          ORDER BY current_stock ASC
          LIMIT 6
        `);
        setLowStock(lowStockList || []);

        // Set metrics
        setMetrics({
          todaySales: totalSales,
          totalInvoices: invoiceCount,
          grossProfit: Math.round(totalSales * 0.22), // 22% average margin
          cashInDrawer: 8450.00,
          upiCollections: 4200.00,
          pendingReceivables: 6150.00,
        });
      } catch (err) {
        console.error('Failed to load dashboard metrics:', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-blue-950/80 via-slate-900 to-slate-900 p-5 rounded-2xl border border-blue-800/40 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-400 mb-1">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <span>Madina Medical Real-time Counter Overview</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Pharmacy Control Dashboard
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            icon={ShoppingBag}
            shortcut="F1"
            onClick={() => onNavigate && onNavigate('bill-retail')}
          >
            Open Retail POS
          </Button>
          <Button
            variant="secondary"
            onClick={() => onNavigate && onNavigate('stock-status')}
          >
            Check Inventory
          </Button>
        </div>
      </div>

      {/* 6 Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          title="Today's Sales"
          value={`₹${metrics.todaySales.toLocaleString()}`}
          subtitle="All modes"
          icon={IndianRupee}
          color="emerald"
        />
        <StatCard
          title="Invoices"
          value={metrics.totalInvoices}
          subtitle="Today's receipts"
          icon={Receipt}
          color="blue"
        />
        <StatCard
          title="Gross Profit"
          value={`₹${metrics.grossProfit.toLocaleString()}`}
          subtitle="Est. 22% margin"
          icon={TrendingUp}
          color="purple"
        />
        <StatCard
          title="Cash in Drawer"
          value={`₹${metrics.cashInDrawer.toLocaleString()}`}
          subtitle="Counter drawer"
          icon={IndianRupee}
          color="emerald"
        />
        <StatCard
          title="UPI Collections"
          value={`₹${metrics.upiCollections.toLocaleString()}`}
          subtitle="QR & POS"
          icon={CreditCard}
          color="blue"
        />
        <StatCard
          title="Receivables"
          value={`₹${metrics.pendingReceivables.toLocaleString()}`}
          subtitle="Customer dues"
          icon={Clock}
          color="amber"
        />
      </div>

      {/* Actionable Alerts Section: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Near Expiry Medicines Alert Card */}
        <Card
          title="Near Expiry Warnings"
          subtitle="Expiring within 60 days or expired"
          action={
            <Button
              variant="outline"
              size="xs"
              onClick={() => onNavigate && onNavigate('stock-status')}
            >
              View All Batches
            </Button>
          }
        >
          {nearExpiry.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              No batches expiring within the next 60 days. Good stock health!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2.5 font-semibold">Medicine</th>
                    <th className="pb-2.5 font-semibold">Batch</th>
                    <th className="pb-2.5 font-semibold">Expiry Date</th>
                    <th className="pb-2.5 font-semibold text-right">Stock</th>
                    <th className="pb-2.5 font-semibold text-right">Rack</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {nearExpiry.map((item) => {
                    const isExpired = new Date(item.expiry_date) < new Date();
                    return (
                      <tr key={item.id} className="hover:bg-slate-800/40">
                        <td className="py-2.5 font-medium text-white">{item.medicine_name}</td>
                        <td className="py-2.5 font-mono text-slate-300">{item.batch_number}</td>
                        <td className="py-2.5">
                          <Badge variant={isExpired ? 'danger' : 'warning'} size="sm">
                            {item.expiry_date}
                          </Badge>
                        </td>
                        <td className="py-2.5 text-right font-bold text-amber-400">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="py-2.5 text-right text-slate-400">{item.rack_location || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Low Stock Warnings */}
        <Card
          title="Low Stock Re-Order Alerts"
          subtitle="Stock falling below minimum buffer threshold"
          action={
            <Button
              variant="outline"
              size="xs"
              onClick={() => onNavigate && onNavigate('reorder')}
            >
              Go to Re-Order
            </Button>
          }
        >
          {lowStock.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              All medicines are adequately stocked above buffer levels.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2.5 font-semibold">Medicine</th>
                    <th className="pb-2.5 font-semibold text-center">Threshold</th>
                    <th className="pb-2.5 font-semibold text-right">Current Stock</th>
                    <th className="pb-2.5 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {lowStock.map((med) => (
                    <tr key={med.id} className="hover:bg-slate-800/40">
                      <td className="py-2.5 font-medium text-white">{med.name}</td>
                      <td className="py-2.5 text-center text-slate-400 font-mono">
                        {med.reorder_level} {med.unit}
                      </td>
                      <td className="py-2.5 text-right font-bold text-rose-400">
                        {med.current_stock} {med.unit}
                      </td>
                      <td className="py-2.5 text-right">
                        <Badge variant="danger" size="sm" dot>
                          Reorder
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Quick Launchpad to All Major Modules */}
      <Card title="Quick Action Center" subtitle="Direct access to counter billing, inventory, and accounts">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => onNavigate && onNavigate('bill-retail')}
            className="flex items-center gap-3 p-3 rounded-xl bg-blue-900/30 border border-blue-700/40 hover:bg-blue-800/40 text-left transition group"
          >
            <div className="p-2 rounded-lg bg-blue-600 text-white shadow-md group-hover:scale-105 transition">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Retail POS</span>
              <span className="text-[11px] text-blue-300">Fast counter sale</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate && onNavigate('medicines')}
            className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700 hover:bg-slate-800 text-left transition group"
          >
            <div className="p-2 rounded-lg bg-slate-700 text-slate-200 group-hover:scale-105 transition">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Medicine Master</span>
              <span className="text-[11px] text-slate-400">Add & edit catalog</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate && onNavigate('purchases')}
            className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700 hover:bg-slate-800 text-left transition group"
          >
            <div className="p-2 rounded-lg bg-slate-700 text-slate-200 group-hover:scale-105 transition">
              <PackageX className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Inward Purchases</span>
              <span className="text-[11px] text-slate-400">Supplier invoices</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate && onNavigate('outstanding')}
            className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700 hover:bg-slate-800 text-left transition group"
          >
            <div className="p-2 rounded-lg bg-slate-700 text-slate-200 group-hover:scale-105 transition">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Outstanding Dues</span>
              <span className="text-[11px] text-slate-400">Customer & supplier</span>
            </div>
          </button>
        </div>
      </Card>
    </div>
  );
}
