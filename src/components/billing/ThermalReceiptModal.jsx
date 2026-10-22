import React, { useState, useEffect } from 'react';
import { Printer, Copy, Check, X, SlidersHorizontal, FileText } from 'lucide-react';
import Button from '../ui/Button';
import { generateEscPosReceipt } from '../../utils/receiptFormatter';

// Helper to convert number to Indian Currency Words
function numberToWords(num) {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const n = ('000000000' + Math.floor(num)).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';
  let str = '';
  str += (Number(n[1]) !== 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += (Number(n[2]) !== 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += (Number(n[3]) !== 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += (Number(n[4]) !== 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += (Number(n[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
  return str.trim() ? `${str.trim()} Rupees Only` : 'Zero Rupees Only';
}

export default function ThermalReceiptModal({
  isOpen,
  onClose,
  invoice,
  items = [],
  storeSettings = {},
}) {
  const [paperWidth, setPaperWidth] = useState('80mm'); // '58mm', '80mm', 'A5'
  const [receiptData, setReceiptData] = useState(null);
  const [printers, setPrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    async function loadPrintersAndReceipt() {
      if (!isOpen || !invoice) return;

      if (window.api?.invoke) {
        try {
          const res = await window.api.invoke('printer:getPrinters');
          if (res?.success && res.data?.length > 0) {
            setPrinters(res.data);
            setSelectedPrinter(res.data[0].name);
          }
        } catch (e) {
          console.warn('Could not list printers:', e);
        }
      }

      if (paperWidth !== 'A5') {
        try {
          const generated = generateEscPosReceipt(invoice, items, storeSettings, paperWidth);
          setReceiptData(generated);
        } catch (err) {
          console.error('Error generating receipt:', err);
        }
      }
    }
    loadPrintersAndReceipt();
  }, [isOpen, invoice, items, paperWidth, storeSettings]);

  if (!isOpen || !invoice) return null;

  // ─── Computed store values ────────────────────────────────────────────────
  const storeName   = storeSettings.store_name     || 'MADINA MEDICAL';
  const storeSub    = storeSettings.store_subtitle  || 'Pharmacy & Retail Billing';
  const address     = storeSettings.store_address   || 'Zp school Nagar Panchayat road Barshitakli dist Akola 444401';
  const phone       = storeSettings.store_phone     || '7378654515, 9359630126';
  const gstin       = storeSettings.store_gstin     || '27AAAAA0000A1Z5';
  const dl          = storeSettings.store_dl_number || 'MH-AKL-12345/67890';

  const subtotal    = Number(invoice.subtotal || invoice.final_amount || 0);
  const finalAmt    = Number(invoice.final_amount || subtotal || 0);
  const discount    = Number(invoice.discount_amount || 0);
  const cgst        = Number(invoice.cgst_total || 0);
  const sgst        = Number(invoice.sgst_total || 0);

  const fmt = (n) => Number(n || 0).toFixed(2);

  const formatExpiry = (str) => {
    if (!str) return '—';
    if (str.includes('-')) {
      const p = str.split('-');
      if (p.length >= 2) return `${p[1]}/${String(p[0]).slice(-2)}`;
    }
    return str;
  };

  const formatDate = (str) => {
    if (!str) return new Date().toLocaleDateString('en-IN');
    try {
      return new Date(str).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return str;
    }
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      if (paperWidth === 'A5') {
        // A5 Standard Print Window
        const printWindow = window.open('', '_blank');
        if (printWindow) {
          const a5Html = document.getElementById('a5-bill-container')?.innerHTML;
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
              <head>
                <title>Tax Invoice - ${invoice.invoice_number}</title>
                <style>
                  @page {
                    size: A5 portrait;
                    margin: 8mm;
                  }
                  body {
                    margin: 0;
                    padding: 0;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
                    color: #000;
                    font-size: 11px;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                  }
                  * { box-sizing: border-box; }
                  table { width: 100%; border-collapse: collapse; }
                </style>
              </head>
              <body>
                ${a5Html || ''}
              </body>
            </html>
          `);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
            printWindow.close();
          }, 250);
        }
      } else {
        // Thermal 58mm or 80mm
        if (window.api?.invoke) {
          await window.api.invoke('printer:printSilent', {
            invoice, items, printerName: selectedPrinter, paperWidth,
          });
        } else {
          const printWindow = window.open('', '_blank');
          if (printWindow) {
            printWindow.document.write(`
              <html><head><title>Receipt - ${invoice.invoice_number}</title>
              <style>body { font-family: monospace; font-size: 11px; white-space: pre; margin: 0; padding: 10px; }</style>
              </head><body>${receiptData?.plainText || ''}</body></html>
            `);
            printWindow.document.close();
            printWindow.focus();
            printWindow.print();
            printWindow.close();
          }
        }
      }
    } catch (err) {
      alert('Printing error: ' + err.message);
    } finally {
      setIsPrinting(false);
    }
  };

  const handleCopyText = () => {
    if (!receiptData?.plainText) return;
    navigator.clipboard.writeText(receiptData.plainText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className={`w-full ${paperWidth === 'A5' ? 'max-w-3xl' : 'max-w-lg'} bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden transition-all duration-300`}>

        {/* ── Header Bar ── */}
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-sky-400" />
            <h3 className="text-sm font-bold text-white">Bill & Receipt Preview</h3>
          </div>

          {/* Paper Selector: 58mm, 80mm, A5 */}
          <div className="flex items-center gap-1 bg-slate-950 px-1.5 py-1 rounded-lg border border-slate-800 text-xs">
            {[
              { id: '58mm', label: '58mm (2")' },
              { id: '80mm', label: '80mm (3")' },
              { id: 'A5', label: 'A5 Bill (Tax Invoice)' },
            ].map((w) => (
              <button
                key={w.id}
                onClick={() => setPaperWidth(w.id)}
                className={`px-2.5 py-1 rounded-md font-bold transition ${
                  paperWidth === w.id ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>

          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Printer Selection (for thermal) ── */}
        {paperWidth !== 'A5' && printers.length > 0 && (
          <div className="px-5 py-2 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-xs">
            <span className="text-slate-400 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
              Target Printer:
            </span>
            <select
              value={selectedPrinter}
              onChange={(e) => setSelectedPrinter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1 focus:ring-1 focus:ring-blue-500 focus:outline-none"
            >
              {printers.map((p) => (
                <option key={p.name} value={p.name}>{p.name}{p.isDefault ? ' (Default)' : ''}</option>
              ))}
            </select>
          </div>
        )}

        {/* ── Bill Content Viewport ── */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-950 flex justify-center">

          {/* ============================================================== */}
          {/* A5 BILL FORMAT (TAX INVOICE)                                    */}
          {/* ============================================================== */}
          {paperWidth === 'A5' ? (
            <div
              id="a5-bill-container"
              className="bg-white text-slate-900 shadow-2xl rounded-sm w-[640px] p-6 text-[11px] leading-tight select-text"
              style={{
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
              }}
            >
              {/* Outer Border */}
              <div style={{ border: '2px solid #1e293b', padding: '12px', minHeight: '800px', display: 'flex', flexDirection: 'column' }}>

                {/* 1. Header & Title */}
                <div style={{ textAlign: 'center', borderBottom: '2px solid #1e293b', paddingBottom: '8px', marginBottom: '8px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 'bold', letterSpacing: '2px', color: '#475569', textTransform: 'uppercase' }}>
                    Tax Invoice / Retail Cash Memo
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: '900', letterSpacing: '1px', color: '#0f172a', marginTop: '2px' }}>
                    {storeName}
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: '600', color: '#2563eb' }}>
                    {storeSub}
                  </div>
                  <div style={{ fontSize: '10px', color: '#334155', marginTop: '3px', lineHeight: '1.4' }}>
                    {address}
                  </div>
                  <div style={{ fontSize: '10px', color: '#1e293b', marginTop: '3px', display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap', fontWeight: '600' }}>
                    <span>Phone: <strong style={{ color: '#0f172a' }}>{phone}</strong></span>
                    <span>D.L. No.: <strong style={{ color: '#059669' }}>{dl}</strong></span>
                    <span>GSTIN: <strong style={{ color: '#0284c7' }}>{gstin}</strong></span>
                  </div>
                </div>

                {/* 2. Invoice & Patient Meta Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', borderBottom: '1px solid #94a3b8', paddingBottom: '8px', marginBottom: '8px', fontSize: '10px' }}>
                  <div style={{ borderRight: '1px solid #cbd5e1', paddingRight: '8px' }}>
                    <div><strong>Invoice No:</strong> <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 'bold', color: '#0284c7' }}>{invoice.invoice_number || 'MM-0001'}</span></div>
                    <div style={{ marginTop: '2px' }}><strong>Date & Time:</strong> {invoice.created_at || new Date().toLocaleString('en-IN')}</div>
                    <div style={{ marginTop: '2px' }}><strong>Payment Mode:</strong> <span style={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{invoice.payment_mode || 'CASH'}</span></div>
                  </div>
                  <div style={{ paddingLeft: '4px' }}>
                    <div><strong>Patient / Customer:</strong> <span style={{ fontWeight: 'bold' }}>{invoice.customer_name || 'Walk-in Customer'}</span></div>
                    <div style={{ marginTop: '2px' }}><strong>Mobile No:</strong> <span style={{ fontFamily: 'monospace' }}>{invoice.customer_phone || '—'}</span></div>
                    <div style={{ marginTop: '2px' }}><strong>Doctor:</strong> {invoice.doctor_name ? `Dr. ${invoice.doctor_name}` : 'Self / Registered Practitioner'}</div>
                  </div>
                </div>

                {/* 3. Items Table */}
                <div style={{ flex: '1 1 auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', borderTop: '1px solid #94a3b8', borderBottom: '1.5px solid #1e293b' }}>
                        <th style={{ padding: '5px 4px', textAlign: 'center', width: '25px', borderRight: '1px solid #cbd5e1' }}>#</th>
                        <th style={{ padding: '5px 4px', textAlign: 'left', borderRight: '1px solid #cbd5e1' }}>Description (Medicine / Formula)</th>
                        <th style={{ padding: '5px 4px', textAlign: 'center', width: '40px', borderRight: '1px solid #cbd5e1' }}>HSN</th>
                        <th style={{ padding: '5px 4px', textAlign: 'center', width: '55px', borderRight: '1px solid #cbd5e1' }}>Batch</th>
                        <th style={{ padding: '5px 4px', textAlign: 'center', width: '45px', borderRight: '1px solid #cbd5e1' }}>Exp</th>
                        <th style={{ padding: '5px 4px', textAlign: 'center', width: '45px', borderRight: '1px solid #cbd5e1' }}>Unit</th>
                        <th style={{ padding: '5px 4px', textAlign: 'center', width: '35px', borderRight: '1px solid #cbd5e1' }}>Qty</th>
                        <th style={{ padding: '5px 4px', textAlign: 'right', width: '50px', borderRight: '1px solid #cbd5e1' }}>MRP (₹)</th>
                        <th style={{ padding: '5px 4px', textAlign: 'right', width: '50px', borderRight: '1px solid #cbd5e1' }}>Rate (₹)</th>
                        <th style={{ padding: '5px 4px', textAlign: 'right', width: '55px' }}>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => {
                        const name   = it.medicine_name || it.name || 'Medicine';
                        const qty    = it.quantity || it.qty || 1;
                        const rate   = Number(it.unit_price || it.selling_rate || 0);
                        const mrp    = Number(it.mrp || rate);
                        const total  = Number(it.total_amount || (rate * qty) || 0);
                        const batch  = it.batch_number || '—';
                        const exp    = formatExpiry(it.expiry_date);
                        const isTab  = it.unit_type === 'tablet';

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', minHeight: '22px' }}>
                            <td style={{ padding: '4px', textAlign: 'center', borderRight: '1px solid #e2e8f0', color: '#64748b' }}>{idx + 1}</td>
                            <td style={{ padding: '4px', textAlign: 'left', borderRight: '1px solid #e2e8f0', fontWeight: '600' }}>
                              {name}
                              {it.generic_name && <div style={{ fontSize: '9px', color: '#64748b', fontWeight: 'normal' }}>{it.generic_name}</div>}
                            </td>
                            <td style={{ padding: '4px', textAlign: 'center', borderRight: '1px solid #e2e8f0', fontFamily: 'monospace', color: '#64748b' }}>
                              {it.hsn_code || '3004'}
                            </td>
                            <td style={{ padding: '4px', textAlign: 'center', borderRight: '1px solid #e2e8f0', fontFamily: 'monospace', fontWeight: 'bold' }}>
                              {batch}
                            </td>
                            <td style={{ padding: '4px', textAlign: 'center', borderRight: '1px solid #e2e8f0', fontFamily: 'monospace' }}>
                              {exp}
                            </td>
                            <td style={{ padding: '4px', textAlign: 'center', borderRight: '1px solid #e2e8f0', fontSize: '9px', textTransform: 'uppercase' }}>
                              {isTab ? 'Tablet' : (it.unit || 'Strip')}
                            </td>
                            <td style={{ padding: '4px', textAlign: 'center', borderRight: '1px solid #e2e8f0', fontWeight: 'bold' }}>
                              {qty}
                            </td>
                            <td style={{ padding: '4px', textAlign: 'right', borderRight: '1px solid #e2e8f0', fontFamily: 'monospace' }}>
                              {fmt(mrp)}
                            </td>
                            <td style={{ padding: '4px', textAlign: 'right', borderRight: '1px solid #e2e8f0', fontFamily: 'monospace' }}>
                              {fmt(rate)}
                            </td>
                            <td style={{ padding: '4px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>
                              {fmt(total)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 4. Tax & Totals Summary */}
                <div style={{ marginTop: '12px', borderTop: '1.5px solid #1e293b', paddingTop: '8px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                    {/* Left: Amount in Words & Terms */}
                    <div>
                      <div style={{ fontSize: '10px', marginBottom: '6px' }}>
                        <strong>Amount in Words:</strong><br />
                        <span style={{ fontStyle: 'italic', color: '#1e293b' }}>{numberToWords(finalAmt)}</span>
                      </div>
                      <div style={{ fontSize: '8.5px', color: '#64748b', lineHeight: '1.35', border: '1px solid #cbd5e1', padding: '6px', borderRadius: '4px', backgroundColor: '#f8fafc' }}>
                        <strong>Terms & Conditions:</strong><br />
                        1. Medicines without original invoice or batch match not returnable.<br />
                        2. Goods once sold will be taken back strictly as per Drugs & Cosmetics Act rules.<br />
                        3. Store all medicines in a cool, dry place away from sunlight.<br />
                        4. Subject to Barshitakli / Akola jurisdiction only.
                      </div>
                    </div>

                    {/* Right: Calculations Box */}
                    <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', padding: '6px 8px', backgroundColor: '#f8fafc', fontSize: '10px', lineHeight: '1.6' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Subtotal (Taxable Value):</span>
                        <span style={{ fontFamily: 'monospace' }}>₹{fmt(subtotal)}</span>
                      </div>
                      {(cgst > 0 || sgst > 0) && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                            <span>CGST:</span>
                            <span style={{ fontFamily: 'monospace' }}>₹{fmt(cgst)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                            <span>SGST:</span>
                            <span style={{ fontFamily: 'monospace' }}>₹{fmt(sgst)}</span>
                          </div>
                        </>
                      )}
                      {discount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#dc2626' }}>
                          <span>Discount:</span>
                          <span style={{ fontFamily: 'monospace' }}>-₹{fmt(discount)}</span>
                        </div>
                      )}
                      <div style={{
                        display: 'flex', justifyContent: 'space-between',
                        borderTop: '2px solid #0f172a', marginTop: '4px', paddingTop: '4px',
                        fontSize: '13px', fontWeight: 'bold', color: '#0f172a'
                      }}>
                        <span>NET PAYABLE:</span>
                        <span style={{ color: '#047857' }}>₹{fmt(finalAmt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* 5. Signature Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '20px', paddingTop: '8px' }}>
                    <div style={{ fontSize: '9px', color: '#64748b' }}>
                      Thank You! Wishing you a speedy recovery.<br />
                      This is a computer-generated tax invoice.
                    </div>
                    <div style={{ textAlign: 'center', fontSize: '10px' }}>
                      <div style={{ fontWeight: 'bold', color: '#0f172a' }}>For MADINA MEDICAL</div>
                      <div style={{ height: '35px' }}></div>
                      <div style={{ borderTop: '1px dashed #64748b', paddingTop: '2px', fontSize: '9px', color: '#475569' }}>
                        Registered Pharmacist / Auth. Signatory
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          ) : (
            /* ============================================================== */
            /* THERMAL RECEIPT FORMAT (58mm or 80mm)                          */
            /* ============================================================== */
            <div
              className="bg-white shadow-2xl"
              style={{
                width: paperWidth === '80mm' ? '302px' : '220px',
                fontFamily: "'Courier New', Courier, monospace",
                fontSize: '11px',
                color: '#111',
                padding: '16px 14px',
                lineHeight: '1.45',
                boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
              }}
            >
              {/* Store Header */}
              <div style={{ textAlign: 'center', borderBottom: '1px dashed #555', paddingBottom: '8px', marginBottom: '8px' }}>
                <div style={{ fontWeight: 'bold', fontSize: '15px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                  {storeName}
                </div>
                <div style={{ fontSize: '10px', color: '#333', marginTop: '1px' }}>{storeSub}</div>
                <div style={{ fontSize: '10px', color: '#444', marginTop: '4px', lineHeight: '1.5' }}>
                  Zp School, Nagar Panchayat Road<br />
                  Barshitakli, Dist. Akola - 444401
                </div>
                <div style={{ fontSize: '10px', color: '#444', marginTop: '3px' }}>Tel: {phone}</div>
                {dl && <div style={{ fontSize: '9px', color: '#059669', fontWeight: 'bold', marginTop: '2px' }}>DL: {dl}</div>}
                {gstin && <div style={{ fontSize: '9px', color: '#0284c7', fontWeight: 'bold' }}>GSTIN: {gstin}</div>}
              </div>

              {/* Invoice Info */}
              <div style={{ borderBottom: '1px dashed #aaa', paddingBottom: '6px', marginBottom: '6px', fontSize: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold' }}>Bill No: {invoice.invoice_number || 'MM-001'}</span>
                  <span style={{ color: '#444' }}>{formatDate(invoice.created_at)}</span>
                </div>
                {invoice.customer_name && (
                  <div style={{ marginTop: '2px' }}>
                    Patient: <strong>{invoice.customer_name}</strong>
                    {invoice.customer_phone && ` | ${invoice.customer_phone}`}
                  </div>
                )}
                {invoice.doctor_name && (
                  <div>Dr: {invoice.doctor_name}</div>
                )}
                <div style={{ marginTop: '2px' }}>
                  Payment: <strong>{(invoice.payment_mode || 'CASH').toUpperCase()}</strong>
                </div>
              </div>

              {/* Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #aaa', borderTop: '1px solid #aaa' }}>
                    <th style={{ textAlign: 'left',  padding: '3px 2px', fontWeight: 'bold' }}>Medicine</th>
                    <th style={{ textAlign: 'center', padding: '3px 2px', fontWeight: 'bold' }}>Qty</th>
                    <th style={{ textAlign: 'right',  padding: '3px 2px', fontWeight: 'bold' }}>Rate</th>
                    <th style={{ textAlign: 'right',  padding: '3px 2px', fontWeight: 'bold' }}>Amt</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => {
                    const name    = item.medicine_name || item.name || 'Medicine';
                    const qty     = item.quantity || item.qty || 1;
                    const rate    = Number(item.unit_price || item.selling_rate || 0);
                    const total   = Number(item.total_amount || (rate * qty) || 0);
                    const batch   = item.batch_number;
                    const expiry  = formatExpiry(item.expiry_date);
                    const isTab   = item.unit_type === 'tablet';

                    return (
                      <React.Fragment key={i}>
                        <tr style={{ borderBottom: batch ? 'none' : '1px dotted #ddd' }}>
                          <td style={{ padding: '3px 2px', fontWeight: '600', maxWidth: '120px', wordBreak: 'break-word' }}>
                            {name} {isTab ? '(Tab)' : ''}
                          </td>
                          <td style={{ textAlign: 'center', padding: '3px 2px' }}>{qty}</td>
                          <td style={{ textAlign: 'right',  padding: '3px 2px' }}>{fmt(rate)}</td>
                          <td style={{ textAlign: 'right',  padding: '3px 2px', fontWeight: 'bold' }}>{fmt(total)}</td>
                        </tr>
                        {batch && (
                          <tr style={{ borderBottom: '1px dotted #ddd' }}>
                            <td colSpan={4} style={{ padding: '0 2px 3px 4px', fontSize: '9px', color: '#666' }}>
                              Batch: {batch}  Exp: {expiry}  {isTab ? '• Loose Tab' : ''}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>

              {/* Totals */}
              <div style={{ borderTop: '1px dashed #555', marginTop: '6px', paddingTop: '6px', fontSize: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span>Subtotal</span>
                  <span>Rs. {fmt(subtotal)}</span>
                </div>
                {(cgst > 0 || sgst > 0) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', color: '#444' }}>
                    <span>GST (CGST+SGST)</span>
                    <span>Rs. {fmt(cgst + sgst)}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px', color: '#c00' }}>
                    <span>Discount</span>
                    <span>- Rs. {fmt(discount)}</span>
                  </div>
                )}
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  borderTop: '2px solid #222', marginTop: '4px', paddingTop: '5px',
                  fontWeight: 'bold', fontSize: '13px',
                }}>
                  <span>NET TOTAL</span>
                  <span>Rs. {fmt(finalAmt)}</span>
                </div>
              </div>

              {/* Footer */}
              <div style={{
                borderTop: '1px dashed #555', marginTop: '10px', paddingTop: '8px',
                textAlign: 'center', fontSize: '10px', color: '#333',
              }}>
                <div style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '2px' }}>
                  ★ Thank You! Get Well Soon. ★
                </div>
                <div style={{ color: '#777', fontSize: '9px' }}>— Computer Generated Invoice —</div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer Actions ── */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900 flex items-center justify-between">
          {paperWidth !== 'A5' ? (
            <Button variant="secondary" size="sm" icon={isCopied ? Check : Copy} onClick={handleCopyText}>
              {isCopied ? 'Copied!' : 'Copy Raw Text'}
            </Button>
          ) : (
            <span className="text-xs text-slate-400">
              Format: <strong className="text-sky-400">A5 Medical Tax Invoice (Portrait)</strong>
            </span>
          )}

          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
            <Button variant="success" size="sm" icon={Printer} isLoading={isPrinting} onClick={handlePrint}>
              {paperWidth === 'A5' ? 'Print A5 Bill' : 'Print Receipt'}
            </Button>
          </div>
        </div>

      </div>
    </div>
  );
}
