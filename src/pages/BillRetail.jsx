import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingCart,
  Search,
  Plus,
  Trash2,
  Printer,
  CreditCard,
  User,
  Phone,
  UserCheck,
  CheckCircle2,
  Sparkles,
  Percent,
  Receipt,
  RotateCcw
} from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import ThermalReceiptModal from '../components/billing/ThermalReceiptModal';
import { query, run } from '../utils/db';

export default function BillRetail() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState({
    name: '',
    phone: '',
    doctor: '',
  });

  // Global discount
  const [discountType, setDiscountType] = useState('flat'); // 'flat' or 'percent'
  const [discountValue, setDiscountValue] = useState(0);

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState('cash'); // 'cash', 'upi', 'card', 'credit'
  const [cashReceived, setCashReceived] = useState('');
  const [lastCompletedInvoice, setLastCompletedInvoice] = useState(null);

  // Thermal Receipt Modal State
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptInvoiceData, setReceiptInvoiceData] = useState(null);
  const [receiptItemsData, setReceiptItemsData] = useState([]);

  // Quick Add Medicine Modal State (Direct Counter Add)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState({
    name: '',
    generic_name: '',
    manufacturer: '',
    hsn_code: '3004',
    gst_rate: '12',
    unit: 'strip',
    tablets_per_strip: '10',
    batch_number: '',
    expiry_date: '',
    mrp: '100.00',
    purchase_rate: '70.00',
    selling_rate: '90.00',
    quantity: '50',
    rack_location: 'Rack A-1',
  });

  // Restock Existing Medicine Modal State
  const [isRestockOpen, setIsRestockOpen] = useState(false);
  const [selectedMedForRestock, setSelectedMedForRestock] = useState(null);
  const [restockForm, setRestockForm] = useState({
    batch_number: '',
    expiry_date: '',
    mrp: '100.00',
    purchase_rate: '70.00',
    selling_rate: '90.00',
    quantity: '30',
    rack_location: 'Rack A-1',
  });

  const [notification, setNotification] = useState(null);
  const searchInputRef = useRef(null);

  // References for reliable hotkey execution
  const handleFinalCheckoutRef = useRef(null);
  const handleNewBillRef = useRef(null);
  const openQuickAddModalRef = useRef(null);

  // Global Keyboard Shortcuts (Capture Phase)
  useEffect(() => {
    // Disable Windows F1 Help popup in browser/Electron
    window.onhelp = () => false;

    function handleKeyDown(e) {
      const key = e.key || '';
      const code = e.code || '';

      // F1 or Alt+S or Ctrl+F -> Search
      if (key === 'F1' || code === 'F1' || (e.altKey && (key === 's' || key === 'S')) || (e.ctrlKey && (key === 'f' || key === 'F'))) {
        e.preventDefault();
        e.stopPropagation();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // F2 or Alt+P -> Payment Modal
      if (key === 'F2' || code === 'F2' || (e.altKey && (key === 'p' || key === 'P'))) {
        e.preventDefault();
        e.stopPropagation();
        if (cart.length > 0) {
          setIsPaymentModalOpen(true);
        } else {
          setNotification('Cart is empty. Please add a medicine first (F1).');
          setTimeout(() => setNotification(null), 3000);
        }
        return;
      }

      // F3 or Alt+Enter -> Save & Print
      if (key === 'F3' || code === 'F3' || (e.altKey && key === 'Enter')) {
        e.preventDefault();
        e.stopPropagation();
        if (isPaymentModalOpen) {
          handleFinalCheckoutRef.current?.();
        } else if (cart.length > 0) {
          setIsPaymentModalOpen(true);
        } else {
          setNotification('Cart is empty. Please add a medicine first (F1).');
          setTimeout(() => setNotification(null), 3000);
        }
        return;
      }

      // F4 or Ctrl+N -> New Bill
      if (key === 'F4' || code === 'F4' || (e.ctrlKey && (key === 'n' || key === 'N'))) {
        e.preventDefault();
        e.stopPropagation();
        handleNewBillRef.current?.();
        return;
      }

      // F6 or Alt+A -> Quick Add Medicine
      if (key === 'F6' || code === 'F6' || (e.altKey && (key === 'a' || key === 'A'))) {
        e.preventDefault();
        e.stopPropagation();
        openQuickAddModalRef.current?.(searchTerm);
        return;
      }

      // Escape -> Close Modals / Clear Search
      if (key === 'Escape' || code === 'Escape') {
        if (isReceiptModalOpen) setIsReceiptModalOpen(false);
        else if (isPaymentModalOpen) setIsPaymentModalOpen(false);
        else if (isQuickAddOpen) setIsQuickAddOpen(false);
        else if (isRestockOpen) setIsRestockOpen(false);
        else setSearchResults([]);
      }
    }

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [cart, isPaymentModalOpen, isReceiptModalOpen, isQuickAddOpen, isRestockOpen, searchTerm]);

  // Live Medicine Search (Name, Generic, Barcode, Rack) - includes tablets_per_strip
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setSelectedIndex(0);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const q = `%${searchTerm.trim()}%`;
        // 1. First find available stock batches (FIFO)
        const inStockItems = await query(
          `SELECT 
            m.id as medicine_id, 
            m.name, 
            m.generic_name, 
            m.unit, 
            COALESCE(m.tablets_per_strip, 10) as tablets_per_strip,
            m.gst_rate, 
            m.hsn_code,
            b.id as batch_id,
            b.batch_number,
            b.expiry_date,
            b.mrp,
            b.purchase_rate,
            b.selling_rate,
            b.quantity as available_qty,
            b.rack_location
          FROM medicines m
          JOIN inventory_batches b ON m.id = b.medicine_id
          WHERE (m.name LIKE ? OR m.generic_name LIKE ? OR m.barcode LIKE ? OR b.rack_location LIKE ?)
            AND b.quantity > 0 AND b.is_quarantined = 0
          ORDER BY b.expiry_date ASC
          LIMIT 8`,
          [q, q, q, q]
        );

        if (inStockItems && inStockItems.length > 0) {
          setSearchResults(inStockItems);
          setSelectedIndex(0);
        } else {
          // 2. Fallback: check medicines that might be out of stock
          const catalogOnly = await query(
            `SELECT m.id as medicine_id, m.name, m.generic_name, m.unit, COALESCE(m.tablets_per_strip, 10) as tablets_per_strip, m.gst_rate, m.hsn_code, 0 as available_qty
             FROM medicines m
             WHERE (m.name LIKE ? OR m.generic_name LIKE ? OR m.barcode LIKE ?)
             LIMIT 5`,
            [q, q, q]
          );
          setSearchResults(catalogOnly || []);
          setSelectedIndex(0);
        }
      } catch (err) {
        console.error('Search error:', err);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const openQuickAddModal = (initialName = '') => {
    const defaultExpiry = new Date();
    defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 2);

    setQuickAddForm({
      name: initialName || searchTerm || '',
      generic_name: '',
      manufacturer: '',
      hsn_code: '3004',
      gst_rate: '12',
      unit: 'strip',
      batch_number: `B-${Math.floor(100 + Math.random() * 900)}`,
      expiry_date: defaultExpiry.toISOString().split('T')[0],
      mrp: '100.00',
      purchase_rate: '70.00',
      selling_rate: '90.00',
      quantity: '50',
      rack_location: 'Rack A-1',
    });
    setIsQuickAddOpen(true);
  };

  const openRestockModal = (med) => {
    setSelectedMedForRestock(med);
    const defaultExpiry = new Date();
    defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 2);

    setRestockForm({
      batch_number: `B-${Math.floor(100 + Math.random() * 900)}`,
      expiry_date: defaultExpiry.toISOString().split('T')[0],
      mrp: '100.00',
      purchase_rate: '70.00',
      selling_rate: '90.00',
      quantity: '50',
      rack_location: 'Rack A-1',
    });
    setIsRestockOpen(true);
  };

  const handleSaveQuickAdd = async (e) => {
    if (e) e.preventDefault();
    const tradeName = quickAddForm.name.trim();
    if (!tradeName) {
      alert('Please enter medicine name.');
      return;
    }

    try {
      const sellingRate = parseFloat(quickAddForm.selling_rate) || parseFloat(quickAddForm.mrp) || 90;
      const mrp = parseFloat(quickAddForm.mrp) || sellingRate;
      const purchaseRate = parseFloat(quickAddForm.purchase_rate) || sellingRate * 0.75;
      const qty = parseInt(quickAddForm.quantity, 10) || 50;
      const batchNum = quickAddForm.batch_number.trim() || `B-${Date.now().toString().slice(-4)}`;
      const expDate = quickAddForm.expiry_date || '2028-12-31';
      const unit = quickAddForm.unit || 'strip';
      const gstRate = parseFloat(quickAddForm.gst_rate) || 12;

      const tabPerStrip = parseInt(quickAddForm.tablets_per_strip, 10) || 10;

      // 1. Insert Medicine
      const medRes = await run(
        `INSERT INTO medicines (name, generic_name, manufacturer, hsn_code, gst_rate, reorder_level, unit, tablets_per_strip)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tradeName,
          quickAddForm.generic_name.trim() || null,
          quickAddForm.manufacturer.trim() || null,
          quickAddForm.hsn_code.trim() || '3004',
          gstRate,
          15,
          unit,
          tabPerStrip,
        ]
      );

      let newMedId = medRes.lastInsertRowid;
      if (!newMedId) {
        const found = await query('SELECT id FROM medicines WHERE name = ? ORDER BY id DESC LIMIT 1', [tradeName]);
        if (found && found[0]) newMedId = found[0].id;
      }

      // 2. Insert Batch
      const batchRes = await run(
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
          qty,
          quickAddForm.rack_location.trim() || 'Rack A-1',
        ]
      );

      let newBatchId = batchRes.lastInsertRowid;
      if (!newBatchId) {
        const foundBatch = await query('SELECT id FROM inventory_batches WHERE medicine_id = ? ORDER BY id DESC LIMIT 1', [newMedId]);
        if (foundBatch && foundBatch[0]) newBatchId = foundBatch[0].id;
      }

      // 3. Immediately add item to cart!
      const newItem = {
        medicine_id: newMedId,
        name: tradeName,
        generic_name: quickAddForm.generic_name,
        unit,
        unit_type: 'strip',
        tablets_per_strip: tabPerStrip,
        base_selling_rate: sellingRate,
        selling_rate: sellingRate,
        unit_price: sellingRate,
        gst_rate: gstRate,
        hsn_code: quickAddForm.hsn_code || '3004',
        batch_id: newBatchId,
        batch_number: batchNum,
        expiry_date: expDate,
        mrp,
        purchase_rate: purchaseRate,
        available_qty: qty,
        rack_location: quickAddForm.rack_location || 'Rack A-1',
        qty: 1,
      };

      setCart((prev) => [...prev, newItem]);
      setIsQuickAddOpen(false);
      setSearchTerm('');
      setSearchResults([]);
      setNotification(`Added "${tradeName}" to Catalog & Billing Cart!`);
      setTimeout(() => setNotification(null), 4000);
      searchInputRef.current?.focus();
    } catch (err) {
      alert('Error creating medicine: ' + err.message);
    }
  };

  const handleSaveRestock = async (e) => {
    if (e) e.preventDefault();
    if (!selectedMedForRestock) return;

    try {
      const sellingRate = parseFloat(restockForm.selling_rate) || parseFloat(restockForm.mrp) || 90;
      const mrp = parseFloat(restockForm.mrp) || sellingRate;
      const purchaseRate = parseFloat(restockForm.purchase_rate) || sellingRate * 0.75;
      const qty = parseInt(restockForm.quantity, 10) || 50;
      const batchNum = restockForm.batch_number.trim() || `B-${Date.now().toString().slice(-4)}`;
      const expDate = restockForm.expiry_date || '2028-12-31';

      const batchRes = await run(
        `INSERT INTO inventory_batches (
          medicine_id, batch_number, expiry_date, mrp, purchase_rate, selling_rate, quantity, rack_location
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          selectedMedForRestock.medicine_id,
          batchNum,
          expDate,
          mrp,
          purchaseRate,
          sellingRate,
          qty,
          restockForm.rack_location.trim() || 'Rack A-1',
        ]
      );

      let newBatchId = batchRes.lastInsertRowid;
      if (!newBatchId) {
        const foundBatch = await query('SELECT id FROM inventory_batches WHERE medicine_id = ? ORDER BY id DESC LIMIT 1', [selectedMedForRestock.medicine_id]);
        if (foundBatch && foundBatch[0]) newBatchId = foundBatch[0].id;
      }

      // Automatically add restocked item to cart!
      const newItem = {
        ...selectedMedForRestock,
        batch_id: newBatchId,
        batch_number: batchNum,
        expiry_date: expDate,
        mrp,
        purchase_rate: purchaseRate,
        selling_rate: sellingRate,
        available_qty: qty,
        qty: 1,
      };

      setCart((prev) => [...prev, newItem]);
      setIsRestockOpen(false);
      setSearchTerm('');
      setSearchResults([]);
      setNotification(`Restocked & added "${selectedMedForRestock.name}" to Billing Cart!`);
      setTimeout(() => setNotification(null), 4000);
      searchInputRef.current?.focus();
    } catch (err) {
      alert('Error restocking batch: ' + err.message);
    }
  };

  const addToCart = (item) => {
    if (!item.batch_id || item.available_qty <= 0) {
      openRestockModal(item);
      return;
    }

    const existingIndex = cart.findIndex((c) => c.batch_id === item.batch_id);
    if (existingIndex > -1) {
      const updated = [...cart];
      if (updated[existingIndex].qty < item.available_qty) {
        updated[existingIndex].qty += 1;
        setCart(updated);
      } else {
        alert(`Maximum available stock reached (${item.available_qty} ${item.unit}).`);
      }
    } else {
      const baseRate = parseFloat(item.selling_rate) || 0;
      setCart([
        ...cart,
        {
          ...item,
          unit_type: 'strip',
          tablets_per_strip: parseInt(item.tablets_per_strip, 10) || 10,
          base_selling_rate: baseRate,
          selling_rate: baseRate,
          unit_price: baseRate,
          qty: 1,
          discount_pct: 0,
        },
      ]);
    }
    setSearchTerm('');
    setSearchResults([]);
    setSelectedIndex(0);
    searchInputRef.current?.focus();
  };

  const toggleCartUnit = (batchId) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.batch_id === batchId) {
          const nextUnit = item.unit_type === 'tablet' ? 'strip' : 'tablet';
          const tabPerStrip = item.tablets_per_strip || 10;
          const baseRate = item.base_selling_rate || item.selling_rate;
          const newRate = nextUnit === 'tablet' ? Number((baseRate / tabPerStrip).toFixed(2)) : baseRate;
          return {
            ...item,
            unit_type: nextUnit,
            unit_price: newRate,
            selling_rate: newRate,
          };
        }
        return item;
      })
    );
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < searchResults.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (searchResults.length > 0) {
        const item = searchResults[selectedIndex] || searchResults[0];
        if (item.batch_id && item.available_qty > 0) {
          addToCart(item);
        } else {
          openRestockModal(item);
        }
      } else if (searchTerm.trim()) {
        openQuickAddModal(searchTerm.trim());
      }
    } else if (e.key === 'Escape') {
      setSearchResults([]);
    }
  };

  const updateCartQty = (batchId, newQty) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.batch_id === batchId) {
          const qty = Math.max(1, newQty);
          return { ...item, qty };
        }
        return item;
      })
    );
  };

  const removeFromCart = (batchId) => {
    setCart((prev) => prev.filter((item) => item.batch_id !== batchId));
  };

  const handleNewBill = () => {
    setCart([]);
    setCustomer({ name: '', phone: '', doctor: '' });
    setDiscountValue(0);
    setSearchTerm('');
    setLastCompletedInvoice(null);
    searchInputRef.current?.focus();
  };

  // Wire refs for reliable hotkeys execution
  handleFinalCheckoutRef.current = () => handleFinalCheckout();
  handleNewBillRef.current = () => handleNewBill();
  openQuickAddModalRef.current = (name) => openQuickAddModal(name);

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + (item.unit_price || item.selling_rate) * item.qty, 0);

  // GST calculation per line
  const gstTotal = cart.reduce((acc, item) => {
    const lineSubtotal = (item.unit_price || item.selling_rate) * item.qty;
    const rate = item.gst_rate || 0;
    return acc + (lineSubtotal * rate) / (100 + rate);
  }, 0);

  const discountAmount =
    discountType === 'percent'
      ? (subtotal * (parseFloat(discountValue) || 0)) / 100
      : parseFloat(discountValue) || 0;

  const grandTotal = Math.max(0, Math.round(subtotal - discountAmount));

  // Checkout Execution
  const handleFinalCheckout = async () => {
    if (cart.length === 0) return;

    try {
      const year = new Date().getFullYear();
      // Generate sequential invoice number MM-YYYY-XXXXXX
      const lastInv = await query("SELECT id FROM sales_invoices ORDER BY id DESC LIMIT 1");
      const nextId = (lastInv && lastInv[0]?.id ? lastInv[0].id + 1 : 1);
      const invoiceNumber = `MM-${year}-${String(nextId).padStart(6, '0')}`;

      const cgst = gstTotal / 2;
      const sgst = gstTotal / 2;
      const isCredit = paymentMode === 'credit';
      const paymentStatus = isCredit ? 'outstanding' : 'paid';
      const amountPaid = isCredit ? 0 : grandTotal;

      // 1. Insert Sales Invoice
      const invRes = await run(
        `INSERT INTO sales_invoices (
          invoice_number, customer_name, customer_phone, doctor_name,
          subtotal, cgst_total, sgst_total, igst_total,
          discount_type, discount_value, discount_amount, final_amount,
          payment_mode, payment_status, amount_paid
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          invoiceNumber,
          customer.name || 'Walk-in Customer',
          customer.phone || null,
          customer.doctor || null,
          subtotal,
          cgst,
          sgst,
          0,
          discountType,
          discountValue,
          discountAmount,
          grandTotal,
          paymentMode,
          paymentStatus,
          amountPaid,
        ]
      );

      const invoiceId = invRes.lastInsertRowid;

      // 2. Insert Sales Items with sub-unit metadata
      for (const item of cart) {
        const itemPrice = item.unit_price || item.selling_rate;
        const itemTotal = itemPrice * item.qty;
        const lineGst = (itemTotal * (item.gst_rate || 0)) / (100 + (item.gst_rate || 0));

        await run(
          `INSERT INTO sales_items (
            invoice_id, batch_id, medicine_id, quantity, unit_price, gst_rate, gst_amount, discount, total_amount, unit_type, tablets_per_strip
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            invoiceId,
            item.batch_id,
            item.medicine_id,
            item.qty,
            itemPrice,
            item.gst_rate || 0,
            lineGst,
            0,
            itemTotal,
            item.unit_type || 'strip',
            item.tablets_per_strip || 10,
          ]
        );
      }

      // 3. Insert Accounts Ledger entry
      await run(
        `INSERT INTO accounts_ledger (
          entity_type, entity_id, transaction_type, amount, payment_mode, reference_no, notes
        ) VALUES ('customer', ?, 'sale', ?, ?, ?, ?)`,
        [
          invoiceId,
          grandTotal,
          paymentMode,
          invoiceNumber,
          `POS Sale to ${customer.name || 'Walk-in'}`,
        ]
      );

      setLastCompletedInvoice({
        invoiceNumber,
        grandTotal,
        customerName: customer.name || 'Walk-in',
        itemCount: cart.length,
      });

      // Prepare receipt data and launch thermal visualizer
      const createdInvoice = {
        id: invoiceId,
        invoice_number: invoiceNumber,
        customer_name: customer.name || 'Walk-in Customer',
        customer_phone: customer.phone,
        doctor_name: customer.doctor,
        subtotal,
        cgst_total: cgst,
        sgst_total: sgst,
        discount_amount: discountAmount,
        final_amount: grandTotal,
        payment_mode: paymentMode,
        cash_received: parseFloat(cashReceived) || grandTotal,
        created_at: new Date().toLocaleString(),
      };

      setReceiptInvoiceData(createdInvoice);
      setReceiptItemsData([...cart]);
      setIsReceiptModalOpen(true);

      setIsPaymentModalOpen(false);
      setCart([]);
      setCustomer({ name: '', phone: '', doctor: '' });
      setDiscountValue(0);
      setCashReceived('');
    } catch (err) {
      alert('Checkout error: ' + err.message);
    }
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Top Customer & Search Bar Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Customer & Doctor details */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-3 grid grid-cols-3 gap-2 text-xs">
          <Input
            placeholder="Customer Name"
            value={customer.name}
            onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
            icon={User}
          />
          <Input
            placeholder="Mobile No."
            value={customer.phone}
            onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
            icon={Phone}
          />
          <Input
            placeholder="Doctor Name"
            value={customer.doctor}
            onChange={(e) => setCustomer({ ...customer, doctor: e.target.value })}
            icon={UserCheck}
          />
        </div>

        {/* Rapid Product Search with Auto FIFO Batch */}
        <div className="lg:col-span-7 relative">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 flex items-center">
              <div className="absolute left-3.5 pointer-events-none text-slate-400">
                <Search className="w-4 h-4 text-sky-400" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search medicine, formula, or scan barcode (Press Enter ↵ to add)..."
                className="w-full bg-slate-900 border border-blue-500/50 hover:border-blue-400 focus:border-blue-500 rounded-xl pl-10 pr-20 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition shadow-lg font-medium"
              />
              <div className="absolute right-3 flex items-center gap-1.5 pointer-events-none">
                <kbd className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-slate-800 border border-slate-700 text-amber-400">
                  F1
                </kbd>
              </div>
            </div>

            <Button
              variant="primary"
              icon={Plus}
              onClick={() => openQuickAddModal(searchTerm)}
              className="shrink-0 text-xs py-2.5 px-3.5 shadow-md shadow-blue-600/30 font-semibold"
              title="Add New Medicine directly to Catalog & Billing Cart"
            >
              + Quick Add
            </Button>
          </div>

          {/* Toast Notification Alert */}
          {notification && (
            <div className="absolute left-0 right-0 top-12 mt-1 z-50 p-3 rounded-xl bg-emerald-950 border border-emerald-500 text-emerald-300 text-xs flex items-center justify-between shadow-2xl animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold">{notification}</span>
              </div>
              <button onClick={() => setNotification(null)} className="text-emerald-400 hover:text-white px-1">
                ×
              </button>
            </div>
          )}

          {/* Search Dropdown Results */}
          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-12 mt-1 bg-slate-900 border border-blue-500/80 rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto divide-y divide-slate-800">
              {searchResults.map((item, idx) => {
                const isSelected = selectedIndex === idx;
                const hasStock = item.batch_id && item.available_qty > 0;

                return (
                  <div
                    key={item.batch_id || `cat-${item.medicine_id}-${idx}`}
                    onClick={() => {
                      if (hasStock) {
                        addToCart(item);
                      } else {
                        openRestockModal(item);
                      }
                    }}
                    className={`p-3 cursor-pointer transition flex items-center justify-between gap-4 group ${
                      isSelected
                        ? 'bg-blue-600/30 border-l-4 border-blue-400 pl-2'
                        : 'hover:bg-blue-600/10'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm group-hover:text-sky-300 truncate">
                          {item.name}
                        </span>
                        {isSelected && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-500 text-white font-mono font-bold animate-pulse">
                            Enter ↵
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {item.generic_name}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-300">
                        {item.batch_number ? (
                          <>
                            <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-sky-400">
                              Batch: {item.batch_number}
                            </span>
                            <span>Exp: {item.expiry_date}</span>
                            <span className="text-slate-400">Rack: {item.rack_location || '—'}</span>
                          </>
                        ) : (
                          <span className="text-amber-400 font-medium">No active batch loaded</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono font-black text-emerald-400 text-base">
                        {item.selling_rate ? `₹${Number(item.selling_rate).toFixed(2)}` : '—'}
                      </div>
                      {item.mrp && (
                        <div className="text-[10px] text-slate-400">
                          MRP: ₹{Number(item.mrp).toFixed(2)}
                        </div>
                      )}
                      <Badge
                        variant={hasStock ? 'primary' : 'danger'}
                        size="sm"
                        className="mt-1"
                      >
                        {hasStock
                          ? `${item.available_qty} ${item.unit} in stock (Add)`
                          : '0 Stock (Click to Restock)'}
                      </Badge>
                    </div>
                  </div>
                );
              })}

              {/* Bottom Quick-Add Prompt in Dropdown */}
              <div
                onClick={() => openQuickAddModal(searchTerm)}
                className="p-2.5 bg-slate-950 hover:bg-blue-950/40 text-blue-300 hover:text-white transition cursor-pointer flex items-center justify-between text-xs font-semibold border-t border-slate-800"
              >
                <span className="flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-sky-400" />
                  <span>Not listed? Quick Add New Medicine & Stock</span>
                </span>
                <span className="font-mono text-[10px] text-slate-400">Press Enter if typed</span>
              </div>
            </div>
          )}

          {/* When no medicines found, offer 1-click Quick Add */}
          {searchTerm.trim().length > 0 && searchResults.length === 0 && (
            <div className="absolute left-0 right-0 top-12 mt-1 bg-slate-900 border border-blue-500/80 rounded-xl shadow-2xl z-50 p-4 text-center space-y-3">
              <p className="text-xs text-slate-400">
                No medicine found matching "<span className="text-white font-bold">{searchTerm}</span>"
              </p>
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => openQuickAddModal(searchTerm)}
                className="mx-auto shadow-lg"
              >
                Quick Add "{searchTerm}" to Catalog & Bill (Enter ↵)
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Cart & Billing Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
        {/* Left: Cart Items Table */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-lg">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-sky-400" />
              Prescription Billing Cart ({cart.length} Items)
            </span>
            <Button variant="ghost" size="xs" icon={RotateCcw} onClick={handleNewBill}>
              Clear (Ctrl+N)
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-slate-500 text-center">
                <ShoppingCart className="w-12 h-12 text-slate-700 mb-2" />
                <p className="text-sm font-semibold text-slate-400">Cart is empty</p>
                <p className="text-xs text-slate-500 mt-1">
                  Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-amber-400">F1</kbd> to search medicines or scan barcode
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 sticky top-0 border-b border-slate-800 text-slate-400 uppercase font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Medicine Description</th>
                    <th className="py-2.5 px-3">Batch & Exp</th>
                    <th className="py-2.5 px-3 text-center">Unit / Sub-Unit</th>
                    <th className="py-2.5 px-3 text-center">Qty</th>
                    <th className="py-2.5 px-3 text-right">Rate (₹)</th>
                    <th className="py-2.5 px-3 text-right">GST %</th>
                    <th className="py-2.5 px-3 text-right">Total (₹)</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {cart.map((item, idx) => {
                    const isTab = item.unit_type === 'tablet';
                    const unitPrice = item.unit_price || item.selling_rate;
                    const lineTotal = unitPrice * item.qty;

                    return (
                      <tr key={item.batch_id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-white text-sm">{item.name}</div>
                          <div className="text-[10px] text-slate-400">{item.generic_name}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          <span className="text-sky-400">{item.batch_number}</span>
                          <div className="text-[10px] text-slate-400">{item.expiry_date}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {item.unit === 'strip' ? (
                            <button
                              type="button"
                              onClick={() => toggleCartUnit(item.batch_id)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition flex items-center gap-1 mx-auto ${
                                isTab
                                  ? 'bg-amber-950 text-amber-300 border border-amber-600/60 hover:bg-amber-900/60'
                                  : 'bg-blue-950 text-sky-300 border border-blue-600/60 hover:bg-blue-900/60'
                              }`}
                              title="Click to switch between Full Strip and Loose Tablets"
                            >
                              <span>{isTab ? 'Tablet (Loose)' : `Strip (${item.tablets_per_strip} Tab)`}</span>
                            </button>
                          ) : (
                            <span className="text-[10px] font-mono text-slate-400 uppercase">
                              {item.unit}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              min="1"
                              value={item.qty}
                              onChange={(e) =>
                                updateCartQty(item.batch_id, parseInt(e.target.value, 10) || 1)
                              }
                              className="w-14 bg-slate-950 border border-slate-700 rounded-lg text-center font-bold text-white py-1 focus:ring-1 focus:ring-blue-500 font-mono text-xs"
                            />
                            <span className="text-[10px] text-slate-400 font-mono">
                              {isTab ? 'Tabs' : (item.unit || 'Strips')}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-200">
                          ₹{Number(unitPrice).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                          {item.gst_rate}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400 text-sm">
                          ₹{lineTotal.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <button
                            onClick={() => removeFromCart(item.batch_id)}
                            className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 transition"
                            title="Remove from cart"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Totals Panel & Rapid Checkout Trigger */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex-1 flex flex-col justify-between">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                Order Billing Summary
              </h3>

              <div className="space-y-2.5 text-xs font-mono">
                <div className="flex justify-between text-slate-300">
                  <span>Gross Subtotal:</span>
                  <span className="font-semibold text-white">₹{subtotal.toFixed(2)}</span>
                </div>

                <div className="flex justify-between text-slate-300">
                  <span>GST Tax Breakdown:</span>
                  <span className="text-slate-400">₹{gstTotal.toFixed(2)}</span>
                </div>

                {/* Discount input */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
                  <span className="text-slate-300">Discount:</span>
                  <div className="flex items-center gap-1.5 w-32">
                    <input
                      type="number"
                      step="0.01"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      placeholder="0"
                      className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-right text-xs text-rose-400 font-mono"
                    />
                    <button
                      onClick={() => setDiscountType(discountType === 'flat' ? 'percent' : 'flat')}
                      className="px-2 py-1 bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded hover:text-white"
                    >
                      {discountType === 'flat' ? '₹' : '%'}
                    </button>
                  </div>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-rose-400 text-xs">
                    <span>Discount Deducted:</span>
                    <span>-₹{discountAmount.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Grand Total Display */}
            <div className="mt-6 pt-4 border-t-2 border-slate-800 space-y-4">
              <div className="bg-gradient-to-r from-blue-950/60 to-slate-950 p-4 rounded-xl border border-blue-600/40 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider block">
                    Net Payable
                  </span>
                  <span className="text-3xl font-black text-emerald-400 font-mono">
                    ₹{grandTotal.toFixed(2)}
                  </span>
                </div>
                <Badge variant="success" size="lg">
                  {cart.length} Items
                </Badge>
              </div>

              {/* Checkout Action Button */}
              <Button
                variant="primary"
                size="lg"
                className="w-full text-base font-bold py-3.5 shadow-xl shadow-blue-600/40"
                shortcut="F2"
                onClick={() => setIsPaymentModalOpen(true)}
                disabled={cart.length === 0}
              >
                Proceed to Payment
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom POS Hotkeys & Action Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 flex items-center justify-between flex-wrap gap-2 text-xs shadow-lg">
        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={() => { searchInputRef.current?.focus(); searchInputRef.current?.select(); }}
            className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-amber-500/60 px-3 py-1.5 rounded-lg text-slate-200 transition active:scale-95"
            title="Focus Medicine Search (F1 or Alt+S or Ctrl+F)"
          >
            <kbd className="font-mono font-bold text-amber-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">F1</kbd>
            <span>Search (Alt+S)</span>
          </button>

          <button
            type="button"
            onClick={() => { if (cart.length > 0) setIsPaymentModalOpen(true); else alert('Add items to cart first'); }}
            className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/60 px-3 py-1.5 rounded-lg text-slate-200 transition active:scale-95"
            title="Proceed to Payment (F2 or Alt+P)"
          >
            <kbd className="font-mono font-bold text-emerald-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">F2</kbd>
            <span>Payment (Alt+P)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (isPaymentModalOpen) handleFinalCheckoutRef.current?.();
              else if (cart.length > 0) setIsPaymentModalOpen(true);
              else alert('Add items to cart first');
            }}
            className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-sky-500/60 px-3 py-1.5 rounded-lg text-slate-200 transition active:scale-95"
            title="Save & Print Bill (F3 or Alt+Enter)"
          >
            <kbd className="font-mono font-bold text-sky-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">F3</kbd>
            <span>Save & Print (Alt+Enter)</span>
          </button>

          <button
            type="button"
            onClick={handleNewBill}
            className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-purple-500/60 px-3 py-1.5 rounded-lg text-slate-200 transition active:scale-95"
            title="Clear and Start New Bill (F4 or Ctrl+N)"
          >
            <kbd className="font-mono font-bold text-purple-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">F4</kbd>
            <span>New Bill (Ctrl+N)</span>
          </button>

          <button
            type="button"
            onClick={() => openQuickAddModal(searchTerm)}
            className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-700 hover:border-blue-500/60 px-3 py-1.5 rounded-lg text-slate-200 transition active:scale-95"
            title="Quick Add New Medicine (F6 or Alt+A)"
          >
            <kbd className="font-mono font-bold text-blue-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700">F6</kbd>
            <span>+ Quick Add (Alt+A)</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-400 font-mono flex items-center gap-3">
          <span>Items: <strong className="text-white">{cart.length}</strong></span>
          <span>Net Total: <strong className="text-emerald-400 text-sm">₹{grandTotal.toFixed(2)}</strong></span>
        </div>
      </div>

      {/* Payment & Checkout Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title="Complete Checkout & Print Receipt"
        subtitle={`Total Due: ₹${grandTotal.toFixed(2)} | Invoice for ${customer.name || 'Walk-in Customer'}`}
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs font-mono text-slate-400">
              Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-400">F3</kbd> to Save & Print
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setIsPaymentModalOpen(false)}>
                Cancel (Esc)
              </Button>
              <Button
                variant="success"
                shortcut="F3"
                icon={Printer}
                onClick={handleFinalCheckout}
              >
                Save & Silent Print
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-2">
              Select Payment Mode
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'cash', label: 'Cash Drawer' },
                { id: 'upi', label: 'UPI / QR Code' },
                { id: 'card', label: 'Debit/Credit Card' },
                { id: 'credit', label: 'Credit (Outstanding)' },
              ].map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setPaymentMode(mode.id)}
                  className={`p-3 rounded-xl border text-xs font-bold text-center transition ${
                    paymentMode === mode.id
                      ? 'bg-blue-600 border-blue-500 text-white shadow-lg'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {paymentMode === 'cash' && (
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 grid grid-cols-2 gap-4">
              <Input
                label="Cash Received (₹)"
                type="number"
                value={cashReceived}
                onChange={(e) => setCashReceived(e.target.value)}
                placeholder="e.g. 500"
                autoFocus
              />
              <div className="flex flex-col justify-center">
                <span className="text-xs text-slate-400">Change Due to Patient:</span>
                <span className="text-xl font-black font-mono text-amber-400 mt-1">
                  ₹{Math.max(0, (parseFloat(cashReceived) || 0) - grandTotal).toFixed(2)}
                </span>
              </div>
            </div>
          )}

          {paymentMode === 'credit' && (
            <div className="p-3 bg-amber-950/40 border border-amber-600/40 rounded-xl text-amber-300 text-xs">
              This invoice will be marked as <strong>OUTSTANDING</strong> and added to{' '}
              {customer.name || 'the customer'}'s credit ledger automatically.
            </div>
          )}
        </div>
      </Modal>

      {/* Thermal Receipt Visualizer Modal */}
      <ThermalReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        invoice={receiptInvoiceData}
        items={receiptItemsData}
      />

      {/* Quick Add Medicine & Stock Modal */}
      <Modal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        title="Quick Add Medicine & Opening Stock"
        subtitle="Instantly register medicine, load opening batch, and append directly to active bill"
        maxWidth="max-w-xl"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setIsQuickAddOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveQuickAdd}>
              Save & Add to Bill (Enter)
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveQuickAdd} className="space-y-3.5">
          <Input
            label="Medicine Trade Name"
            required
            autoFocus
            value={quickAddForm.name}
            onChange={(e) => setQuickAddForm({ ...quickAddForm, name: e.target.value })}
            placeholder="e.g. Paracetamol 650mg"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Generic Formula / Composition"
              value={quickAddForm.generic_name}
              onChange={(e) => setQuickAddForm({ ...quickAddForm, generic_name: e.target.value })}
              placeholder="e.g. Paracetamol"
            />
            <Input
              label="Manufacturer"
              value={quickAddForm.manufacturer}
              onChange={(e) => setQuickAddForm({ ...quickAddForm, manufacturer: e.target.value })}
              placeholder="e.g. Cipla, Sun Pharma"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Select
              label="Unit"
              value={quickAddForm.unit}
              onChange={(e) => setQuickAddForm({ ...quickAddForm, unit: e.target.value })}
              options={[
                { value: 'strip', label: 'Strip (with Tabs)' },
                { value: 'tablet', label: 'Tablet (Loose)' },
                { value: 'bottle', label: 'Bottle' },
                { value: 'vial', label: 'Vial' },
                { value: 'tube', label: 'Tube' },
                { value: 'box', label: 'Box' },
              ]}
            />
            {quickAddForm.unit === 'strip' ? (
              <Input
                label="Tabs/Strip"
                type="number"
                min="1"
                value={quickAddForm.tablets_per_strip}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, tablets_per_strip: e.target.value })}
                placeholder="10"
              />
            ) : (
              <Select
                label="GST Slab"
                value={quickAddForm.gst_rate}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, gst_rate: e.target.value })}
                options={[
                  { value: '0', label: '0%' },
                  { value: '5', label: '5%' },
                  { value: '12', label: '12%' },
                  { value: '18', label: '18%' },
                ]}
              />
            )}
            <Input
              label="Rack / Shelf"
              value={quickAddForm.rack_location}
              onChange={(e) => setQuickAddForm({ ...quickAddForm, rack_location: e.target.value })}
              placeholder="Rack A-1"
            />
          </div>

          <div className="pt-2 border-t border-slate-800">
            <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider block mb-2">
              Opening Batch & Pricing
            </span>
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Batch No."
                value={quickAddForm.batch_number}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, batch_number: e.target.value })}
                placeholder="B-101"
                required
              />
              <Input
                label="Expiry Date"
                type="date"
                value={quickAddForm.expiry_date}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, expiry_date: e.target.value })}
                required
              />
              <Input
                label="Opening Qty"
                type="number"
                min="1"
                value={quickAddForm.quantity}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, quantity: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3 mt-3">
              <Input
                label="MRP (₹)"
                type="number"
                step="0.01"
                value={quickAddForm.mrp}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, mrp: e.target.value })}
                placeholder="100.00"
                required
              />
              <Input
                label="Selling Rate (₹)"
                type="number"
                step="0.01"
                value={quickAddForm.selling_rate}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, selling_rate: e.target.value })}
                placeholder="90.00"
                required
              />
              <Input
                label="Purchase Rate (₹)"
                type="number"
                step="0.01"
                value={quickAddForm.purchase_rate}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, purchase_rate: e.target.value })}
                placeholder="70.00"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Restock Existing Medicine Modal */}
      <Modal
        isOpen={isRestockOpen}
        onClose={() => setIsRestockOpen(false)}
        title={`Restock: ${selectedMedForRestock?.name || ''}`}
        subtitle={`Add active inventory batch and append directly to active bill (${selectedMedForRestock?.unit || 'units'})`}
        maxWidth="max-w-lg"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="secondary" onClick={() => setIsRestockOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveRestock}>
              Add Stock & Put in Cart (Enter)
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSaveRestock} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Batch Number"
              required
              autoFocus
              value={restockForm.batch_number}
              onChange={(e) => setRestockForm({ ...restockForm, batch_number: e.target.value })}
              placeholder="e.g. B-201"
            />
            <Input
              label="Expiry Date"
              type="date"
              required
              value={restockForm.expiry_date}
              onChange={(e) => setRestockForm({ ...restockForm, expiry_date: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Quantity to Add"
              type="number"
              min="1"
              required
              value={restockForm.quantity}
              onChange={(e) => setRestockForm({ ...restockForm, quantity: e.target.value })}
            />
            <Input
              label="Rack / Shelf"
              value={restockForm.rack_location}
              onChange={(e) => setRestockForm({ ...restockForm, rack_location: e.target.value })}
              placeholder="Rack A-1"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="MRP (₹)"
              type="number"
              step="0.01"
              required
              value={restockForm.mrp}
              onChange={(e) => setRestockForm({ ...restockForm, mrp: e.target.value })}
              placeholder="100.00"
            />
            <Input
              label="Selling Rate (₹)"
              type="number"
              step="0.01"
              required
              value={restockForm.selling_rate}
              onChange={(e) => setRestockForm({ ...restockForm, selling_rate: e.target.value })}
              placeholder="90.00"
            />
            <Input
              label="Purchase Rate (₹)"
              type="number"
              step="0.01"
              value={restockForm.purchase_rate}
              onChange={(e) => setRestockForm({ ...restockForm, purchase_rate: e.target.value })}
              placeholder="70.00"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
