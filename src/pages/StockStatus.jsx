import React, { useState, useEffect } from 'react';
import { BarChart3, Search, AlertCircle, ShieldCheck, MapPin, Percent } from 'lucide-react';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import SearchInput from '../components/ui/SearchInput';
import { query } from '../utils/db';

export default function StockStatus() {
  const [batches, setBatches] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterExpiry, setFilterExpiry] = useState('all'); // 'all', 'near', 'expired'

  const loadBatches = async () => {
    try {
      const data = await query(`
        SELECT b.*, m.name as medicine_name, m.generic_name, m.unit, m.gst_rate
        FROM inventory_batches b
        JOIN medicines m ON b.medicine_id = m.id
        ORDER BY b.expiry_date ASC
      `);
      setBatches(data || []);
    } catch (err) {
      console.error('Error fetching stock status:', err);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const today = new Date();
  const sixtyDaysAhead = new Date();
  sixtyDaysAhead.setDate(today.getDate() + 60);

  const filtered = batches.filter((b) => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      b.medicine_name?.toLowerCase().includes(q) ||
      b.batch_number?.toLowerCase().includes(q) ||
      b.rack_location?.toLowerCase().includes(q);

    if (!matchSearch) return false;

    const expDate = new Date(b.expiry_date);
    if (filterExpiry === 'expired') return expDate < today;
    if (filterExpiry === 'near') return expDate >= today && expDate <= sixtyDaysAhead;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-sky-400" />
            <span>Stock Status & Batch Tracker</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time batch-wise inventory, rack locations, margin calculation, and expiry management
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setFilterExpiry('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              filterExpiry === 'all'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Batches ({batches.length})
          </button>
          <button
            onClick={() => setFilterExpiry('near')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              filterExpiry === 'near'
                ? 'bg-amber-600 text-white'
                : 'text-slate-400 hover:text-amber-400'
            }`}
          >
            Near Expiry (&lt;60d)
          </button>
          <button
            onClick={() => setFilterExpiry('expired')}
            className={`px-3 py-1.5 rounded-lg font-medium transition ${
              filterExpiry === 'expired'
                ? 'bg-rose-600 text-white'
                : 'text-slate-400 hover:text-rose-400'
            }`}
          >
            Expired
          </button>
        </div>
      </div>

      <SearchInput
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onClear={() => setSearchTerm('')}
        placeholder="Filter by medicine name, batch number, or rack location..."
      />

      {/* Stock Table */}
      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Medicine Name</th>
                <th className="py-3 px-4">Batch #</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4 text-center">Rack Location</th>
                <th className="py-3 px-4 text-right">Available Qty</th>
                <th className="py-3 px-4 text-right">MRP</th>
                <th className="py-3 px-4 text-right">Purchase Rate</th>
                <th className="py-3 px-4 text-right">Selling Rate</th>
                <th className="py-3 px-4 text-right">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No batch inventory records found.
                  </td>
                </tr>
              ) : (
                filtered.map((batch, idx) => {
                  const expDate = new Date(batch.expiry_date);
                  const isExpired = expDate < today;
                  const isNear = !isExpired && expDate <= sixtyDaysAhead;
                  const marginPct =
                    batch.purchase_rate > 0
                      ? (((batch.selling_rate - batch.purchase_rate) / batch.purchase_rate) * 100).toFixed(1)
                      : '0.0';

                  return (
                    <tr
                      key={batch.id}
                      className={`hover:bg-slate-800/40 transition ${
                        isExpired
                          ? 'bg-rose-950/20'
                          : isNear
                          ? 'bg-amber-950/20'
                          : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-white">{batch.medicine_name}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-xs">
                          {batch.generic_name}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-sky-400">
                        {batch.batch_number}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={isExpired ? 'danger' : isNear ? 'warning' : 'default'}
                          size="sm"
                          dot={isExpired || isNear}
                        >
                          {batch.expiry_date}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                          <MapPin className="w-3 h-3 text-sky-400" />
                          {batch.rack_location || '—'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-sm">
                        <span
                          className={
                            batch.quantity <= 10
                              ? 'text-rose-400'
                              : batch.quantity <= 25
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }
                        >
                          {batch.quantity} {batch.unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-300">
                        ₹{Number(batch.mrp).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-400">
                        ₹{Number(batch.purchase_rate).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">
                        ₹{Number(batch.selling_rate).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-emerald-400">
                        {marginPct}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
