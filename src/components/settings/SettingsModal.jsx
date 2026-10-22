import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Save, Database, Download, Printer, Store, Check, FolderOpen, RotateCcw, RefreshCw, AlertTriangle } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { query, run } from '../../utils/db';

export default function SettingsModal({ isOpen, onClose, onSettingsUpdated }) {
  const [formData, setFormData] = useState({
    store_name: 'Madina Medical',
    store_subtitle: 'Pharmacy & Billing',
    store_address: 'Zp school Nagar Panchayat road Barshitakli dist Akola 444401',
    store_phone: '7378654515, 9359630126',
    store_gstin: '27AAAAA0000A1Z5',
    store_dl_number: 'MH-AKL-12345/67890',
    printer_type: '80mm',
    printer_auto_cut: 'true',
  });
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Backup state
  const [backups, setBackups] = useState([]);
  const [backupDir, setBackupDir] = useState('');
  const [backupMsg, setBackupMsg] = useState(null); // {type:'success'|'error', text}
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [restoringIdx, setRestoringIdx] = useState(null);
  const isElectron = typeof window !== 'undefined' && window.api;

  const loadBackups = useCallback(async () => {
    if (!isElectron) return;
    try {
      const res = await window.api.invoke('backup:list');
      if (res.success) {
        setBackups(res.backups || []);
        setBackupDir(res.backupDir || '');
      }
    } catch (e) { /* browser mode — ignore */ }
  }, [isElectron]);

  useEffect(() => {
    async function loadSettings() {
      if (!isOpen) return;
      try {
        const rows = await query("SELECT key, value FROM settings");
        if (rows && rows.length > 0) {
          const map = {};
          rows.forEach((r) => { map[r.key] = r.value; });
          setFormData((prev) => ({ ...prev, ...map }));
        }
      } catch (err) {
        console.error('Error loading settings:', err);
      }
      loadBackups();
    }
    loadSettings();
  }, [isOpen, loadBackups]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      for (const [key, val] of Object.entries(formData)) {
        await run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, String(val)]);
      }
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
      if (onSettingsUpdated) onSettingsUpdated();
    } catch (err) {
      alert('Error saving settings: ' + err.message);
    }
  };

  const handleBackupNow = async () => {
    if (!isElectron) { setBackupMsg({ type: 'error', text: 'Backup only works in the desktop app.' }); return; }
    setIsBackingUp(true);
    setBackupMsg(null);
    try {
      const res = await window.api.invoke('backup:run');
      if (res.success) {
        setBackupMsg({ type: 'success', text: `✅ Backup saved: ${res.backupName}` });
        loadBackups();
      } else {
        setBackupMsg({ type: 'error', text: `❌ Backup failed: ${res.message}` });
      }
    } catch (e) {
      setBackupMsg({ type: 'error', text: `❌ Error: ${e.message}` });
    } finally {
      setIsBackingUp(false);
      setTimeout(() => setBackupMsg(null), 5000);
    }
  };

  const handleRestore = async (backup, idx) => {
    if (!window.confirm(`Restore from:\n${backup.name}\n\nThis will replace current data. Continue?`)) return;
    setRestoringIdx(idx);
    try {
      const res = await window.api.invoke('backup:restore', backup.path);
      if (res.success) {
        alert('✅ Restored successfully!\n\nPlease close and reopen the app to reload data.');
      } else {
        alert('❌ Restore failed: ' + res.message);
      }
    } catch (e) {
      alert('❌ Error: ' + e.message);
    } finally {
      setRestoringIdx(null);
    }
  };

  const handleOpenFolder = async () => {
    if (!isElectron) return;
    await window.api.invoke('backup:openFolder');
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatTime = (ms) => {
    const d = new Date(ms);
    return d.toLocaleDateString('en-IN') + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Store Settings & Configuration"
      subtitle="Pharmacy header details, receipt typography, thermal printer & offline database"
      maxWidth="max-w-2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          {savedSuccess ? (
            <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
              <Check className="w-4 h-4" /> Settings updated successfully!
            </span>
          ) : (
            <span></span>
          )}
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" icon={Save} onClick={handleSave}>
              Save Settings
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSave} className="space-y-5 text-xs">
        {/* Store Header Section */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
          <div className="font-bold text-sky-400 uppercase tracking-wider flex items-center gap-2">
            <Store className="w-4 h-4" />
            <span>Store Header (Printed on Receipts)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Store Trade Name"
              value={formData.store_name}
              onChange={(e) => setFormData({ ...formData, store_name: e.target.value })}
              required
            />
            <Input
              label="Store Subtitle"
              value={formData.store_subtitle}
              onChange={(e) => setFormData({ ...formData, store_subtitle: e.target.value })}
            />
          </div>

          <Input
            label="Full Address (with Pincode)"
            value={formData.store_address}
            onChange={(e) => setFormData({ ...formData, store_address: e.target.value })}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Contact Phone"
              value={formData.store_phone}
              onChange={(e) => setFormData({ ...formData, store_phone: e.target.value })}
            />
            <Input
              label="GSTIN Number"
              value={formData.store_gstin}
              onChange={(e) => setFormData({ ...formData, store_gstin: e.target.value })}
            />
            <Input
              label="Drug License (D.L.) No."
              value={formData.store_dl_number}
              onChange={(e) => setFormData({ ...formData, store_dl_number: e.target.value })}
            />
          </div>
        </div>

        {/* Thermal Hardware Section */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
          <div className="font-bold text-sky-400 uppercase tracking-wider flex items-center gap-2">
            <Printer className="w-4 h-4" />
            <span>Thermal Hardware & Paper Layout</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Thermal Paper Standard"
              value={formData.printer_type}
              onChange={(e) => setFormData({ ...formData, printer_type: e.target.value })}
              options={[
                { value: '80mm', label: '80mm (3-inch Standard Counter Printer)' },
                { value: '58mm', label: '58mm (2-inch Pocket/Compact Printer)' },
              ]}
            />

            <Select
              label="Auto Paper Cut (ESC/POS)"
              value={formData.printer_auto_cut}
              onChange={(e) => setFormData({ ...formData, printer_auto_cut: e.target.value })}
              options={[
                { value: 'true', label: 'Enabled (Send GS V cut command)' },
                { value: 'false', label: 'Disabled (Manual tear)' },
              ]}
            />
          </div>
        </div>

        {/* Database Safety & Backup */}
        <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
          <div className="font-bold text-sky-400 uppercase tracking-wider flex items-center gap-2">
            <Database className="w-4 h-4" />
            <span>Auto Backup (Daily • Last 7 kept)</span>
          </div>

          {/* Info row */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <span className="text-white font-semibold block">madina_medical.db</span>
              <span className="text-slate-400 text-[11px]">
                Auto-backup runs on startup + every 24 hours.<br />
                Saved to: <span className="text-sky-400 font-mono">{backupDir || 'Documents/MadinaBackups'}</span>
              </span>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" icon={FolderOpen} onClick={handleOpenFolder}>
                Open Folder
              </Button>
              <Button type="button" variant="primary" size="sm" icon={isBackingUp ? RefreshCw : Download}
                onClick={handleBackupNow} disabled={isBackingUp}>
                {isBackingUp ? 'Backing up...' : 'Backup Now'}
              </Button>
            </div>
          </div>

          {/* Message */}
          {backupMsg && (
            <div className={`p-2.5 rounded-lg text-xs border ${
              backupMsg.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-600/40 text-emerald-300'
                : 'bg-red-950/60 border-red-600/40 text-red-300'
            }`}>
              {backupMsg.text}
            </div>
          )}

          {/* Backup List */}
          {backups.length > 0 ? (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {backups.map((b, idx) => (
                <div key={b.name}
                  className="flex items-center justify-between bg-slate-900 rounded-lg px-3 py-2 border border-slate-800">
                  <div className="min-w-0">
                    <div className="text-white text-[11px] font-mono truncate">{b.name}</div>
                    <div className="text-slate-500 text-[10px]">{formatTime(b.time)} · {formatSize(b.size)}</div>
                  </div>
                  {idx === 0 && (
                    <span className="text-[9px] bg-emerald-800/60 text-emerald-300 px-1.5 py-0.5 rounded mr-2 shrink-0">
                      Latest
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRestore(b, idx)}
                    disabled={restoringIdx === idx}
                    className="shrink-0 text-[10px] text-amber-400 hover:text-amber-200 flex items-center gap-1 disabled:opacity-50"
                  >
                    <RotateCcw className="w-3 h-3" />
                    {restoringIdx === idx ? 'Restoring...' : 'Restore'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-500 text-[11px] text-center py-3 border border-slate-800 rounded-lg">
              No backups yet — click "Backup Now" to create the first one.<br/>
              Auto-backup will run 5 seconds after the app opens.
            </div>
          )}
        </div>

      </form>
    </Modal>
  );
}
