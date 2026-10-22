import React, { useState, useEffect } from 'react';
import { Pill, Plus, Search, Edit2, PackagePlus, CheckCircle2, AlertCircle, MapPin, Tag } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import SearchInput from '../components/ui/SearchInput';
import { query, run } from '../utils/db';

export default function Medicines() {
  const [medicines, setMedicines] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
  const [selectedMedForBatch, setSelectedMedForBatch] = useState(null);
  const [editingMed, setEditingMed] = useState(null);
  
  // Notification state
  const [successMsg, setSuccessMsg] = useState(null);
  const [formError, setFormError] = useState(null);

  // Medicine Form Data (with optional Opening Batch Stock)
  const [formData, setFormData] = useState({
    name: '',
    generic_name: '',
    manufacturer: '',
    hsn_code: '3004',
    gst_rate: '12',
    reorder_level: '15',
    unit: 'strip',
    barcode: '',
    // Opening Batch fields
    addInitialStock: true,
    batch_number: '',
    expiry_date: '',
    mrp: '',
    purchase_rate: '',
    selling_rate: '',
    initial_qty: '20',
    rack_location: 'Rack A-1',
  });

  // Dedicated Add Batch Form Data for existing medicines
  const [batchFormData, setBatchFormData] = useState({
    batch_number: '',
    expiry_date: '',
    mrp: '',
    purchase_rate: '',
    selling_rate: '',
    quantity: '20',
    rack_location: 'Rack A-1',
  });

  const loadMedicines = async () => {
    try {
      const data = await query(`
        SELECT m.*, COALESCE(SUM(b.quantity), 0) as total_stock, COUNT(b.id) as batch_count
        FROM medicines m
        LEFT JOIN inventory_batches b ON m.id = b.medicine_id AND b.is_quarantined = 0
        GROUP BY m.id
        ORDER BY m.id DESC
      `);
      setMedicines(data || []);
    } catch (err) {
      console.error('Error fetching medicines:', err);
    }
  };

  useEffect(() => {
    loadMedicines();
  }, []);

  const handleOpenAddModal = () => {
    setEditingMed(null);
    setFormError(null);
    const defaultExpiry = new Date();
    defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 2);
    const expStr = defaultExpiry.toISOString().split('T')[0];

    setFormData({
      name: '',
      generic_name: '',
      manufacturer: '',
      hsn_code: '3004',
      gst_rate: '12',
      reorder_level: '15',
      unit: 'strip',
      tablets_per_strip: '10',
      barcode: '',
      addInitialStock: true,
      batch_number: `B-${Math.floor(100 + Math.random() * 900)}`,
      expiry_date: expStr,
      mrp: '100.00',
      purchase_rate: '70.00',
      selling_rate: '90.00',
      initial_qty: '25',
      rack_location: 'Rack A-1',
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (med) => {
    setEditingMed(med);
    setFormError(null);
    setFormData({
      name: med.name || '',
      generic_name: med.generic_name || '',
      manufacturer: med.manufacturer || '',
      hsn_code: med.hsn_code || '3004',
      gst_rate: String(med.gst_rate || 12),
      reorder_level: String(med.reorder_level || 15),
      unit: med.unit || 'strip',
      tablets_per_strip: String(med.tablets_per_strip || 10),
      barcode: med.barcode || '',
      addInitialStock: false,
      batch_number: '',
      expiry_date: '',
      mrp: '',
      purchase_rate: '',
      selling_rate: '',
      initial_qty: '',
      rack_location: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenAddBatchModal = (med) => {
    setSelectedMedForBatch(med);
    const defaultExpiry = new Date();
    defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 1);

    setBatchFormData({
      batch_number: `B-${Math.floor(100 + Math.random() * 900)}`,
      expiry_date: defaultExpiry.toISOString().split('T')[0],
      mrp: '100.00',
      purchase_rate: '70.00',
      selling_rate: '90.00',
      quantity: '25',
      rack_location: 'Rack A-1',
    });
    setIsBatchModalOpen(true);
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveMedicine = async (e) => {
    if (e) e.preventDefault();
    setFormError(null);

    const trimmedName = formData.name ? formData.name.trim() : '';
    if (!trimmedName) {
      setFormError('Please enter the Medicine Trade Name.');
      return;
    }

    try {
      setIsSaving(true);
      const barcodeVal = (formData.barcode && formData.barcode.trim()) || null;
      const hsnVal = (formData.hsn_code && formData.hsn_code.trim()) || '3004';
      const gstVal = parseFloat(formData.gst_rate) || 12;
      const reorderVal = parseInt(formData.reorder_level, 10) || 15;
      const unitVal = formData.unit || 'strip';
      const tabPerStrip = parseInt(formData.tablets_per_strip, 10) || 10;

      if (editingMed) {
        await run(
          `UPDATE medicines SET 
            name = ?, generic_name = ?, manufacturer = ?, hsn_code = ?, 
            gst_rate = ?, reorder_level = ?, unit = ?, tablets_per_strip = ?, barcode = ?, updated_at = datetime('now', 'localtime')
          WHERE id = ?`,
          [
            trimmedName,
            (formData.generic_name && formData.generic_name.trim()) || null,
            (formData.manufacturer && formData.manufacturer.trim()) || null,
            hsnVal,
            gstVal,
            reorderVal,
            unitVal,
            tabPerStrip,
            barcodeVal,
            editingMed.id,
          ]
        );
        setSuccessMsg(`Updated "${trimmedName}" successfully!`);
      } else {
        // 1. Insert into medicines
        const medRes = await run(
          `INSERT INTO medicines (name, generic_name, manufacturer, hsn_code, gst_rate, reorder_level, unit, tablets_per_strip, barcode)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            trimmedName,
            (formData.generic_name && formData.generic_name.trim()) || null,
            (formData.manufacturer && formData.manufacturer.trim()) || null,
            hsnVal,
            gstVal,
            reorderVal,
            unitVal,
            tabPerStrip,
            barcodeVal,
          ]
        );

        let newMedId = medRes.lastInsertRowid;
        if (!newMedId || newMedId === 0) {
          const lastMed = await query('SELECT id FROM medicines WHERE name = ? ORDER BY id DESC LIMIT 1', [trimmedName]);
          if (lastMed && lastMed[0]) newMedId = lastMed[0].id;
        }

        // 2. If initial stock is enabled, insert opening batch
        if (formData.addInitialStock && newMedId) {
          const initQty = parseInt(formData.initial_qty, 10) || 25;
          const sellingRate = parseFloat(formData.selling_rate) || parseFloat(formData.mrp) || 90;
          const purchaseRate = parseFloat(formData.purchase_rate) || sellingRate * 0.75;
          const mrp = parseFloat(formData.mrp) || sellingRate;
          const batchNum = (formData.batch_number && formData.batch_number.trim()) || `B-${Math.floor(100 + Math.random() * 900)}`;
          
          let expDate = formData.expiry_date;
          if (!expDate) {
            const d = new Date();
            d.setFullYear(d.getFullYear() + 2);
            expDate = d.toISOString().split('T')[0];
          }

          await run(
            `INSERT INTO inventory_batches (
              medicine_id, batch_number, expiry_date, mrp, purchase_rate, selling_rate, quantity, rack_location
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              newMedId,
              batchNum,
              expDate,
              mrp,
              purchaseRate,
              sellingRate,
              initQty,
              (formData.rack_location && formData.rack_location.trim()) || 'Rack A-1',
            ]
          );
          setSuccessMsg(`Added "${trimmedName}" with opening stock of ${initQty} ${unitVal} (Batch ${batchNum})!`);
        } else {
          setSuccessMsg(`Added "${trimmedName}" to catalog!`);
        }
      }

      setIsModalOpen(false);
      await loadMedicines();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      console.error('Save error:', err);
      setFormError('Failed to save medicine: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBatch = async (e) => {
    if (e) e.preventDefault();
    if (!selectedMedForBatch) return;

    try {
      const qty = parseInt(batchFormData.quantity, 10) || 0;
      const sellingRate = parseFloat(batchFormData.selling_rate) || 0;
      const purchaseRate = parseFloat(batchFormData.purchase_rate) || 0;
      const mrp = parseFloat(batchFormData.mrp) || sellingRate;
      const batchNum = batchFormData.batch_number.trim() || `B-${Date.now().toString().slice(-4)}`;
      const expDate = batchFormData.expiry_date || '2027-12-31';

      await run(
        `INSERT INTO inventory_batches (
          medicine_id, batch_number, expiry_date, mrp, purchase_rate, selling_rate, quantity, rack_location
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          selectedMedForBatch.id,
          batchNum,
          expDate,
          mrp,
          purchaseRate,
          sellingRate,
          qty,
          batchFormData.rack_location.trim() || 'Rack A-1',
        ]
      );

      setSuccessMsg(`Added Batch #${batchNum} (${qty} ${selectedMedForBatch.unit}) for "${selectedMedForBatch.name}"!`);
      setIsBatchModalOpen(false);
      await loadMedicines();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      alert('Error adding batch: ' + err.message);
    }
  };

  const filtered = medicines.filter((m) => {
    const q = searchTerm.toLowerCase();
    return (
      m.name?.toLowerCase().includes(q) ||
      m.generic_name?.toLowerCase().includes(q) ||
      m.manufacturer?.toLowerCase().includes(q) ||
      m.barcode?.includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Pill className="w-5 h-5 text-sky-400" />
            <span>Medicines Catalog & Stock Master</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Master database of pharmaceutical trade names, formulations, GST slabs, and available batch inventory
          </p>
        </div>
        <Button variant="primary" icon={Plus} onClick={handleOpenAddModal}>
          Add Medicine & Opening Stock
        </Button>
      </div>

      {/* Success Notification Alert */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 text-xs flex items-center justify-between shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-400 hover:text-white font-mono text-sm px-2 py-0.5"
          >
            ×
          </button>
        </div>
      )}

      <div className="flex items-center gap-4">
        <SearchInput
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onClear={() => setSearchTerm('')}
          placeholder="Filter catalog by trade name, generic formula, manufacturer, or barcode..."
        />
      </div>

      {/* Medicines Table */}
      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Trade Name</th>
                <th className="py-3 px-4">Generic Composition</th>
                <th className="py-3 px-4">Manufacturer</th>
                <th className="py-3 px-4">HSN</th>
                <th className="py-3 px-4">GST Slab</th>
                <th className="py-3 px-4 text-center">Unit</th>
                <th className="py-3 px-4 text-right">In Stock</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No medicines found matching "{searchTerm}"
                  </td>
                </tr>
              ) : (
                filtered.map((med, idx) => (
                  <tr key={med.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-4 font-bold text-white">
                      <div>{med.name}</div>
                      {med.barcode && (
                        <span className="text-[10px] font-mono text-sky-400">
                          Barcode: {med.barcode}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-300 max-w-xs truncate">
                      {med.generic_name || '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-400">{med.manufacturer || '—'}</td>
                    <td className="py-3 px-4 font-mono text-slate-300">{med.hsn_code || '3004'}</td>
                    <td className="py-3 px-4">
                      <Badge variant="primary" size="sm">
                        {med.gst_rate}% GST
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-300 capitalize">
                      {med.unit}
                      {med.unit === 'strip' && (
                        <div className="text-[10px] text-sky-400 font-mono">
                          ({med.tablets_per_strip || 10} Tabs/Strip)
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-sm">
                      <span
                        className={
                          med.total_stock <= 0
                            ? 'text-rose-400'
                            : med.total_stock <= med.reorder_level
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }
                      >
                        {med.total_stock} {med.unit}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenAddBatchModal(med)}
                          className="px-2 py-1 rounded bg-blue-900/40 border border-blue-600/40 text-blue-300 hover:bg-blue-600 hover:text-white transition text-[11px] font-semibold flex items-center gap-1"
                          title="Add new batch / restock quantity"
                        >
                          <PackagePlus className="w-3.5 h-3.5" />
                          <span>Restock</span>
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(med)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                          title="Edit Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
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

      {/* Add / Edit Medicine Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingMed ? 'Edit Medicine Master' : 'Add New Medicine & Opening Stock'}
        subtitle="Catalog classification, taxation, and initial batch inventory"
        maxWidth="max-w-2xl"
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-rose-400 font-medium">{formError || ''}</span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                form="medicine-master-form"
                type="submit"
                isLoading={isSaving}
                onClick={handleSaveMedicine}
              >
                {editingMed ? 'Save Changes' : 'Save & Add to Catalog'}
              </Button>
            </div>
          </div>
        }
      >
        <form id="medicine-master-form" onSubmit={handleSaveMedicine} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-600/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Section 1: Medicine Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Medicine Trade Name"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Paracetamol 650mg or Augmentin 625"
              autoFocus
            />

            <Input
              label="Generic Formula / Composition"
              value={formData.generic_name}
              onChange={(e) => setFormData({ ...formData, generic_name: e.target.value })}
              placeholder="e.g. Paracetamol (650mg)"
            />

            <Input
              label="Manufacturer / Brand"
              value={formData.manufacturer}
              onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
              placeholder="e.g. Micro Labs, Cipla, Alkem"
            />

            <Input
              label="HSN Code"
              value={formData.hsn_code}
              onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })}
              placeholder="3004"
            />

            <Select
              label="GST Slab"
              value={formData.gst_rate}
              onChange={(e) => setFormData({ ...formData, gst_rate: e.target.value })}
              options={[
                { value: '0', label: '0% (Exempt)' },
                { value: '5', label: '5% (Essential Drugs)' },
                { value: '12', label: '12% (Standard Formulations)' },
                { value: '18', label: '18% (Supplements/Cosmetics)' },
              ]}
            />

            <Select
              label="Unit of Sale"
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              options={[
                { value: 'strip', label: 'Strip (with Tablets conversion)' },
                { value: 'tablet', label: 'Tablet (Loose)' },
                { value: 'bottle', label: 'Bottle (Syrup)' },
                { value: 'vial', label: 'Vial (Injection)' },
                { value: 'tube', label: 'Tube (Ointment)' },
                { value: 'box', label: 'Box' },
              ]}
            />

            {formData.unit === 'strip' && (
              <Input
                label="Tablets per Strip (Sub-Unit Pack Size)"
                type="number"
                min="1"
                required
                value={formData.tablets_per_strip}
                onChange={(e) => setFormData({ ...formData, tablets_per_strip: e.target.value })}
                placeholder="10"
              />
            )}

            <Input
              label="Min Re-order Buffer"
              type="number"
              value={formData.reorder_level}
              onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })}
              placeholder="15"
            />

            <Input
              label="Barcode (EAN/UPC)"
              value={formData.barcode}
              onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              placeholder="Scan product barcode (Optional)"
            />
          </div>

          {/* Section 2: Opening Batch & Stock (For new medicine) */}
          {!editingMed && (
            <div className="mt-4 pt-4 border-t border-slate-800 bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-sky-400 uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={formData.addInitialStock}
                    onChange={(e) => setFormData({ ...formData, addInitialStock: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span>Add Opening Batch & Inventory Stock Now</span>
                </label>
                <span className="text-[10px] text-slate-400">
                  Enables instant checkout in Retail POS
                </span>
              </div>

              {formData.addInitialStock && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                  <Input
                    label="Batch Number"
                    value={formData.batch_number}
                    onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                    placeholder="e.g. B-101"
                    required
                  />

                  <Input
                    label="Expiry Date"
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    required
                  />

                  <Input
                    label="Opening Quantity"
                    type="number"
                    min="1"
                    value={formData.initial_qty}
                    onChange={(e) => setFormData({ ...formData, initial_qty: e.target.value })}
                    required
                  />

                  <Input
                    label="MRP (₹)"
                    type="number"
                    step="0.01"
                    value={formData.mrp}
                    onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                    placeholder="100.00"
                    required
                  />

                  <Input
                    label="Purchase Rate (₹)"
                    type="number"
                    step="0.01"
                    value={formData.purchase_rate}
                    onChange={(e) => setFormData({ ...formData, purchase_rate: e.target.value })}
                    placeholder="70.00"
                  />

                  <Input
                    label="Selling Price (₹)"
                    type="number"
                    step="0.01"
                    value={formData.selling_rate}
                    onChange={(e) => setFormData({ ...formData, selling_rate: e.target.value })}
                    placeholder="90.00"
                    required
                  />

                  <div className="sm:col-span-3">
                    <Input
                      label="Rack / Shelf Location"
                      value={formData.rack_location}
                      onChange={(e) => setFormData({ ...formData, rack_location: e.target.value })}
                      placeholder="e.g. Rack A-1, Shelf 3"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
      </Modal>

      {/* Dedicated Add Batch / Restock Modal */}
      <Modal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        title={`Add Batch Stock: ${selectedMedForBatch?.name || ''}`}
        subtitle={`Add new inventory batch to medicine catalog (${selectedMedForBatch?.unit})`}
        maxWidth="max-w-xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsBatchModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveBatch}>
              Add Stock Batch
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveBatch} className="grid grid-cols-2 gap-3.5">
          <Input
            label="Batch Number"
            value={batchFormData.batch_number}
            onChange={(e) => setBatchFormData({ ...batchFormData, batch_number: e.target.value })}
            placeholder="e.g. B-202"
            required
            autoFocus
          />

          <Input
            label="Expiry Date"
            type="date"
            value={batchFormData.expiry_date}
            onChange={(e) => setBatchFormData({ ...batchFormData, expiry_date: e.target.value })}
            required
          />

          <Input
            label="Quantity to Add"
            type="number"
            min="1"
            value={batchFormData.quantity}
            onChange={(e) => setBatchFormData({ ...batchFormData, quantity: e.target.value })}
            required
          />

          <Input
            label="Rack Location"
            value={batchFormData.rack_location}
            onChange={(e) => setBatchFormData({ ...batchFormData, rack_location: e.target.value })}
            placeholder="e.g. Rack B-2"
          />

          <Input
            label="MRP (₹)"
            type="number"
            step="0.01"
            value={batchFormData.mrp}
            onChange={(e) => setBatchFormData({ ...batchFormData, mrp: e.target.value })}
            placeholder="100.00"
            required
          />

          <Input
            label="Selling Rate (₹)"
            type="number"
            step="0.01"
            value={batchFormData.selling_rate}
            onChange={(e) => setBatchFormData({ ...batchFormData, selling_rate: e.target.value })}
            placeholder="90.00"
            required
          />

          <div className="col-span-2">
            <Input
              label="Purchase Rate (₹)"
              type="number"
              step="0.01"
              value={batchFormData.purchase_rate}
              onChange={(e) => setBatchFormData({ ...batchFormData, purchase_rate: e.target.value })}
              placeholder="70.00"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
