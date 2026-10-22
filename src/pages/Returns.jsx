import React, { useState } from 'react';
import { RotateCcw, Search, AlertOctagon, CheckCircle2, ArrowRight, IndianRupee } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import { query, run } from '../utils/db';

export default function Returns() {
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [foundInvoice, setFoundInvoice] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [returnQty, setReturnQty] = useState('1');
  const [returnReason, setReturnReason] = useState('patient_request');
  const [refundMode, setRefundMode] = useState('cash');
  const [returnSuccess, setReturnSuccess] = useState(null);

  const handleLookup = async (e) => {
    e.preventDefault();
    if (!invoiceQuery) return;

    try {
      const invs = await query(
        "SELECT * FROM sales_invoices WHERE invoice_number = ? LIMIT 1",
        [invoiceQuery.trim()]
      );

      if (!invs || invs.length === 0) {
        alert(`Invoice "${invoiceQuery}" not found.`);
        return;
      }

      const inv = invs[0];
      setFoundInvoice(inv);

      const items = await query(
        `SELECT si.*, m.name as medicine_name, m.unit, b.batch_number, b.expiry_date
         FROM sales_items si
         JOIN medicines m ON si.medicine_id = m.id
         JOIN inventory_batches b ON si.batch_id = b.id
         WHERE si.invoice_id = ?`,
        [inv.id]
      );
      setInvoiceItems(items || []);
      if (items && items.length > 0) {
        setSelectedItem(items[0]);
        setReturnQty('1');
      }
    } catch (err) {
      alert('Error looking up invoice: ' + err.message);
    }
  };

  const handleProcessReturn = async (e) => {
    e.preventDefault();
    const qty = parseInt(returnQty, 10);
    if (!foundInvoice || !selectedItem || !qty || qty <= 0) return;

    if (qty > selectedItem.quantity) {
      alert(`Cannot return more than purchased quantity (${selectedItem.quantity} ${selectedItem.unit}).`);
      return;
    }

    try {
      const unitRefund = selectedItem.total_amount / selectedItem.quantity;
      const totalRefund = unitRefund * qty;

      // 1. Insert into sales_returns (Triggers automatically update inventory or quarantine)
      await run(
        `INSERT INTO sales_returns (invoice_id, batch_id, medicine_id, returned_qty, refund_amount, reason, refund_mode)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          foundInvoice.id,
          selectedItem.batch_id,
          selectedItem.medicine_id,
          qty,
          totalRefund,
          returnReason,
          refundMode,
        ]
      );

      // 2. Record ledger transaction
      await run(
        `INSERT INTO accounts_ledger (entity_type, entity_id, transaction_type, amount, payment_mode, reference_no, notes)
         VALUES ('customer', ?, 'refund', ?, ?, ?, ?)`,
        [
          foundInvoice.id,
          totalRefund,
          refundMode,
          foundInvoice.invoice_number,
          `Return of ${qty} ${selectedItem.unit} of ${selectedItem.medicine_name} (${returnReason})`,
        ]
      );

      setReturnSuccess({
        medicineName: selectedItem.medicine_name,
        qty,
        unit: selectedItem.unit,
        refundAmount: totalRefund,
        refundMode,
        reason: returnReason,
      });

      // Reload items
      handleLookup(e);
    } catch (err) {
      alert('Error processing return: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-sky-400" />
          <span>Returns (S/R) & Customer Refunds</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Process customer returns, adjust batch inventory or quarantine damaged stock, and issue refunds
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Invoice Lookup */}
        <div className="lg:col-span-1 space-y-4">
          <Card title="Lookup Original Invoice">
            <form onSubmit={handleLookup} className="space-y-3">
              <Input
                label="Invoice Number"
                value={invoiceQuery}
                onChange={(e) => setInvoiceQuery(e.target.value)}
                placeholder="e.g. MM-2026-000001"
                required
              />
              <Button type="submit" variant="primary" className="w-full">
                Fetch Invoice
              </Button>
            </form>
          </Card>

          {foundInvoice && (
            <Card title="Invoice Summary">
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">Customer:</span>
                  <span className="font-bold text-white">{foundInvoice.customer_name || 'Walk-in'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Date:</span>
                  <span className="text-slate-300">{foundInvoice.created_at}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Original Total:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    ₹{Number(foundInvoice.final_amount).toFixed(2)}
                  </span>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Return Details */}
        <div className="lg:col-span-2">
          {foundInvoice && invoiceItems.length > 0 ? (
            <Card title="Select Item to Return">
              <div className="space-y-4">
                <div className="border border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Select</th>
                        <th className="py-2.5 px-3">Medicine</th>
                        <th className="py-2.5 px-3">Batch</th>
                        <th className="py-2.5 px-3 text-right">Sold Qty</th>
                        <th className="py-2.5 px-3 text-right">Unit Rate</th>
                        <th className="py-2.5 px-3 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {invoiceItems.map((item) => (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedItem(item)}
                          className={`cursor-pointer transition ${
                            selectedItem?.id === item.id ? 'bg-blue-600/20' : 'hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="py-2.5 px-3 text-center">
                            <input
                              type="radio"
                              name="returnItem"
                              checked={selectedItem?.id === item.id}
                              onChange={() => setSelectedItem(item)}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-white">
                            {item.medicine_name}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-sky-400">
                            {item.batch_number}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-200">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                            ₹{Number(item.unit_price).toFixed(2)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                            ₹{Number(item.total_amount).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {selectedItem && (
                  <form onSubmit={handleProcessReturn} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-4">
                    <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                      Return Action: {selectedItem.medicine_name}
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Input
                        label={`Return Quantity (Max: ${selectedItem.quantity})`}
                        type="number"
                        min="1"
                        max={selectedItem.quantity}
                        required
                        value={returnQty}
                        onChange={(e) => setReturnQty(e.target.value)}
                      />

                      <Select
                        label="Reason for Return"
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                        options={[
                          { value: 'patient_request', label: 'Patient Request (Good condition)' },
                          { value: 'damaged', label: 'Damaged / Broken Strip (Quarantine)' },
                          { value: 'wrong_medicine', label: 'Wrong Medicine Dispensed' },
                          { value: 'expired', label: 'Expired Product' },
                        ]}
                      />

                      <Select
                        label="Refund Mode"
                        value={refundMode}
                        onChange={(e) => setRefundMode(e.target.value)}
                        options={[
                          { value: 'cash', label: 'Cash Refund' },
                          { value: 'upi', label: 'UPI / Online Transfer' },
                          { value: 'credit', label: 'Customer Store Credit' },
                        ]}
                      />
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <div className="text-xs text-slate-300">
                        Refund Amount to Customer:{' '}
                        <span className="font-mono font-bold text-rose-400 text-sm">
                          ₹
                          {(
                            (selectedItem.total_amount / selectedItem.quantity) *
                            (parseInt(returnQty, 10) || 0)
                          ).toFixed(2)}
                        </span>
                      </div>
                      <Button type="submit" variant="danger">
                        Confirm Return & Refund
                      </Button>
                    </div>
                  </form>
                )}

                {returnSuccess && (
                  <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-600/40 text-emerald-300 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        Successfully returned {returnSuccess.qty} {returnSuccess.unit} of{' '}
                        {returnSuccess.medicineName}. Refund of ₹{returnSuccess.refundAmount.toFixed(2)}{' '}
                        issued via {returnSuccess.refundMode.toUpperCase()}.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card bodyClassName="py-16 text-center text-slate-400">
              <RotateCcw className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-sm">Search for an invoice number to begin return processing.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
