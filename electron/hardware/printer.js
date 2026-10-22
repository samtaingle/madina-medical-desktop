/**
 * ESC/POS Thermal Printing Engine for Madina Medical
 * Supports both 58mm (32 cols) and 80mm (44 cols)
 * Properly centers headers with spaces in plainText and handles clean address wrapping
 */

const ESC = '\x1B';
const GS = '\x1D';

const COMMANDS = {
  INIT: `${ESC}@`,
  ALIGN_LEFT: `${ESC}a\x00`,
  ALIGN_CENTER: `${ESC}a\x01`,
  ALIGN_RIGHT: `${ESC}a\x02`,
  BOLD_ON: `${ESC}E\x01`,
  BOLD_OFF: `${ESC}E\x00`,
  DOUBLE_ON: `${GS}!\x11`,
  DOUBLE_OFF: `${GS}!\x00`,
  FEED_LINES: (n) => `${ESC}d${String.fromCharCode(n)}`,
  CUT_FULL: `${GS}V\x41\x00`,
  CUT_PARTIAL: `${GS}V\x42\x00`,
};

function padEnd(str, length) {
  str = String(str || '');
  return str.length >= length ? str.slice(0, length) : str + ' '.repeat(length - str.length);
}

function padStart(str, length) {
  str = String(str || '');
  return str.length >= length ? str.slice(0, length) : ' '.repeat(length - str.length) + str;
}

function centerText(str, width) {
  str = String(str || '').trim();
  if (str.length >= width) return str.slice(0, width);
  const leftPad = Math.floor((width - str.length) / 2);
  return ' '.repeat(leftPad) + str;
}

function formatTwoCols(left, right, width) {
  const rightStr = String(right);
  const leftWidth = Math.max(0, width - rightStr.length);
  return padEnd(left, leftWidth) + rightStr;
}

