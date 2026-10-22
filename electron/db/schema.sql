-- ============================================================================
-- MADINA MEDICAL (PHARMACY & BILLING) - RELATIONAL DATABASE SCHEMA (SQLITE)
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 0. Migrations Tracker
CREATE TABLE IF NOT EXISTS _migrations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  applied_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 1. Medicines Master
CREATE TABLE IF NOT EXISTS medicines (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  generic_name  TEXT,
  manufacturer  TEXT,
  hsn_code      TEXT,
  gst_rate      REAL DEFAULT 0,          -- 0, 5, 12, 18, 28
  reorder_level INTEGER DEFAULT 10,
  unit          TEXT DEFAULT 'strip',     -- strip, tablet, vial, bottle, tube
  tablets_per_strip INTEGER DEFAULT 10,   -- conversion factor (e.g. 10 tablets in 1 strip)
  barcode       TEXT UNIQUE,
  is_active     INTEGER DEFAULT 1,
  created_at    TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at    TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 2. Inventory Batches (FIFO tracking with expiry)
CREATE TABLE IF NOT EXISTS inventory_batches (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id    INTEGER NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
  batch_number   TEXT NOT NULL,
  expiry_date    TEXT NOT NULL,          -- YYYY-MM-DD
  mrp            REAL NOT NULL,
  purchase_rate  REAL NOT NULL,
  selling_rate   REAL NOT NULL,
  quantity       INTEGER NOT NULL DEFAULT 0,
  rack_location  TEXT,
  is_quarantined INTEGER DEFAULT 0,      -- 1 if expired/damaged/returned
  created_at     TEXT DEFAULT (datetime('now', 'localtime')),
  UNIQUE(medicine_id, batch_number)
);

-- 3. Sales Invoices
CREATE TABLE IF NOT EXISTS sales_invoices (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number  TEXT UNIQUE NOT NULL,  -- e.g. MM-2026-000001
  customer_name   TEXT,
  customer_phone  TEXT,
  doctor_name     TEXT,
  subtotal        REAL DEFAULT 0,
  cgst_total      REAL DEFAULT 0,
  sgst_total      REAL DEFAULT 0,
  igst_total      REAL DEFAULT 0,
  discount_type   TEXT DEFAULT 'flat',   -- 'flat' (₹) or 'percent' (%)
  discount_value  REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  final_amount    REAL DEFAULT 0,
  payment_mode    TEXT DEFAULT 'cash',   -- cash, upi, card, credit
  payment_status  TEXT DEFAULT 'paid',   -- paid, partial, outstanding
  amount_paid     REAL DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 4. Sales Items (Itemized invoice lines)
CREATE TABLE IF NOT EXISTS sales_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id   INTEGER NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
  batch_id     INTEGER NOT NULL REFERENCES inventory_batches(id) ON DELETE RESTRICT,
  medicine_id  INTEGER NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
  quantity     INTEGER NOT NULL,
  unit_type    TEXT DEFAULT 'strip',     -- 'strip' or 'tablet'
  tablets_per_strip INTEGER DEFAULT 10,
  unit_price   REAL NOT NULL,
  gst_rate     REAL DEFAULT 0,
  gst_amount   REAL DEFAULT 0,
  discount     REAL DEFAULT 0,
  total_amount REAL NOT NULL
);

-- 5. Sales Returns (S/R)
CREATE TABLE IF NOT EXISTS sales_returns (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id    INTEGER NOT NULL REFERENCES sales_invoices(id) ON DELETE RESTRICT,
  batch_id      INTEGER NOT NULL REFERENCES inventory_batches(id) ON DELETE RESTRICT,
  medicine_id   INTEGER NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
  returned_qty  INTEGER NOT NULL,
  refund_amount REAL DEFAULT 0,
  reason        TEXT,                    -- damaged, wrong medicine, expired, patient request
  refund_mode   TEXT DEFAULT 'cash',     -- cash, upi, credit
  return_date   TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 6. Distributors Master
CREATE TABLE IF NOT EXISTS distributors (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  dl_number   TEXT,
  gstin       TEXT,
  phone       TEXT,
  email       TEXT,
  address     TEXT,
  balance_due REAL DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 7. Purchases (Inward stock)
CREATE TABLE IF NOT EXISTS purchases (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  distributor_id  INTEGER NOT NULL REFERENCES distributors(id) ON DELETE RESTRICT,
  invoice_number  TEXT,
  invoice_date    TEXT,
  subtotal        REAL DEFAULT 0,
  tax_total       REAL DEFAULT 0,
  final_amount    REAL DEFAULT 0,
  payment_status  TEXT DEFAULT 'unpaid', -- paid, partial, unpaid
  notes           TEXT,
  created_at      TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 8. Purchase Items
CREATE TABLE IF NOT EXISTS purchase_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id   INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  medicine_id   INTEGER NOT NULL REFERENCES medicines(id) ON DELETE RESTRICT,
  batch_id      INTEGER REFERENCES inventory_batches(id) ON DELETE RESTRICT,
  quantity      INTEGER NOT NULL,
  purchase_rate REAL NOT NULL,
  mrp           REAL NOT NULL,
  selling_rate  REAL NOT NULL,
  expiry_date   TEXT,
  batch_number  TEXT,
  gst_amount    REAL DEFAULT 0,
  total_amount  REAL NOT NULL
);

-- 9. Purchase Returns (P/R)
CREATE TABLE IF NOT EXISTS purchase_returns (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id   INTEGER NOT NULL REFERENCES purchases(id) ON DELETE RESTRICT,
  batch_id      INTEGER NOT NULL REFERENCES inventory_batches(id) ON DELETE RESTRICT,
  returned_qty  INTEGER NOT NULL,
  reason        TEXT,
  return_date   TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 10. Accounts Ledger
CREATE TABLE IF NOT EXISTS accounts_ledger (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type      TEXT NOT NULL,       -- 'customer', 'distributor', 'expense', 'drawer'
  entity_id        INTEGER,
  transaction_type TEXT NOT NULL,       -- 'sale', 'payment', 'refund', 'purchase', 'expense'
  amount           REAL NOT NULL,
  payment_mode     TEXT,                -- cash, upi, card, credit
  reference_no     TEXT,                -- invoice # or receipt #
  notes            TEXT,
  created_at       TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 11. Expenses (Petty cash & store operations)
CREATE TABLE IF NOT EXISTS expenses (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  category     TEXT NOT NULL,           -- rent, electricity, salary, tea/snacks, maintenance, misc
  amount       REAL NOT NULL,
  description  TEXT,
  payment_mode TEXT DEFAULT 'cash',
  expense_date TEXT DEFAULT (date('now', 'localtime')),
  created_at   TEXT DEFAULT (datetime('now', 'localtime'))
);

-- 12. Settings Key-Value Store
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_medicines_name ON medicines(name);
CREATE INDEX IF NOT EXISTS idx_medicines_generic ON medicines(generic_name);
CREATE INDEX IF NOT EXISTS idx_medicines_barcode ON medicines(barcode);
CREATE INDEX IF NOT EXISTS idx_batches_med_expiry ON inventory_batches(medicine_id, expiry_date);
CREATE INDEX IF NOT EXISTS idx_batches_rack ON inventory_batches(rack_location);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON sales_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_phone ON sales_invoices(customer_phone);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON sales_invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_ledger_entity ON accounts_ledger(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ledger_date ON accounts_ledger(created_at);

-- ============================================================================
-- AUTOMATED INVENTORY & LEDGER TRIGGERS
-- ============================================================================

-- Trigger 1: Decrement batch quantity automatically when sales_item is inserted
CREATE TRIGGER IF NOT EXISTS trg_sales_item_stock_decrement
AFTER INSERT ON sales_items
BEGIN
  UPDATE inventory_batches
  SET quantity = MAX(0, quantity - NEW.quantity)
  WHERE id = NEW.batch_id;
END;

-- Trigger 2: Restore batch quantity if sales_item is cancelled/deleted
CREATE TRIGGER IF NOT EXISTS trg_sales_item_stock_restore_on_delete
AFTER DELETE ON sales_items
BEGIN
  UPDATE inventory_batches
  SET quantity = quantity + OLD.quantity
  WHERE id = OLD.batch_id;
END;

-- Trigger 3: Increment batch quantity when sales return occurs (unless marked damaged/expired)
CREATE TRIGGER IF NOT EXISTS trg_sales_return_stock_increment
AFTER INSERT ON sales_returns
WHEN NEW.reason != 'damaged' AND NEW.reason != 'expired'
BEGIN
  UPDATE inventory_batches
  SET quantity = quantity + NEW.returned_qty
  WHERE id = NEW.batch_id;
END;

-- Trigger 4: Quarantine stock if return reason is damaged or expired
CREATE TRIGGER IF NOT EXISTS trg_sales_return_quarantine
AFTER INSERT ON sales_returns
WHEN NEW.reason = 'damaged' OR NEW.reason = 'expired'
BEGIN
  UPDATE inventory_batches
  SET is_quarantined = 1
  WHERE id = NEW.batch_id;
END;

-- Trigger 5: Increment batch stock on inward purchase item
CREATE TRIGGER IF NOT EXISTS trg_purchase_item_stock_increment
AFTER INSERT ON purchase_items
WHEN NEW.batch_id IS NOT NULL
BEGIN
  UPDATE inventory_batches
  SET quantity = quantity + NEW.quantity
  WHERE id = NEW.batch_id;
END;
