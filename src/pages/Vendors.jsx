import React, { useState, useEffect } from 'react';
import { Building2, Plus, Search, Edit2, Trash2, Phone, Mail, MapPin, FileText, Shield, IndianRupee, AlertCircle, CheckCircle2 } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import SearchInput from '../components/ui/SearchInput';
import { query, run } from '../utils/db';

export default function Vendors({ onNavigate }) {
  const [vendors, setVendors] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    dl_number: '',
    gstin: '',
    phone: '',
    email: '',
    address: '',
    balance_due: '0',
  });

  const loadVendors = async () => {
    try {
      const data = await query("SELECT * FROM distributors ORDER BY name ASC");
      setVendors(data || []);
    } catch (err) {
      console.error('Error loading vendors:', err);
    }
  };

  useEffect(() => {
    loadVendors();
  }, []);

  const handleOpenAdd = () => {
    setEditingVendor(null);
    setFormData({
      name: '',
      dl_number: '',
      gstin: '',
      phone: '',
      email: '',
      address: '',
      balance_due: '0',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name || '',
      dl_number: vendor.dl_number || '',
      gstin: vendor.gstin || '',
      phone: vendor.phone || '',
      email: vendor.email || '',
      address: vendor.address || '',
      balance_due: String(vendor.balance_due || 0),
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('Please enter Vendor / Supplier Name');
      return;
    }

    setIsSaving(true);
    try {
      if (editingVendor) {
        await run(
          `UPDATE distributors 
           SET name = ?, dl_number = ?, gstin = ?, phone = ?, email = ?, address = ?, balance_due = ?
           WHERE id = ?`,
          [
            formData.name.trim(),
            formData.dl_number.trim() || null,
            formData.gstin.trim() || null,
            formData.phone.trim() || null,
            formData.email.trim() || null,
            formData.address.trim() || null,
            parseFloat(formData.balance_due) || 0,
            editingVendor.id,
          ]
        );
        setNotification(`Vendor "${formData.name.trim()}" updated successfully!`);
      } else {
        await run(
          `INSERT INTO distributors (name, dl_number, gstin, phone, email, address, balance_due)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            formData.name.trim(),
            formData.dl_number.trim() || null,
            formData.gstin.trim() || null,
            formData.phone.trim() || null,
            formData.email.trim() || null,
            formData.address.trim() || null,
            parseFloat(formData.balance_due) || 0,
          ]
        );
        setNotification(`Vendor "${formData.name.trim()}" added successfully!`);
      }

      setIsModalOpen(false);
      loadVendors();
      setTimeout(() => setNotification(null), 4000);
    } catch (err) {
      alert('Error saving vendor: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (vendor) => {
    if (!window.confirm(`Are you sure you want to delete vendor "${vendor.name}"?`)) return;
    try {
      // Check if vendor has purchase records
      const hasPurchases = await query("SELECT COUNT(*) as count FROM purchases WHERE distributor_id = ?", [vendor.id]);
      if (hasPurchases && hasPurchases[0]?.count > 0) {
        alert(`Cannot delete vendor "${vendor.name}" because ${hasPurchases[0].count} purchase invoices are linked to it.`);
        return;
      }
      await run("DELETE FROM distributors WHERE id = ?", [vendor.id]);
      setNotification(`Vendor "${vendor.name}" deleted.`);
      loadVendors();
      setTimeout(() => setNotification(null), 4000);
    } catch (err) {
      alert('Error deleting vendor: ' + err.message);
    }
  };

  const filtered = vendors.filter((v) => {
    const q = searchTerm.toLowerCase();
    return (
      v.name?.toLowerCase().includes(q) ||
      v.dl_number?.toLowerCase().includes(q) ||
      v.gstin?.toLowerCase().includes(q) ||
      v.phone?.includes(q) ||
      v.address?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-sky-400" />
            <span>Vendors & Distributors (Suppliers)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage pharmaceutical wholesale suppliers, Drug License (DL) numbers, GSTIN, and payables
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onNavigate && (
            <Button variant="secondary" onClick={() => onNavigate('purchases')}>
              View Purchases
            </Button>
          )}
          <Button variant="primary" icon={Plus} onClick={handleOpenAdd}>
            + Add New Vendor
          </Button>
        </div>
      </div>

      {notification && (
        <div className="p-3 rounded-xl bg-emerald-950 border border-emerald-500 text-emerald-300 text-xs flex items-center gap-2 shadow-lg animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Search Bar */}
      <SearchInput
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onClear={() => setSearchTerm('')}
        placeholder="Search vendors by name, DL Number, GSTIN, mobile, or city..."
      />

      {/* Vendors Table */}
      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Vendor / Distributor Name</th>
                <th className="py-3 px-4">Drug License (DL No.)</th>
                <th className="py-3 px-4">GSTIN</th>
                <th className="py-3 px-4">Contact Info</th>
                <th className="py-3 px-4">Address</th>
                <th className="py-3 px-4 text-right">Balance Due</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No vendors found. Click "+ Add New Vendor" to add your wholesale supplier.
                  </td>
                </tr>
              ) : (
                filtered.map((v, idx) => (
                  <tr key={v.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-white text-sm">{v.name}</div>
                      <div className="text-[10px] text-slate-400">ID: #{v.id}</div>
                    </td>
                    <td className="py-3 px-4">
                      {v.dl_number ? (
                        <span className="font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded text-[11px] font-semibold">
                          {v.dl_number}
                        </span>
                      ) : (
                        <span className="text-slate-500 italic">Not Added</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-sky-400">
                      {v.gstin || <span className="text-slate-500 italic">N/A</span>}
                    </td>
                    <td className="py-3 px-4">
                      {v.phone && (
                        <div className="flex items-center gap-1.5 text-slate-300 font-mono">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span>{v.phone}</span>
                        </div>
                      )}
                      {v.email && (
                        <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
                          <Mail className="w-3 h-3 text-slate-500" />
                          <span>{v.email}</span>
                        </div>
                      )}
                      {!v.phone && !v.email && <span className="text-slate-500">—</span>}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-300" title={v.address}>
                      {v.address || <span className="text-slate-500">—</span>}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`font-mono font-bold ${v.balance_due > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                        ₹{Number(v.balance_due || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleOpenEdit(v)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                          title="Edit Vendor Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(v)}
                          className="p-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition"
                          title="Delete Vendor"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
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

      {/* Add / Edit Vendor Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingVendor ? `Edit Vendor: ${editingVendor.name}` : 'Add New Vendor / Supplier'}
        subtitle="Record pharmaceutical wholesale distributor with Drug License and GST credentials"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} isLoading={isSaving}>
              {editingVendor ? 'Save Changes' : 'Add Vendor'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Input
              label="Distributor / Vendor Name *"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Al-Shifa Pharma Distributors or Cipla Depot"
              autoFocus
            />
          </div>

          <Input
            label="Drug License Number (DL No.) *"
            value={formData.dl_number}
            onChange={(e) => setFormData({ ...formData, dl_number: e.target.value })}
            placeholder="e.g. 20B-12345 / 21B-67890"
          />

          <Input
            label="GSTIN Number"
            value={formData.gstin}
            onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
            placeholder="e.g. 27AAAAA0000A1Z5"
          />

          <Input
            label="Phone / Mobile Number"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="e.g. 9826011223"
          />

          <Input
            label="Email Address"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="orders@distributor.com"
          />

          <div className="sm:col-span-2">
            <Input
              label="Address (Market / City / State)"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="e.g. Shop 14, Wholesale Medicine Market, Akola"
            />
          </div>

          <div>
            <Input
              label="Current Balance Due (₹)"
              type="number"
              step="0.01"
              value={formData.balance_due}
              onChange={(e) => setFormData({ ...formData, balance_due: e.target.value })}
              placeholder="0.00"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
