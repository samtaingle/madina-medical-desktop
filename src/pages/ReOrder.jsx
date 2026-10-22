import React, { useState, useEffect } from 'react';
import { RefreshCw, Download, AlertTriangle, CheckCircle, Package } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { query } from '../utils/db';

export default function ReOrder() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadReorders = async () => {
    try {
      setLoading(true);
      const data = await query(`
        SELECT 
          m.id, 
          m.name, 
          m.generic_name, 
          m.manufacturer, 
          m.unit, 
          m.reorder_level,
          COALESCE(SUM(b.quantity), 0) as current_stock,
          (m.reorder_level * 2) - COALESCE(SUM(b.quantity), 0) as suggested_order_qty
        FROM medicines m
        LEFT JOIN inventory_batches b ON m.id = b.medicine_id AND b.is_quarantined = 0
        GROUP BY m.id
        HAVING current_stock <= m.reorder_level
        ORDER BY (m.reorder_level - current_stock) DESC
      `);
      setItems(data || []);
    } catch (err) {
      console.error('Error loading re-order list:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReorders();
  }, []);

  const exportCSV = () => {
    if (items.length === 0) return;
    const headers = ['Medicine Name,Manufacturer,Current Stock,Threshold Level,Suggested Order Qty,Unit'];
    const rows = items.map(
      (i) => `"${i.name}","${i.manufacturer || ''}",${i.current_stock},${i.reorder_level},${i.suggested_order_qty},"${i.unit}"`
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Madina_Medical_Purchase_Reorder_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-amber-400" />
            <span>Re-Order Planning & PO Generator</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Automated purchase recommendation algorithm based on current inventory vs re-order threshold
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" icon={RefreshCw} onClick={loadReorders}>
            Recalculate
          </Button>
          <Button
            variant="primary"
            icon={Download}
            onClick={exportCSV}
            disabled={items.length === 0}
          >
            Export Purchase Order (CSV)
          </Button>
        </div>
      </div>

      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Medicine Name</th>
                <th className="py-3 px-4">Manufacturer</th>
                <th className="py-3 px-4 text-center">Unit</th>
                <th className="py-3 px-4 text-right">Threshold Buffer</th>
                <th className="py-3 px-4 text-right">Current Available</th>
                <th className="py-3 px-4 text-right">Deficit</th>
                <th className="py-3 px-4 text-right">Suggested Order Qty</th>
                <th className="py-3 px-4 text-center">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    All medicines have sufficient stock. No replenishment required!
                  </td>
                </tr>
              ) : (
                items.map((item, idx) => {
                  const deficit = item.reorder_level - item.current_stock;
                  const isCritical = item.current_stock === 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-white">
                        <div>{item.name}</div>
                        <div className="text-[10px] text-slate-400">{item.generic_name}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-400">{item.manufacturer || '—'}</td>
                      <td className="py-3 px-4 text-center text-slate-300 capitalize">{item.unit}</td>
                      <td className="py-3 px-4 text-right font-mono text-slate-400">
                        {item.reorder_level}
                      </td>
                      <td className="py-3 px-4 text-right font-black font-mono text-rose-400">
                        {item.current_stock}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                        -{deficit}
                      </td>
                      <td className="py-3 px-4 text-right font-black font-mono text-emerald-400 text-sm">
                        {item.suggested_order_qty} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={isCritical ? 'danger' : 'warning'} size="sm" dot>
                          {isCritical ? 'CRITICAL (OUT)' : 'LOW STOCK'}
                        </Badge>
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
