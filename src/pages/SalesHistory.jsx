import React, { useState, useEffect } from 'react';
import { History, Search, Eye, RotateCcw, Printer, Copy, FileText, Calendar, IndianRupee, Edit2, Trash2, Plus, CheckCircle2, User, Phone, UserCheck, CreditCard } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import SearchInput from '../components/ui/SearchInput';
import ThermalReceiptModal from '../components/billing/ThermalReceiptModal';
import { query, run } from '../utils/db';

export default function SalesHistory({ onNavigate }) {
  const [invoices, setInvoices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  // Edit Invoice State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [editCustomer, setEditCustomer] = useState({ name: '', phone: '', doctor: '' });
  const [editPaymentMode, setEditPaymentMode] = useState('cash');
  const [editDiscountAmount, setEditDiscountAmount] = useState(0);
  const [editItems, setEditItems] = useState([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Add Item to Edited Invoice
  const [editItemSearch, setEditItemSearch] = useState('');
  const [editItemResults, setEditItemResults] = useState([]);

  // Thermal Reprint State
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [reprintInvoice, setReprintInvoice] = useState(null);
  const [reprintItems, setReprintItems] = useState([]);

  const loadInvoices = async () => {
    try {
      const data = await query("SELECT * FROM sales_invoices ORDER BY id DESC LIMIT 100");
      setInvoices(data || []);
    } catch (err) {
      console.error('Error loading sales history:', err);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const handleReprintReceipt = async (inv) => {
    try {
      const items = await query(
        `SELECT si.*, m.name as medicine_name, m.unit, m.tablets_per_strip, b.batch_number, b.expiry_date
         FROM sales_items si
         JOIN medicines m ON si.medicine_id = m.id
         JOIN inventory_batches b ON si.batch_id = b.id
         WHERE si.invoice_id = ?`,
        [inv.id]
      );
      setReprintInvoice(inv);
      setReprintItems(items || []);
      setIsReceiptModalOpen(true);
    } catch (err) {
      alert('Error fetching items for receipt: ' + err.message);
    }
  };

  const handleViewInvoice = async (inv) => {
    setSelectedInvoice(inv);
    try {
      const items = await query(
        `SELECT si.*, m.name as medicine_name, m.unit, m.tablets_per_strip, b.batch_number, b.expiry_date
         FROM sales_items si
         JOIN medicines m ON si.medicine_id = m.id
         JOIN inventory_batches b ON si.batch_id = b.id
         WHERE si.invoice_id = ?`,
        [inv.id]
      );
      setInvoiceItems(items || []);
      setIsDetailOpen(true);
    } catch (err) {
      alert('Error loading invoice details: ' + err.message);
    }
  };

  // Open Edit Invoice Modal
  const handleOpenEdit = async (inv) => {
    try {
      const items = await query(
        `SELECT si.*, m.name as medicine_name, m.unit, m.tablets_per_strip, b.batch_number, b.expiry_date, b.selling_rate as batch_selling_rate
         FROM sales_items si
         JOIN medicines m ON si.medicine_id = m.id
         JOIN inventory_batches b ON si.batch_id = b.id
         WHERE si.invoice_id = ?`,
        [inv.id]
      );

      setEditingInvoice(inv);
      setEditCustomer({
        name: inv.customer_name || '',
        phone: inv.customer_phone || '',
        doctor: inv.doctor_name || '',
      });
      setEditPaymentMode(inv.payment_mode || 'cash');
      setEditDiscountAmount(Number(inv.discount_amount || 0));
      setEditItems(
        (items || []).map((it) => ({
          ...it,
          selling_rate: it.unit_price,
          unit_type: it.unit_type || 'strip',
          tablets_per_strip: it.tablets_per_strip || 10,
        }))
      );
      setEditItemSearch('');
      setEditItemResults([]);
      setIsEditModalOpen(true);
    } catch (err) {
      alert('Error opening invoice for edit: ' + err.message);
    }
  };

  // Search medicines when editing invoice
  useEffect(() => {
    if (!editItemSearch.trim()) {
      setEditItemResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const q = `%${editItemSearch.trim()}%`;
        const res = await query(
          `SELECT 
            m.id as medicine_id, m.name, m.generic_name, m.unit, m.gst_rate, m.tablets_per_strip,
            b.id as batch_id, b.batch_number, b.expiry_date, b.selling_rate, b.quantity as available_qty
           FROM medicines m
           JOIN inventory_batches b ON m.id = b.medicine_id
           WHERE (m.name LIKE ? OR m.generic_name LIKE ?) AND b.quantity > 0 AND b.is_quarantined = 0
           ORDER BY b.expiry_date ASC
           LIMIT 5`,
          [q, q]
        );
        setEditItemResults(res || []);
      } catch (err) {
        console.error(err);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [editItemSearch]);

  const handleAddMedToEdit = (med) => {
    const existingIndex = editItems.findIndex((it) => it.batch_id === med.batch_id);
    if (existingIndex >= 0) {
      const copy = [...editItems];
      copy[existingIndex].quantity += 1;
      setEditItems(copy);
    } else {
      setEditItems([
        ...editItems,
        {
          invoice_id: editingInvoice.id,
          batch_id: med.batch_id,
          medicine_id: med.medicine_id,
          medicine_name: med.name,
          batch_number: med.batch_number,
          expiry_date: med.expiry_date,
          quantity: 1,
          unit_price: med.selling_rate,
          selling_rate: med.selling_rate,
          gst_rate: med.gst_rate || 12,
          unit_type: 'strip',
          tablets_per_strip: med.tablets_per_strip || 10,
        },
      ]);
    }
    setEditItemSearch('');
    setEditItemResults([]);
  };

  const handleEditQtyChange = (index, delta) => {
    const copy = [...editItems];
    const newQty = Math.max(1, copy[index].quantity + delta);
    copy[index].quantity = newQty;
    setEditItems(copy);
  };

  const handleToggleEditUnit = (index) => {
    const copy = [...editItems];
    const item = copy[index];
    const newUnit = item.unit_type === 'strip' ? 'tablet' : 'strip';
    const tabPerStrip = item.tablets_per_strip || 10;
    
    // adjust price per unit
    let rate = item.selling_rate;
    if (newUnit === 'tablet') {
      rate = Number((item.selling_rate / tabPerStrip).toFixed(2));
    } else {
      rate = item.selling_rate;
    }

    copy[index] = {
      ...item,
      unit_type: newUnit,
      unit_price: rate,
    };
    setEditItems(copy);
  };

  const handleRemoveEditItem = (index) => {
    if (editItems.length === 1) {
      alert('Invoice must have at least one item. If the customer returned everything, use Returns (S/R).');
      return;
    }
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  // Edited Totals Calculation
  const editSubtotal = editItems.reduce((acc, it) => acc + (it.unit_price * it.quantity), 0);
  const editTaxTotal = editItems.reduce((acc, it) => {
    const lineTotal = it.unit_price * it.quantity;
    return acc + (lineTotal * (it.gst_rate || 0)) / (100 + (it.gst_rate || 0));
  }, 0);
  const editCgst = editTaxTotal / 2;
  const editSgst = editTaxTotal / 2;
  const editFinalAmount = Math.max(0, editSubtotal - editDiscountAmount);

  // Save Edited Invoice
  const handleSaveEditedInvoice = async () => {
    if (!editingInvoice) return;
    if (editItems.length === 0) {
      alert('Cannot save an empty invoice.');
      return;
    }

    setIsSavingEdit(true);
    try {
      const invId = editingInvoice.id;

      // 1. Delete old sales_items (Trigger trg_sales_item_stock_restore_on_delete restores previous stock automatically!)
      await run("DELETE FROM sales_items WHERE invoice_id = ?", [invId]);

      // 2. Insert new/updated sales_items (Trigger trg_sales_item_stock_decrement subtracts the new stock automatically!)
      for (const it of editItems) {
        const itemTotal = it.unit_price * it.quantity;
        const lineGst = (itemTotal * (it.gst_rate || 0)) / (100 + (it.gst_rate || 0));

        await run(
          `INSERT INTO sales_items (
            invoice_id, batch_id, medicine_id, quantity, unit_price, gst_rate, gst_amount, discount, total_amount, unit_type, tablets_per_strip
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            invId,
            it.batch_id,
            it.medicine_id,
            it.quantity,
            it.unit_price,
            it.gst_rate || 0,
            lineGst,
            0,
            itemTotal,
            it.unit_type || 'strip',
            it.tablets_per_strip || 10,
          ]
        );
      }

      // 3. Update sales_invoices header
      await run(
        `UPDATE sales_invoices 
         SET customer_name = ?, customer_phone = ?, doctor_name = ?, subtotal = ?, cgst_total = ?, sgst_total = ?, discount_amount = ?, final_amount = ?, payment_mode = ?, amount_paid = ?
         WHERE id = ?`,
        [
          editCustomer.name.trim() || 'Walk-in Customer',
          editCustomer.phone.trim() || null,
          editCustomer.doctor.trim() || null,
          editSubtotal,
          editCgst,
          editSgst,
          editDiscountAmount,
          editFinalAmount,
          editPaymentMode,
          editFinalAmount,
          invId,
        ]
      );

      // 4. Update accounts_ledger reference
      await run(
        `UPDATE accounts_ledger
         SET amount = ?, payment_mode = ?, notes = ?
         WHERE reference_no = ? AND transaction_type = 'sale'`,
        [
          editFinalAmount,
          editPaymentMode,
          `POS Sale to ${editCustomer.name.trim() || 'Walk-in'} (Edited)`,
          editingInvoice.invoice_number,
        ]
      );

      setIsEditModalOpen(false);
      setNotification(`Invoice #${editingInvoice.invoice_number} updated successfully! Inventory stock adjusted.`);
      loadInvoices();
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      alert('Error updating invoice: ' + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const filtered = invoices.filter((inv) => {
    const q = searchTerm.toLowerCase();
    return (
      inv.invoice_number?.toLowerCase().includes(q) ||
      inv.customer_name?.toLowerCase().includes(q) ||
      inv.customer_phone?.includes(q) ||
      inv.payment_mode?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-sky-400" />
            <span>Sales History & Invoices</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Complete retail sales ledger with itemized breakdown, tax audit, reprinting, and full post-billing edit
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => onNavigate && onNavigate('bill-retail')}
        >
          New Sale (POS)
        </Button>
      </div>

      {notification && (
        <div className="p-3 rounded-xl bg-emerald-950 border border-emerald-500 text-emerald-300 text-xs flex items-center gap-2 shadow-lg animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      <SearchInput
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onClear={() => setSearchTerm('')}
        placeholder="Search by invoice number (e.g. MM-2026-000001), customer phone, or name..."
      />

      {/* Invoices List Table */}
      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Customer Details</th>
                <th className="py-3 px-4">Doctor</th>
                <th className="py-3 px-4 text-center">Payment Mode</th>
                <th className="py-3 px-4 text-right">Tax (GST)</th>
                <th className="py-3 px-4 text-right">Final Amount</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No sales invoices recorded yet. Start billing in Bill - Retail to generate invoices!
                  </td>
                </tr>
              ) : (
                filtered.map((inv, idx) => (
                  <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-4 font-mono font-bold text-sky-400">
                      {inv.invoice_number}
                    </td>
                    <td className="py-3 px-4 text-slate-300">{inv.created_at}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-white">
                        {inv.customer_name || 'Walk-in Customer'}
                      </div>
                      {inv.customer_phone && (
                        <div className="text-[10px] font-mono text-slate-400">
                          {inv.customer_phone}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400">{inv.doctor_name || '—'}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant="default" size="sm">
                        {inv.payment_mode.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">
                      ₹{((inv.cgst_total || 0) + (inv.sgst_total || 0)).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 text-sm">
                      ₹{Number(inv.final_amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleViewInvoice(inv)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                          title="View Invoice Breakdown"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(inv)}
                          className="p-1.5 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-slate-800 transition"
                          title="Edit Invoice (Items, Qty, Patient, Payment)"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleReprintReceipt(inv)}
                          className="p-1.5 rounded-lg text-sky-400 hover:text-sky-300 hover:bg-slate-800 transition"
                          title="Print / View Receipt (A5, 80mm, 58mm)"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Invoice Breakdown Modal */}
      <Modal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={`Invoice Breakdown: ${selectedInvoice?.invoice_number || ''}`}
        subtitle={`Generated on ${selectedInvoice?.created_at || ''} for ${selectedInvoice?.customer_name || 'Walk-in Customer'}`}
        maxWidth="max-w-3xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs text-slate-400">
              Payment Status:{' '}
              <span className="font-semibold text-emerald-400 uppercase">
                {selectedInvoice?.payment_status}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                icon={Edit2}
                onClick={() => {
                  setIsDetailOpen(false);
                  handleOpenEdit(selectedInvoice);
                }}
              >
                Edit Invoice
              </Button>
              <Button
                variant="primary"
                icon={Printer}
                onClick={() => {
                  setIsDetailOpen(false);
                  handleReprintReceipt(selectedInvoice);
                }}
              >
                Print Receipt
              </Button>
            </div>
          </div>
        }
      >
        {selectedInvoice && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block">Customer</span>
                <span className="font-bold text-white">{selectedInvoice.customer_name || 'Walk-in'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Phone</span>
                <span className="font-mono text-slate-200">{selectedInvoice.customer_phone || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Doctor</span>
                <span className="text-slate-200">{selectedInvoice.doctor_name || 'Self'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Payment Mode</span>
                <span className="font-bold text-sky-400 uppercase">{selectedInvoice.payment_mode}</span>
              </div>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 border-b border-slate-800 text-slate-400 uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Item</th>
                    <th className="py-2.5 px-3">Batch</th>
                    <th className="py-2.5 px-3">Expiry</th>
                    <th className="py-2.5 px-3 text-center">Unit</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Rate</th>
                    <th className="py-2.5 px-3 text-right">Tax (GST)</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {invoiceItems.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3 font-semibold text-white">{item.medicine_name}</td>
                      <td className="py-2.5 px-3 font-mono text-sky-400">{item.batch_number}</td>
                      <td className="py-2.5 px-3 text-slate-300">{item.expiry_date}</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 uppercase font-mono">
                          {item.unit_type === 'tablet' ? 'Tablet' : 'Strip'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-white">{item.quantity}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">₹{Number(item.unit_price).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-400">₹{Number(item.gst_amount).toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                        ₹{Number(item.total_amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5 text-xs font-mono">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span>₹{Number(selectedInvoice.subtotal).toFixed(2)}</span>
              </div>
              {selectedInvoice.discount_amount > 0 && (
                <div className="flex justify-between text-rose-400">
                  <span>Discount:</span>
                  <span>-₹{Number(selectedInvoice.discount_amount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-400">
                <span>CGST + SGST:</span>
                <span>₹{((selectedInvoice.cgst_total || 0) + (selectedInvoice.sgst_total || 0)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-sm text-white pt-2 border-t border-slate-800">
                <span>Net Total:</span>
                <span className="text-emerald-400">₹{Number(selectedInvoice.final_amount).toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* EDIT INVOICE MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Invoice #${editingInvoice?.invoice_number || ''}`}
        subtitle="Modify customer details, change quantities, strip/tablet units, add or remove medicines"
        maxWidth="max-w-4xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs font-mono">
              Net Amount: <span className="text-emerald-400 font-bold text-sm">₹{editFinalAmount.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveEditedInvoice} isLoading={isSavingEdit}>
                Save & Update Invoice
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4 text-xs">
          {/* Customer Details */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
            <div>
              <label className="text-slate-400 block mb-1">Customer Name</label>
              <input
                type="text"
                value={editCustomer.name}
                onChange={(e) => setEditCustomer({ ...editCustomer, name: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Phone</label>
              <input
                type="text"
                value={editCustomer.phone}
                onChange={(e) => setEditCustomer({ ...editCustomer, phone: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Doctor Name</label>
              <input
                type="text"
                value={editCustomer.doctor}
                onChange={(e) => setEditCustomer({ ...editCustomer, doctor: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Payment Mode</label>
              <select
                value={editPaymentMode}
                onChange={(e) => setEditPaymentMode(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white uppercase font-bold"
              >
                <option value="cash">CASH</option>
                <option value="upi">UPI / QR</option>
                <option value="card">CARD</option>
                <option value="credit">CREDIT / KHATA</option>
              </select>
            </div>
          </div>

          {/* Quick Add Medicine to Invoice */}
          <div className="relative">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editItemSearch}
                onChange={(e) => setEditItemSearch(e.target.value)}
                placeholder="+ Add another medicine to this invoice (Search name or generic)..."
                className="w-full bg-slate-900 border border-blue-500/40 rounded-lg px-3 py-1.5 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {editItemResults.length > 0 && (
              <div className="absolute top-9 left-0 right-0 z-50 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden divide-y divide-slate-800">
                {editItemResults.map((med) => (
                  <div
                    key={med.batch_id}
                    onClick={() => handleAddMedToEdit(med)}
                    className="p-2 hover:bg-slate-800 cursor-pointer flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-white">{med.name}</span>
                      <span className="text-[10px] text-slate-400 ml-2">Batch: {med.batch_number} (Exp: {med.expiry_date})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-mono font-bold">₹{med.selling_rate}</span>
                      <span className="bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded font-semibold">+ Add</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase">
                <tr>
                  <th className="p-2.5">Medicine</th>
                  <th className="p-2.5">Batch</th>
                  <th className="p-2.5 text-center">Unit / Sub-Unit</th>
                  <th className="p-2.5 text-center">Quantity</th>
                  <th className="p-2.5 text-right">Rate (₹)</th>
                  <th className="p-2.5 text-right">Total (₹)</th>
                  <th className="p-2.5 text-center">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {editItems.map((it, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/50">
                    <td className="p-2.5 font-semibold text-white">{it.medicine_name}</td>
                    <td className="p-2.5 font-mono text-sky-400">{it.batch_number}</td>
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleEditUnit(idx)}
                        className={`text-[11px] font-bold px-2 py-0.5 rounded transition ${
                          it.unit_type === 'tablet'
                            ? 'bg-amber-950 text-amber-300 border border-amber-700/60'
                            : 'bg-blue-950 text-blue-300 border border-blue-700/60'
                        }`}
                        title="Click to toggle Strip vs Loose Tablets"
                      >
                        {it.unit_type === 'tablet' ? 'Tablet (Loose)' : 'Strip (Full)'}
                      </button>
                    </td>
                    <td className="p-2.5 text-center">
                      <div className="inline-flex items-center gap-1 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5">
                        <button
                          type="button"
                          onClick={() => handleEditQtyChange(idx, -1)}
                          className="text-slate-400 hover:text-white px-1 text-sm font-bold"
                        >
                          -
                        </button>
                        <span className="font-mono font-bold text-white px-1 min-w-[20px] text-center">
                          {it.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleEditQtyChange(idx, 1)}
                          className="text-slate-400 hover:text-white px-1 text-sm font-bold"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="p-2.5 text-right font-mono text-slate-300">₹{Number(it.unit_price).toFixed(2)}</td>
                    <td className="p-2.5 text-right font-mono font-bold text-emerald-400">
                      ₹{(it.unit_price * it.quantity).toFixed(2)}
                    </td>
                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveEditItem(idx)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                        title="Remove Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Discount & Net Total */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 grid grid-cols-2 gap-4">
            <div>
              <label className="text-slate-400 block mb-1">Discount Amount (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editDiscountAmount}
                onChange={(e) => setEditDiscountAmount(parseFloat(e.target.value) || 0)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white font-mono w-32"
              />
            </div>
            <div className="text-right space-y-1 font-mono">
              <div className="text-slate-400">Subtotal: ₹{editSubtotal.toFixed(2)}</div>
              {editDiscountAmount > 0 && <div className="text-rose-400">Discount: -₹{editDiscountAmount.toFixed(2)}</div>}
              <div className="text-white font-bold text-sm pt-1 border-t border-slate-800">
                Net Grand Total: <span className="text-emerald-400">₹{editFinalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Thermal & A5 Receipt Visualizer Modal */}
      <ThermalReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        invoice={reprintInvoice}
        items={reprintItems}
      />
    </div>
  );
}
