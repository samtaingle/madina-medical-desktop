import React, { useState, useEffect } from 'react';
import { Truck, Plus, Calendar, FileText, CheckCircle2, IndianRupee, Building2, PackagePlus, Trash2, Eye, ShieldCheck } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import { query, run } from '../utils/db';

export default function Purchases({ onNavigate }) {
  const [purchases, setPurchases] = useState([]);
  const [distributors, setDistributors] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  // Detail Modal
  const [viewingPurchase, setViewingPurchase] = useState(null);
  const [purchaseItems, setPurchaseItems] = useState([]);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // New Vendor Form inside Purchases
  const [vendorForm, setVendorForm] = useState({
    name: '',
    dl_number: '',
    gstin: '',
    phone: '',
    address: '',
    balance_due: '0',
  });

  // Purchase Header Form
  const [formData, setFormData] = useState({
    distributor_id: '',
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    payment_status: 'unpaid',
    notes: '',
  });

  // Purchase Line Items (Stock Entry)
  const [items, setItems] = useState([
    {
      medicine_name: '',
      batch_number: '',
      expiry_date: '',
      unit: 'strip',
      tablets_per_strip: 10,
      quantity: 10,
      purchase_rate: 70,
      mrp: 100,
      selling_rate: 90,
      gst_rate: 12,
      rack_location: 'Rack A-1',
    },
  ]);

  const loadData = async () => {
    try {
      const dists = await query("SELECT * FROM distributors ORDER BY name ASC");
      setDistributors(dists || []);
      if (dists && dists.length > 0 && !formData.distributor_id) {
        setFormData((prev) => ({ ...prev, distributor_id: String(dists[0].id) }));
      }

      const purchList = await query(`
        SELECT p.*, d.name as distributor_name, d.phone as distributor_phone, d.dl_number as distributor_dl, d.gstin as distributor_gstin
        FROM purchases p
        JOIN distributors d ON p.distributor_id = d.id
        ORDER BY p.id DESC
      `);
      setPurchases(purchList || []);
    } catch (err) {
      console.error('Error loading purchases:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddItem = () => {
    const defaultExp = new Date();
    defaultExp.setFullYear(defaultExp.getFullYear() + 2);
    setItems([
      ...items,
      {
        medicine_name: '',
        batch_number: `B-${Math.floor(100 + Math.random() * 900)}`,
        expiry_date: defaultExp.toISOString().split('T')[0],
        unit: 'strip',
        tablets_per_strip: 10,
        quantity: 10,
        purchase_rate: 70,
        mrp: 100,
        selling_rate: 90,
        gst_rate: 12,
        rack_location: 'Rack A-1',
      },
    ]);
  };

  const handleRemoveItem = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  // Calculations
  const subtotal = items.reduce((acc, it) => acc + (parseFloat(it.purchase_rate) || 0) * (parseFloat(it.quantity) || 0), 0);
  const taxTotal = items.reduce((acc, it) => {
    const lineTotal = (parseFloat(it.purchase_rate) || 0) * (parseFloat(it.quantity) || 0);
    return acc + (lineTotal * (parseFloat(it.gst_rate) || 0)) / 100;
  }, 0);
  const finalAmount = subtotal + taxTotal;

  const handleSaveVendor = async (e) => {
    if (e) e.preventDefault();
    if (!vendorForm.name.trim()) {
      alert('Please enter Vendor Name');
      return;
    }
    try {
      const res = await run(
        `INSERT INTO distributors (name, dl_number, gstin, phone, address, balance_due)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          vendorForm.name.trim(),
          vendorForm.dl_number.trim() || null,
          vendorForm.gstin.trim() || null,
          vendorForm.phone.trim() || null,
          vendorForm.address.trim() || null,
          parseFloat(vendorForm.balance_due) || 0,
        ]
      );
      const newId = res.lastInsertRowid;
      setIsVendorModalOpen(false);
      await loadData();
      if (newId) {
        setFormData((prev) => ({ ...prev, distributor_id: String(newId) }));
      }
      setNotification(`Vendor "${vendorForm.name.trim()}" created successfully!`);
      setTimeout(() => setNotification(null), 4000);
    } catch (err) {
      alert('Error saving vendor: ' + err.message);
    }
  };

  const handleSavePurchase = async (e) => {
    if (e) e.preventDefault();
    if (!formData.distributor_id) {
      alert('Please select a Distributor/Vendor.');
      return;
    }

    // Validate items
    const validItems = items.filter((it) => it.medicine_name.trim());
    if (validItems.length === 0) {
      alert('Please enter at least one medicine item with name.');
      return;
    }

    try {
      // 1. Insert Purchase Header
      const purchRes = await run(
        `INSERT INTO purchases (distributor_id, invoice_number, invoice_date, subtotal, tax_total, final_amount, payment_status, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          parseInt(formData.distributor_id, 10),
          formData.invoice_number.trim() || `PUR-${Date.now().toString().slice(-6)}`,
          formData.invoice_date,
          subtotal,
          taxTotal,
          finalAmount,
          formData.payment_status,
          formData.notes,
        ]
      );

      const purchaseId = purchRes.lastInsertRowid;

      // 2. Insert Inward Items & Stock Batches
      for (const it of validItems) {
        const medName = it.medicine_name.trim();
        const batchNum = it.batch_number.trim() || `B-${Date.now().toString().slice(-4)}`;
        const expDate = it.expiry_date || '2028-12-31';
        const qty = parseInt(it.quantity, 10) || 1;
        const pRate = parseFloat(it.purchase_rate) || 0;
        const mrp = parseFloat(it.mrp) || pRate * 1.3;
        const sRate = parseFloat(it.selling_rate) || mrp;
        const gstRate = parseFloat(it.gst_rate) || 12;
        const tabletsPerStrip = parseInt(it.tablets_per_strip, 10) || 10;
        const lineTotal = pRate * qty;
        const lineGst = (lineTotal * gstRate) / 100;

        // Check if medicine exists or create it
        let medId = null;
        const foundMed = await query('SELECT id FROM medicines WHERE name = ? LIMIT 1', [medName]);
        if (foundMed && foundMed.length > 0) {
          medId = foundMed[0].id;
        } else {
          const newMedRes = await run(
            `INSERT INTO medicines (name, unit, tablets_per_strip, gst_rate, hsn_code, reorder_level)
             VALUES (?, ?, ?, ?, '3004', 15)`,
            [medName, it.unit || 'strip', tabletsPerStrip, gstRate]
          );
          medId = newMedRes.lastInsertRowid;
        }

        // Check if batch exists or create it
        let batchId = null;
        const foundBatch = await query(
          'SELECT id, quantity FROM inventory_batches WHERE medicine_id = ? AND batch_number = ? LIMIT 1',
          [medId, batchNum]
        );

        if (foundBatch && foundBatch.length > 0) {
          batchId = foundBatch[0].id;
          await run(
            `UPDATE inventory_batches 
             SET quantity = quantity + ?, mrp = ?, purchase_rate = ?, selling_rate = ?, expiry_date = ?, rack_location = ?
             WHERE id = ?`,
            [qty, mrp, pRate, sRate, expDate, it.rack_location || 'Rack A-1', batchId]
          );
        } else {
          const newBatchRes = await run(
            `INSERT INTO inventory_batches (medicine_id, batch_number, expiry_date, mrp, purchase_rate, selling_rate, quantity, rack_location)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [medId, batchNum, expDate, mrp, pRate, sRate, qty, it.rack_location || 'Rack A-1']
          );
          batchId = newBatchRes.lastInsertRowid;
        }

        // Record in purchase_items
        await run(
          `INSERT INTO purchase_items (purchase_id, medicine_id, batch_id, quantity, purchase_rate, mrp, selling_rate, expiry_date, batch_number, gst_amount, total_amount)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [purchaseId, medId, batchId, qty, pRate, mrp, sRate, expDate, batchNum, lineGst, lineTotal + lineGst]
        );
      }

      // 3. If unpaid, update distributor balance_due
      if (formData.payment_status === 'unpaid') {
        await run(
          "UPDATE distributors SET balance_due = balance_due + ? WHERE id = ?",
          [finalAmount, parseInt(formData.distributor_id, 10)]
        );
      }

      // 4. Ledger entry
      await run(
        `INSERT INTO accounts_ledger (entity_type, entity_id, transaction_type, amount, payment_mode, reference_no, notes)
         VALUES ('distributor', ?, 'purchase', ?, ?, ?, ?)`,
        [
          parseInt(formData.distributor_id, 10),
          finalAmount,
          formData.payment_status === 'paid' ? 'cash' : 'credit',
          formData.invoice_number,
          `Inward Stock Purchase Bill #${formData.invoice_number}`,
        ]
      );

      setIsModalOpen(false);
      setNotification(`Inward Purchase #${formData.invoice_number || purchaseId} saved & inventory stock updated!`);
      loadData();
      setTimeout(() => setNotification(null), 5000);
    } catch (err) {
      alert('Error creating purchase invoice: ' + err.message);
    }
  };

  const handleViewPurchase = async (p) => {
    setViewingPurchase(p);
    try {
      const pItems = await query(
        `SELECT pi.*, m.name as medicine_name, m.unit
         FROM purchase_items pi
         JOIN medicines m ON pi.medicine_id = m.id
         WHERE pi.purchase_id = ?`,
        [p.id]
      );
      setPurchaseItems(pItems || []);
      setIsDetailOpen(true);
    } catch (err) {
      alert('Error loading purchase details: ' + err.message);
    }
  };

  const selectedDist = distributors.find((d) => String(d.id) === String(formData.distributor_id));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Truck className="w-5 h-5 text-sky-400" />
            <span>Purchases (Inward Bills & Stock Entry)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Record supplier invoices, enter received medicine batches, assign DL numbers, and update inventory stock
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onNavigate && (
            <Button variant="secondary" onClick={() => onNavigate('vendors')} icon={Building2}>
              Vendors Master
            </Button>
          )}
          <Button variant="outline" icon={Building2} onClick={() => setIsVendorModalOpen(true)}>
            + New Vendor
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => setIsModalOpen(true)}>
            + New Inward Purchase
          </Button>
        </div>
      </div>

      {notification && (
        <div className="p-3 rounded-xl bg-emerald-950 border border-emerald-500 text-emerald-300 text-xs flex items-center gap-2 shadow-lg animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Purchases Table */}
      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Supplier / Vendor</th>
                <th className="py-3 px-4">Vendor DL No.</th>
                <th className="py-3 px-4">Supplier Bill #</th>
                <th className="py-3 px-4">Bill Date</th>
                <th className="py-3 px-4 text-right">Taxable Subtotal</th>
                <th className="py-3 px-4 text-right">GST Total</th>
                <th className="py-3 px-4 text-right">Final Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {purchases.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    No inward purchase entries recorded yet. Click "+ New Inward Purchase" to record supplier stock.
                  </td>
                </tr>
              ) : (
                purchases.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-4 font-bold text-white">
                      <div>{p.distributor_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{p.distributor_phone || p.distributor_gstin}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-emerald-400">
                      {p.distributor_dl || <span className="text-slate-500 italic">N/A</span>}
                    </td>
                    <td className="py-3 px-4 font-mono text-sky-400 font-semibold">
                      {p.invoice_number || 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-slate-300">{p.invoice_date}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">
                      ₹{Number(p.subtotal).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-400">
                      ₹{Number(p.tax_total).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white text-sm">
                      ₹{Number(p.final_amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge
                        variant={p.payment_status === 'paid' ? 'success' : 'warning'}
                        size="sm"
                        dot
                      >
                        {p.payment_status.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleViewPurchase(p)}
                        className="p-1.5 rounded-lg text-sky-400 hover:text-sky-300 hover:bg-slate-800 transition"
                        title="View Purchase Details"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Record Inward Purchase Modal with Itemized Stock Entry */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Record Inward Purchase & Stock Entry"
        subtitle="Enter supplier bill details and medicines received to immediately update pharmacy inventory"
        maxWidth="max-w-4xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <div className="text-xs font-mono text-slate-300">
              Total Inward Amount: <span className="font-bold text-emerald-400 text-sm">₹{finalAmount.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSavePurchase}>
                Save Inward Bill & Add Stock
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Supplier & Invoice Header */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs">
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-medium">Distributor / Vendor *</label>
                <button
                  type="button"
                  onClick={() => setIsVendorModalOpen(true)}
                  className="text-sky-400 hover:text-sky-300 text-[11px] font-semibold"
                >
                  + Add Vendor
                </button>
              </div>
              <select
                value={formData.distributor_id}
                onChange={(e) => setFormData({ ...formData, distributor_id: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {distributors.map((d) => (
                  <option key={d.id} value={String(d.id)}>
                    {d.name} {d.dl_number ? `(DL: ${d.dl_number})` : ''}
                  </option>
                ))}
              </select>
              {selectedDist && (
                <div className="mt-1 text-[10px] text-slate-400 flex items-center gap-2">
                  <span>DL: <strong className="text-emerald-400 font-mono">{selectedDist.dl_number || 'N/A'}</strong></span>
                  <span>|</span>
                  <span>GST: <strong className="text-sky-400 font-mono">{selectedDist.gstin || 'N/A'}</strong></span>
                </div>
              )}
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">Supplier Bill #</label>
              <input
                type="text"
                placeholder="e.g. INV-9021"
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">Bill Date</label>
              <input
                type="date"
                value={formData.invoice_date}
                onChange={(e) => setFormData({ ...formData, invoice_date: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Medicines Received Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                <PackagePlus className="w-4 h-4" />
                Medicines Received (Auto-adds to Inventory)
              </span>
              <Button type="button" variant="outline" size="sm" icon={Plus} onClick={handleAddItem}>
                + Add Medicine
              </Button>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-x-auto bg-slate-950">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-slate-900 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="p-2">Medicine Name *</th>
                    <th className="p-2 w-28">Batch #</th>
                    <th className="p-2 w-28">Exp (YYYY-MM)</th>
                    <th className="p-2 w-20">Unit</th>
                    <th className="p-2 w-16 text-center">Qty</th>
                    <th className="p-2 w-20 text-right">P.Rate (₹)</th>
                    <th className="p-2 w-20 text-right">MRP (₹)</th>
                    <th className="p-2 w-20 text-right">S.Rate (₹)</th>
                    <th className="p-2 w-16 text-center">GST %</th>
                    <th className="p-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/50">
                      <td className="p-1.5">
                        <input
                          type="text"
                          required
                          placeholder="e.g. Dolo 650"
                          value={it.medicine_name}
                          onChange={(e) => handleItemChange(idx, 'medicine_name', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          placeholder="Batch"
                          value={it.batch_number}
                          onChange={(e) => handleItemChange(idx, 'batch_number', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs font-mono"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="text"
                          placeholder="2028-12-31"
                          value={it.expiry_date}
                          onChange={(e) => handleItemChange(idx, 'expiry_date', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-white text-xs font-mono"
                        />
                      </td>
                      <td className="p-1.5">
                        <select
                          value={it.unit}
                          onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white text-xs"
                        >
                          <option value="strip">Strip</option>
                          <option value="tablet">Tablet</option>
                          <option value="bottle">Bottle</option>
                          <option value="vial">Vial</option>
                          <option value="tube">Tube</option>
                          <option value="box">Box</option>
                        </select>
                      </td>
                      <td className="p-1.5">
                        <input
                          type="number"
                          min="1"
                          value={it.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white text-xs text-center font-bold"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="number"
                          step="0.01"
                          value={it.purchase_rate}
                          onChange={(e) => handleItemChange(idx, 'purchase_rate', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white text-xs text-right font-mono"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="number"
                          step="0.01"
                          value={it.mrp}
                          onChange={(e) => handleItemChange(idx, 'mrp', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white text-xs text-right font-mono"
                        />
                      </td>
                      <td className="p-1.5">
                        <input
                          type="number"
                          step="0.01"
                          value={it.selling_rate}
                          onChange={(e) => handleItemChange(idx, 'selling_rate', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white text-xs text-right font-mono"
                        />
                      </td>
                      <td className="p-1.5">
                        <select
                          value={it.gst_rate}
                          onChange={(e) => handleItemChange(idx, 'gst_rate', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-1 py-1 text-white text-xs text-center"
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                        </select>
                      </td>
                      <td className="p-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          disabled={items.length === 1}
                          className="text-slate-500 hover:text-rose-400 p-1 disabled:opacity-30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment & Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800 text-xs">
            <div className="space-y-2">
              <Select
                label="Payment Status"
                value={formData.payment_status}
                onChange={(e) => setFormData({ ...formData, payment_status: e.target.value })}
                options={[
                  { value: 'unpaid', label: 'Unpaid (Add to Vendor Balance Due)' },
                  { value: 'paid', label: 'Paid Immediately (Cash/Bank)' },
                ]}
              />
              <Input
                label="Notes / Delivery Challan"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional delivery or batch notes"
              />
            </div>

            <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Taxable Value:</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>GST Tax Total:</span>
                <span>₹{taxTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-white text-sm pt-2 border-t border-slate-800">
                <span>Final Inward Bill:</span>
                <span className="text-emerald-400">₹{finalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Quick Add Vendor Modal */}
      <Modal
        isOpen={isVendorModalOpen}
        onClose={() => setIsVendorModalOpen(false)}
        title="Add New Vendor / Supplier"
        subtitle="Quickly register a pharmaceutical distributor with DL Number and GST credentials"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setIsVendorModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveVendor}>
              Save Vendor
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveVendor} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="sm:col-span-2">
            <Input
              label="Distributor / Vendor Name *"
              required
              value={vendorForm.name}
              onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
              placeholder="e.g. Al-Shifa Pharma Distributors"
              autoFocus
            />
          </div>

          <Input
            label="Drug License Number (DL No.) *"
            value={vendorForm.dl_number}
            onChange={(e) => setVendorForm({ ...vendorForm, dl_number: e.target.value })}
            placeholder="e.g. 20B-12345 / 21B-67890"
          />

          <Input
            label="GSTIN"
            value={vendorForm.gstin}
            onChange={(e) => setVendorForm({ ...vendorForm, gstin: e.target.value })}
            placeholder="e.g. 27AAAAA0000A1Z5"
          />

          <Input
            label="Phone / Mobile"
            value={vendorForm.phone}
            onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
            placeholder="e.g. 9826011223"
          />

          <Input
            label="Address"
            value={vendorForm.address}
            onChange={(e) => setVendorForm({ ...vendorForm, address: e.target.value })}
            placeholder="Market, City"
          />
        </form>
      </Modal>

      {/* View Purchase Details Modal */}
      <Modal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={`Purchase Bill #${viewingPurchase?.invoice_number || ''}`}
        subtitle={`From: ${viewingPurchase?.distributor_name || ''} (DL: ${viewingPurchase?.distributor_dl || 'N/A'}) on ${viewingPurchase?.invoice_date || ''}`}
        maxWidth="max-w-3xl"
        footer={
          <Button variant="secondary" onClick={() => setIsDetailOpen(false)}>
            Close
          </Button>
        }
      >
        {viewingPurchase && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-400 block">Vendor</span>
                <span className="font-bold text-white">{viewingPurchase.distributor_name}</span>
                <span className="text-[10px] text-emerald-400 block font-mono">DL: {viewingPurchase.distributor_dl || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Bill Date</span>
                <span className="text-slate-200">{viewingPurchase.invoice_date}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Payment Status</span>
                <span className="font-bold text-amber-400 uppercase">{viewingPurchase.payment_status}</span>
              </div>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-950 border-b border-slate-800 text-slate-400">
                  <tr>
                    <th className="p-2.5">Medicine</th>
                    <th className="p-2.5">Batch</th>
                    <th className="p-2.5">Expiry</th>
                    <th className="p-2.5 text-center">Qty</th>
                    <th className="p-2.5 text-right">P.Rate</th>
                    <th className="p-2.5 text-right">MRP</th>
                    <th className="p-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {purchaseItems.map((it, idx) => (
                    <tr key={idx}>
                      <td className="p-2.5 font-semibold text-white">{it.medicine_name}</td>
                      <td className="p-2.5 font-mono text-sky-400">{it.batch_number}</td>
                      <td className="p-2.5 text-slate-300">{it.expiry_date}</td>
                      <td className="p-2.5 text-center font-bold">{it.quantity}</td>
                      <td className="p-2.5 text-right font-mono">₹{Number(it.purchase_rate).toFixed(2)}</td>
                      <td className="p-2.5 text-right font-mono">₹{Number(it.mrp).toFixed(2)}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-emerald-400">₹{Number(it.total_amount).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-right text-sm font-mono font-bold text-white pt-2">
              Grand Total: <span className="text-emerald-400">₹{Number(viewingPurchase.final_amount).toFixed(2)}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