function formatAddressLines(addr, maxW = 40) {
  if (!addr) return [];
  const text = String(addr).trim();
  
  if (text.toLowerCase().includes('barshitakli') || text.toLowerCase().includes('akola')) {
    if (maxW >= 32) {
      return [
        'Zp School, Nagar Panchayat Road',
        'Barshitakli, Dist. Akola - 444401'
      ];
    } else {
      return [
        'Zp School, Nagar Panchayat Rd',
        'Barshitakli, Dist. Akola',
        'Pin: 444401'
      ];
    }
  }

  const words = text.split(/\s+/);
  const lines = [];
  let current = '';

  for (const w of words) {
    if ((current + (current ? ' ' : '') + w).length <= maxW) {
      current += (current ? ' ' : '') + w;
    } else {
      if (current) lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Generate formatted plain-text and ESC/POS raw command string
 */
function generateEscPosReceipt(invoice, items = [], storeSettings = {}, paperWidth = '80mm') {
  const is80 = paperWidth === '80mm';
  const width = is80 ? 44 : 32;
  const separator = '-'.repeat(width);
  const doubleSeparator = '='.repeat(width);

  const storeName = storeSettings.store_name || 'MADINA MEDICAL';
  const storeSub = storeSettings.store_subtitle || 'Pharmacy & Billing';
  const address = storeSettings.store_address || 'Zp school Nagar Panchayat road Barshitakli dist Akola 444401';
  const phone = storeSettings.store_phone || '7378654515, 9359630126';
  const gstin = storeSettings.store_gstin || '27AAAAA0000A1Z5';
  const dl = storeSettings.store_dl_number || 'MH-AKL-12345/67890';

  let raw = '';
  let plain = '';

  const addLine = (line, align = 'LEFT', bold = false, double = false) => {
    let plainLine = line;
    if (align === 'CENTER') {
      plainLine = centerText(line, width);
    } else if (align === 'RIGHT') {
      plainLine = padStart(line, width);
    }
    plain += plainLine + '\n';

    if (align === 'CENTER') raw += COMMANDS.ALIGN_CENTER;
    else if (align === 'RIGHT') raw += COMMANDS.ALIGN_RIGHT;
    else raw += COMMANDS.ALIGN_LEFT;

    if (bold) raw += COMMANDS.BOLD_ON;
    if (double) raw += COMMANDS.DOUBLE_ON;

    raw += line + '\n';

    if (double) raw += COMMANDS.DOUBLE_OFF;
    if (bold) raw += COMMANDS.BOLD_OFF;
  };

  // 1. Initialize Printer
  raw += COMMANDS.INIT;

  // 2. Centered Header
  addLine(doubleSeparator, 'LEFT');
  addLine(storeName, 'CENTER', true, true);
  addLine(storeSub, 'CENTER', true);

  // Cleanly formatted address lines
  const addrLines = formatAddressLines(address, width - 4);
  addrLines.forEach((al) => {
    addLine(al, 'CENTER');
  });

  addLine(`Tel: ${phone}`, 'CENTER');
  if (dl) addLine(`DL: ${dl}`, 'CENTER');
  if (gstin) addLine(`GSTIN: ${gstin}`, 'CENTER');
  addLine(doubleSeparator, 'LEFT');

  // 3. Invoice Metadata
  addLine(`INVOICE: ${invoice.invoice_number || 'MM-2026-000001'}`, 'LEFT', true);
  addLine(`Date: ${invoice.created_at || new Date().toLocaleString()}`, 'LEFT');
  if (invoice.customer_name) {
    const custInfo = `Patient: ${invoice.customer_name}` + (invoice.customer_phone ? ` (${invoice.customer_phone})` : '');
    addLine(custInfo.slice(0, width), 'LEFT');
  }
  if (invoice.doctor_name) {
    addLine(`Doctor: Dr. ${invoice.doctor_name}`.slice(0, width), 'LEFT');
  }
  addLine(separator, 'LEFT');

  // 4. Items Table Header
  if (is80) {
    // 44 cols: Item(14) Batch(7) Exp(5) Qty(4) Rate(6) Total(8) = 44
    const hdr = padEnd('Item', 14) + padEnd('Batch', 7) + padEnd('Exp', 5) + padStart('Qty', 4) + padStart('Rate', 6) + padStart('Total', 8);
    plain += hdr + '\n';
    raw += hdr + '\n';
  } else {
    // 32 cols: Item(14) Qty(4) Rate(7) Total(7) = 32
    const hdr = padEnd('Item', 14) + padStart('Qty', 4) + padStart('Rate', 7) + padStart('Total', 7);
    plain += hdr + '\n';
    raw += hdr + '\n';
  }
  addLine(separator, 'LEFT');

  // 5. Items Lines
  items.forEach((item) => {
    const itemName = item.medicine_name || item.name || 'Medicine';
    const totalNum = item.total_amount || (item.selling_rate * item.qty) || 0;
    const totalStr = Number(totalNum).toFixed(2);
    const rateStr = Number(item.unit_price || item.selling_rate || 0).toFixed(2);
    const qtyStr = String(item.quantity || item.qty || 1);
    const batchStr = String(item.batch_number || '-').slice(0, 6);
    
    let expStr = String(item.expiry_date || '');
    if (expStr.includes('-')) {
      const parts = expStr.split('-');
      if (parts.length >= 2) expStr = `${parts[1]}/${parts[0].slice(-2)}`;
    }

    if (is80) {
      const line =
        padEnd(itemName.slice(0, 13), 14) +
        padEnd(batchStr, 7) +
        padEnd(expStr.slice(0, 5), 5) +
        padStart(qtyStr, 4) +
        padStart(rateStr, 6) +
        padStart(totalStr, 8);
      addLine(line, 'LEFT');
    } else {
      const line =
        padEnd(itemName.slice(0, 13), 14) +
        padStart(qtyStr, 4) +
        padStart(rateStr, 7) +
        padStart(totalStr, 7);
      addLine(line, 'LEFT');
      if (item.batch_number) {
        addLine(`  B:${batchStr} Exp:${expStr}`.slice(0, width), 'LEFT');
      }
    }
  });

  addLine(separator, 'LEFT');

  // 6. Totals & Tax
  const subtotal = Number(invoice.subtotal || invoice.final_amount || 0).toFixed(2);
  addLine(formatTwoCols('Subtotal:', `Rs. ${subtotal}`, width), 'LEFT');
  
  const cgst = Number(invoice.cgst_total || 0);
  const sgst = Number(invoice.sgst_total || 0);
  if (cgst > 0 || sgst > 0) {
    const taxTotal = (cgst + sgst).toFixed(2);
    addLine(formatTwoCols('GST Tax:', `Rs. ${taxTotal}`, width), 'LEFT');
  }

  if (invoice.discount_amount > 0) {
    addLine(formatTwoCols('Discount:', `-Rs. ${Number(invoice.discount_amount).toFixed(2)}`, width), 'LEFT');
  }

  addLine(doubleSeparator, 'LEFT');
  const finalAmount = Number(invoice.final_amount || invoice.subtotal || 0).toFixed(2);
  addLine(formatTwoCols('NET PAYABLE:', `Rs. ${finalAmount}`, width), 'LEFT', true);
  addLine(doubleSeparator, 'LEFT');

  // 7. Payment Info
  addLine(`Payment Mode: ${(invoice.payment_mode || 'CASH').toUpperCase()}`, 'LEFT');
  if (invoice.payment_mode === 'cash' && invoice.cash_received) {
    addLine(formatTwoCols('Cash Received:', `Rs. ${Number(invoice.cash_received).toFixed(2)}`, width), 'LEFT');
    const change = Math.max(0, invoice.cash_received - (invoice.final_amount || 0));
    addLine(formatTwoCols('Change Returned:', `Rs. ${change.toFixed(2)}`, width), 'LEFT');
  }

  // 8. Footer & T&C
  addLine(separator, 'LEFT');
  addLine('Thank You! Get Well Soon.', 'CENTER', true);
  addLine('--- Computer Generated Invoice ---', 'CENTER');

  // 9. Feed & Cut
  raw += COMMANDS.FEED_LINES(4);
  raw += COMMANDS.CUT_PARTIAL;

  return { plainText: plain, rawEscPos: raw, width };
}

module.exports = {
  generateEscPosReceipt,
  COMMANDS,
};
