import React, { useState, useEffect } from 'react';
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, DollarSign, Calendar, IndianRupee } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { query, run } from '../utils/db';

export default function Payment() {
  const [activeTab, setActiveTab] = useState('distributors'); // 'distributors' or 'expenses'
  const [distributors, setDistributors] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [isDistModalOpen, setIsDistModalOpen] = useState(false);
  const [isExpModalOpen, setIsExpModalOpen] = useState(false);

  const [distPayment, setDistPayment] = useState({
    distributor_id: '',
    amount: '',
    payment_mode: 'upi',
    reference_no: '',
    notes: '',
  });

  const [newExpense, setNewExpense] = useState({
    category: 'tea_snacks',
    amount: '',
    description: '',
    payment_mode: 'cash',
  });

  const loadData = async () => {
    try {
      const dists = await query("SELECT * FROM distributors ORDER BY balance_due DESC");
      setDistributors(dists || []);
      if (dists && dists.length > 0 && !distPayment.distributor_id) {
        setDistPayment((p) => ({ ...p, distributor_id: String(dists[0].id) }));
      }

      const expList = await query("SELECT * FROM expenses ORDER BY id DESC");
      setExpenses(expList || []);
    } catch (err) {
      console.error('Error loading payments data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRecordDistPayment = async (e) => {
    e.preventDefault();
    const amt = parseFloat(distPayment.amount);
    if (!distPayment.distributor_id || !amt || amt <= 0) return;

    try {
      const distId = parseInt(distPayment.distributor_id, 10);

      // 1. Record in accounts_ledger
      await run(
        `INSERT INTO accounts_ledger (entity_type, entity_id, transaction_type, amount, payment_mode, reference_no, notes)
         VALUES ('distributor', ?, 'payment', ?, ?, ?, ?)`,
        [distId, amt, distPayment.payment_mode, distPayment.reference_no, distPayment.notes]
      );

      // 2. Reduce distributor balance_due
      await run(
        "UPDATE distributors SET balance_due = MAX(0, balance_due - ?) WHERE id = ?",
        [amt, distId]
      );

      setIsDistModalOpen(false);
      setDistPayment({
        distributor_id: String(distributors[0]?.id || ''),
        amount: '',
        payment_mode: 'upi',
        reference_no: '',
        notes: '',
      });
      loadData();
    } catch (err) {
      alert('Error recording payment: ' + err.message);
    }
  };

  const handleRecordExpense = async (e) => {
    e.preventDefault();
    const amt = parseFloat(newExpense.amount);
    if (!amt || amt <= 0) return;

    try {
      // 1. Insert into expenses
      await run(
        `INSERT INTO expenses (category, amount, description, payment_mode)
         VALUES (?, ?, ?, ?)`,
        [newExpense.category, amt, newExpense.description, newExpense.payment_mode]
      );

      // 2. Insert into accounts_ledger
      await run(
        `INSERT INTO accounts_ledger (entity_type, entity_id, transaction_type, amount, payment_mode, notes)
         VALUES ('expense', NULL, 'expense', ?, ?, ?)`,
        [amt, newExpense.payment_mode, newExpense.description]
      );

      setIsExpModalOpen(false);
      setNewExpense({
        category: 'tea_snacks',
        amount: '',
        description: '',
        payment_mode: 'cash',
      });
      loadData();
    } catch (err) {
      alert('Error recording expense: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Wallet className="w-5 h-5 text-sky-400" />
            <span>Payments & Petty Cash Expenses</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Distributor bill disbursements, cash payouts, and store operational expense logging
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            icon={ArrowUpRight}
            onClick={() => setIsDistModalOpen(true)}
          >
            Pay Distributor
          </Button>
          <Button
            variant="secondary"
            icon={Plus}
            onClick={() => setIsExpModalOpen(true)}
          >
            Log Store Expense
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('distributors')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
            activeTab === 'distributors'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Distributor Balances & Payables
        </button>
        <button
          onClick={() => setActiveTab('expenses')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
            activeTab === 'expenses'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          Store Petty Cash Expenses ({expenses.length})
        </button>
      </div>

      {activeTab === 'distributors' ? (
        <Card bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4">#</th>
                  <th className="py-3 px-4">Distributor Company</th>
                  <th className="py-3 px-4">GSTIN</th>
                  <th className="py-3 px-4">Phone Number</th>
                  <th className="py-3 px-4">Address</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {distributors.map((d, idx) => (
                  <tr key={d.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-4 font-bold text-white text-sm">{d.name}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">{d.gstin || '—'}</td>
                    <td className="py-3 px-4 text-slate-300">{d.phone || '—'}</td>
                    <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{d.address || '—'}</td>
                    <td className="py-3 px-4 text-right font-black font-mono text-base text-rose-400">
                      ₹{Number(d.balance_due).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button
                        size="xs"
                        variant="primary"
                        onClick={() => {
                          setDistPayment((p) => ({ ...p, distributor_id: String(d.id) }));
                          setIsDistModalOpen(true);
                        }}
                      >
                        Disburse Payment
                      </Button>
                    </td>
                  </tr>
                ))}
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
                  <th className="py-3 px-4">Expense Date</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center">Payment Mode</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400">
                      No expenses logged yet.
                    </td>
                  </tr>
                ) : (
                  expenses.map((exp, idx) => (
                    <tr key={exp.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-3 px-4 text-slate-300">{exp.expense_date}</td>
                      <td className="py-3 px-4 font-semibold text-white capitalize">
                        {exp.category.replace('_', ' ')}
                      </td>
                      <td className="py-3 px-4 text-slate-300">{exp.description || '—'}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="default" size="sm">
                          {exp.payment_mode.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-black font-mono text-amber-400">
                        ₹{Number(exp.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pay Distributor Modal */}
      <Modal
        isOpen={isDistModalOpen}
        onClose={() => setIsDistModalOpen(false)}
        title="Record Distributor Payment"
        subtitle="Disburse funds to supplier and update ledger"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsDistModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleRecordDistPayment}>
              Confirm Payment
            </Button>
          </>
        }
      >
        <form onSubmit={handleRecordDistPayment} className="space-y-4">
          <Select
            label="Distributor"
            required
            value={distPayment.distributor_id}
            onChange={(e) => setDistPayment({ ...distPayment, distributor_id: e.target.value })}
            options={distributors.map((d) => ({
              value: String(d.id),
              label: `${d.name} (Current Due: ₹${d.balance_due})`,
            }))}
          />

          <Input
            label="Payment Amount (₹)"
            type="number"
            step="0.01"
            required
            value={distPayment.amount}
            onChange={(e) => setDistPayment({ ...distPayment, amount: e.target.value })}
            placeholder="0.00"
          />

          <Select
            label="Disbursement Mode"
            value={distPayment.payment_mode}
            onChange={(e) => setDistPayment({ ...distPayment, payment_mode: e.target.value })}
            options={[
              { value: 'upi', label: 'UPI / Net Banking' },
              { value: 'cash', label: 'Cash from Drawer' },
              { value: 'cheque', label: 'Bank Cheque' },
              { value: 'neft', label: 'NEFT / RTGS' },
            ]}
          />

          <Input
            label="UTR / Cheque / Reference No."
            value={distPayment.reference_no}
            onChange={(e) => setDistPayment({ ...distPayment, reference_no: e.target.value })}
            placeholder="Bank transaction ID or Cheque #"
          />

          <Input
            label="Payment Notes"
            value={distPayment.notes}
            onChange={(e) => setDistPayment({ ...distPayment, notes: e.target.value })}
            placeholder="Optional remarks"
          />
        </form>
      </Modal>

      {/* Log Expense Modal */}
      <Modal
        isOpen={isExpModalOpen}
        onClose={() => setIsExpModalOpen(false)}
        title="Log Operating Expense"
        subtitle="Record daily petty cash and maintenance expenses"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsExpModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleRecordExpense}>
              Record Expense
            </Button>
          </>
        }
      >
        <form onSubmit={handleRecordExpense} className="space-y-4">
          <Select
            label="Expense Category"
            value={newExpense.category}
            onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
            options={[
              { value: 'tea_snacks', label: 'Tea & Refreshments' },
              { value: 'electricity', label: 'Electricity & Utilities' },
              { value: 'rent', label: 'Store Rent' },
              { value: 'salary', label: 'Staff Salary & Advance' },
              { value: 'maintenance', label: 'Shop Maintenance & Repairs' },
              { value: 'stationery', label: 'Stationery & Printing Rolls' },
              { value: 'misc', label: 'Miscellaneous' },
            ]}
          />

          <Input
            label="Amount (₹)"
            type="number"
            step="0.01"
            required
            value={newExpense.amount}
            onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
            placeholder="0.00"
          />

          <Select
            label="Payment Mode"
            value={newExpense.payment_mode}
            onChange={(e) => setNewExpense({ ...newExpense, payment_mode: e.target.value })}
            options={[
              { value: 'cash', label: 'Cash (Drawer)' },
              { value: 'upi', label: 'UPI / Online' },
            ]}
          />

          <Input
            label="Description / Purpose"
            value={newExpense.description}
            onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
            placeholder="e.g. 5 Thermal paper rolls 80mm"
          />
        </form>
      </Modal>
    </div>
  );
}
