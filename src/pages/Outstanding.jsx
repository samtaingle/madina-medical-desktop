import React, { useState, useEffect } from 'react';
import { Clock, Users, Truck, AlertTriangle, ArrowRight, IndianRupee } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { query } from '../utils/db';

export default function Outstanding({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('customers'); // 'customers' or 'distributors'
  const [customerDues, setCustomerDues] = useState([]);
  const [distributorDues, setDistributorDues] = useState([]);

  useEffect(() => {
    async function loadOutstanding() {
      try {
        // Customer outstanding from invoices where payment_status != 'paid'
        const custs = await query(`
          SELECT 
            customer_name, 
            customer_phone, 
            COUNT(id) as invoice_count,
            SUM(final_amount - amount_paid) as total_due,
            MAX(created_at) as last_invoice_date
          FROM sales_invoices
          WHERE payment_status IN ('outstanding', 'partial')
          GROUP BY customer_phone
          ORDER BY total_due DESC
        `);
        setCustomerDues(custs || []);

        // Distributor payables
        const dists = await query(`
          SELECT name, phone, gstin, balance_due
          FROM distributors
          WHERE balance_due > 0
          ORDER BY balance_due DESC
        `);
        setDistributorDues(dists || []);
      } catch (err) {
        console.error('Error loading outstanding ledger:', err);
      }
    }

    loadOutstanding();
  }, []);

  const totalCustomerOutstanding = customerDues.reduce((acc, c) => acc + (c.total_due || 0), 0);
  const totalDistributorPayable = distributorDues.reduce((acc, d) => acc + (d.balance_due || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <span>Outstanding Dues & Aging Analysis</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Customer credit ledger, distributor accounts payable, and collection aging tracking
          </p>
        </div>
      </div>

      {/* Dues KPI Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-r from-amber-950/40 to-slate-900 border border-amber-500/30 rounded-xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider block">
              Total Customer Receivables
            </span>
            <span className="text-3xl font-black text-white mt-1 block">
              ₹{totalCustomerOutstanding.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 mt-1 block">
              {customerDues.length} Customers with pending credit
            </span>
          </div>
          <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-gradient-to-r from-rose-950/40 to-slate-900 border border-rose-500/30 rounded-xl p-5 shadow-lg flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-rose-400 uppercase tracking-wider block">
              Total Distributor Payables
            </span>
            <span className="text-3xl font-black text-white mt-1 block">
              ₹{totalDistributorPayable.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 mt-1 block">
              {distributorDues.length} Suppliers with pending bills
            </span>
          </div>
          <div className="p-3 bg-rose-500/20 text-rose-400 rounded-xl">
            <Truck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('customers')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
            activeTab === 'customers'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Customer Credit Ledger ({customerDues.length})
        </button>
        <button
          onClick={() => setActiveTab('distributors')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
            activeTab === 'distributors'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Distributor Accounts Payable ({distributorDues.length})
        </button>
      </div>

      {activeTab === 'customers' ? (
        <Card bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Customer Name</th>
                  <th className="py-3 px-4">Mobile Number</th>
                  <th className="py-3 px-4 text-center">Invoices</th>
                  <th className="py-3 px-4">Last Purchase Date</th>
                  <th className="py-3 px-4 text-right">Outstanding Amount</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {customerDues.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No customer credit balances found. All sales are paid in full!
                    </td>
                  </tr>
                ) : (
                  customerDues.map((cust, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-white text-sm">
                        {cust.customer_name || 'Walk-in Customer'}
                      </td>
                      <td className="py-3 px-4 font-mono text-sky-400">
                        {cust.customer_phone || '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="default" size="sm">
                          {cust.invoice_count} Bills
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-300">{cust.last_invoice_date}</td>
                      <td className="py-3 px-4 text-right font-black font-mono text-base text-amber-400">
                        ₹{Number(cust.total_due).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          size="xs"
                          variant="primary"
                          onClick={() => onNavigate && onNavigate('receipt')}
                        >
                          Collect Payment
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Distributor Company</th>
                  <th className="py-3 px-4">GSTIN</th>
                  <th className="py-3 px-4">Contact Phone</th>
                  <th className="py-3 px-4 text-right">Payable Balance</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {distributorDues.map((d, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-4 font-bold text-white text-sm">{d.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">{d.gstin || '—'}</td>
                    <td className="py-3 px-4 text-slate-300">{d.phone || '—'}</td>
                    <td className="py-3 px-4 text-right font-black font-mono text-base text-rose-400">
                      ₹{Number(d.balance_due).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button
                        size="xs"
                        variant="primary"
                        onClick={() => onNavigate && onNavigate('payment')}
                      >
                        Settle Balance
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
