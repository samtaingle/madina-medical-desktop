import React, { useState, useEffect } from 'react';
import { ReceiptText, Search, CheckCircle2, User, Phone, IndianRupee } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import { query, run } from '../utils/db';

export default function Receipt() {
  const [phoneSearch, setPhoneSearch] = useState('');
  const [outstandingInvoices, setOutstandingInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('cash');
  const [receiptSuccess, setReceiptSuccess] = useState(null);

  const handleSearchCustomer = async (e) => {
    if (e) e.preventDefault();
    if (!phoneSearch) return;

    try {
      const invoices = await query(
        `SELECT * FROM sales_invoices 
         WHERE (customer_phone LIKE ? OR customer_name LIKE ?) 
           AND payment_status IN ('outstanding', 'partial')
         ORDER BY id DESC`,
        [`%${phoneSearch}%`, `%${phoneSearch}%`]
      );
      setOutstandingInvoices(invoices || []);
      if (invoices && invoices.length > 0) {
        setSelectedInvoice(invoices[0]);
        setPaymentAmount(String(invoices[0].final_amount - invoices[0].amount_paid));
      } else {
        setSelectedInvoice(null);
      }
    } catch (err) {
      alert('Error searching outstanding customer: ' + err.message);
    }
  };

  const handleCollectPayment = async (e) => {
    e.preventDefault();
    const amt = parseFloat(paymentAmount);
    if (!selectedInvoice || !amt || amt <= 0) return;

    try {
      const remainingDue = selectedInvoice.final_amount - selectedInvoice.amount_paid;
      const newPaid = selectedInvoice.amount_paid + amt;
      const newStatus = newPaid >= selectedInvoice.final_amount ? 'paid' : 'partial';

      // 1. Update sales_invoices
      await run(
        "UPDATE sales_invoices SET amount_paid = ?, payment_status = ? WHERE id = ?",
        [newPaid, newStatus, selectedInvoice.id]
      );

      // 2. Insert into accounts_ledger
      await run(
        `INSERT INTO accounts_ledger (entity_type, entity_id, transaction_type, amount, payment_mode, reference_no, notes)
         VALUES ('customer', ?, 'payment', ?, ?, ?, ?)`,
        [
          selectedInvoice.id,
          amt,
          paymentMode,
          selectedInvoice.invoice_number,
          `Counter collection for bill ${selectedInvoice.invoice_number}`,
        ]
      );

      setReceiptSuccess({
        invoiceNumber: selectedInvoice.invoice_number,
        amountCollected: amt,
        balanceRemaining: Math.max(0, remainingDue - amt),
        customerName: selectedInvoice.customer_name,
      });

      handleSearchCustomer();
    } catch (err) {
      alert('Error collecting receipt payment: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <ReceiptText className="w-5 h-5 text-sky-400" />
          <span>Receipt — Customer Dues Collection</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Accept partial or full payments against outstanding customer balances and record ledger entries
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Customer Lookup */}
        <div className="lg:col-span-1 space-y-4">
          <Card title="Find Outstanding Customer">
            <form onSubmit={handleSearchCustomer} className="space-y-3">
              <Input
                label="Customer Mobile Number or Name"
                value={phoneSearch}
                onChange={(e) => setPhoneSearch(e.target.value)}
                placeholder="e.g. 9826011223 or Patient name"
                icon={Phone}
                required
              />
              <Button type="submit" variant="primary" className="w-full">
                Search Dues
              </Button>
            </form>

            {outstandingInvoices.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-800 space-y-2">
                <span className="text-xs font-semibold text-slate-400 block uppercase">
                  Pending Invoices ({outstandingInvoices.length})
                </span>
                {outstandingInvoices.map((inv) => {
                  const due = inv.final_amount - inv.amount_paid;
                  const isSelected = selectedInvoice?.id === inv.id;
                  return (
                    <div
                      key={inv.id}
                      onClick={() => {
                        setSelectedInvoice(inv);
                        setPaymentAmount(String(due));
                      }}
                      className={`p-3 rounded-xl border cursor-pointer transition ${
                        isSelected
                          ? 'bg-blue-600/20 border-blue-500 text-white'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-mono font-bold text-xs text-sky-400">
                          {inv.invoice_number}
                        </span>
                        <span className="font-mono font-black text-rose-400 text-sm">
                          ₹{due.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1">
                        Total: ₹{inv.final_amount} | Paid: ₹{inv.amount_paid}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right: Payment Collection Interface */}
        <div className="lg:col-span-2">
          {selectedInvoice ? (
            <Card
              title={`Collect Payment for Invoice ${selectedInvoice.invoice_number}`}
              subtitle={`Patient: ${selectedInvoice.customer_name || 'Walk-in'} | Phone: ${selectedInvoice.customer_phone || '—'}`}
            >
              <form onSubmit={handleCollectPayment} className="space-y-4">
                <div className="grid grid-cols-3 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 text-center font-mono">
                  <div>
                    <span className="text-xs text-slate-400 block">Total Bill</span>
                    <span className="text-lg font-bold text-white">
                      ₹{Number(selectedInvoice.final_amount).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Already Paid</span>
                    <span className="text-lg font-bold text-slate-300">
                      ₹{Number(selectedInvoice.amount_paid).toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Current Balance Due</span>
                    <span className="text-lg font-black text-rose-400">
                      ₹{(selectedInvoice.final_amount - selectedInvoice.amount_paid).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Collection Amount (₹)"
                    type="number"
                    step="0.01"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="Enter amount being received"
                  />

                  <Select
                    label="Collection Payment Mode"
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    options={[
                      { value: 'cash', label: 'Cash (Drawer)' },
                      { value: 'upi', label: 'UPI / QR Code' },
                      { value: 'card', label: 'Debit/Credit Card' },
                    ]}
                  />
                </div>

                <div className="pt-2">
                  <Button type="submit" variant="success" className="w-full" size="lg">
                    Confirm Collection & Generate Receipt
                  </Button>
                </div>
              </form>

              {receiptSuccess && (
                <div className="mt-4 p-4 rounded-xl bg-emerald-950/40 border border-emerald-600/40 text-emerald-300 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Successfully collected <strong>₹{receiptSuccess.amountCollected}</strong> for{' '}
                      <strong>{receiptSuccess.customerName}</strong> ({receiptSuccess.invoiceNumber}).
                    </span>
                  </div>
                  <span className="font-mono font-bold">
                    Remaining Balance: ₹{receiptSuccess.balanceRemaining.toFixed(2)}
                  </span>
                </div>
              )}
            </Card>
          ) : (
            <Card bodyClassName="py-16 text-center text-slate-400">
              <ReceiptText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-sm">Search for a customer by phone number to collect pending bill dues.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
