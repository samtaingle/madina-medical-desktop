-- Initial store settings
INSERT OR IGNORE INTO settings (key, value) VALUES 
('store_name', 'Madina Medical'),
('store_subtitle', 'Pharmacy & Billing'),
('store_address', 'Zp school Nagar Panchayat road Barshitakli dist Akola 444401'),
('store_phone', '7378654515, 9359630126'),
('store_gstin', '27AAAAA0000A1Z5'),
('store_dl_number', 'MH-AKL-12345/67890'),
('invoice_prefix', 'MM'),
('printer_type', 'thermal_80mm'),
('printer_auto_cut', 'true');

-- Sample Distributors
INSERT OR IGNORE INTO distributors (id, name, gstin, phone, email, address, balance_due) VALUES
(1, 'Al-Shifa Pharma Distributors', '23AABCA1111B1Z2', '+91 98260 11223', 'orders@alshifapharma.com', 'Shop 14, Wholesale Medicine Market, Bhopal', 14500.00),
(2, 'MedPlus Wholesalers & Logistics', '23BBDCE2222C1Z3', '+91 98261 44556', 'sales@medplusbhopal.in', 'Plot 45, Industrial Area, Govindpura', 8200.00),
(3, 'CureWell Healthcare Supply', '23CCDFG3333D1Z4', '+91 98262 77889', 'billing@curewell.com', '12 Hamidia Road, Bhopal', 0.00);

-- Sample Medicines
INSERT OR IGNORE INTO medicines (id, name, generic_name, manufacturer, hsn_code, gst_rate, reorder_level, unit, barcode) VALUES
(1, 'Augmentin 625 Duo Tablet', 'Amoxycillin (500mg) + Clavulanic Acid (125mg)', 'GSK Pharmaceuticals', '3004', 12.0, 20, 'strip', '890103000101'),
(2, 'Pan-D Capsule', 'Pantoprazole (40mg) + Domperidone (30mg)', 'Alkem Laboratories', '3004', 12.0, 25, 'strip', '890103000102'),
(3, 'Dolo 650 Tablet', 'Paracetamol (650mg)', 'Micro Labs Ltd', '3004', 12.0, 50, 'strip', '890103000103'),
(4, 'Azithral 500 Tablet', 'Azithromycin (500mg)', 'Alembic Pharma', '3004', 12.0, 15, 'strip', '890103000104'),
(5, 'Montair-LC Tablet', 'Montelukast (10mg) + Levocetirizine (5mg)', 'Cipla Ltd', '3004', 12.0, 30, 'strip', '890103000105'),
(6, 'Ascoril D Plus Syrup 100ml', 'Dextromethorphan + Phenylephrine + Chlorpheniramine', 'Glenmark Pharma', '3004', 12.0, 15, 'bottle', '890103000106'),
(7, 'Lantus Solostar Insulin Pen', 'Insulin Glargine (100 IU/ml)', 'Sanofi India', '3004', 5.0, 10, 'pen', '890103000107'),
(8, 'Telma 40 Tablet', 'Telmisartan (40mg)', 'Glenmark Pharma', '3004', 12.0, 25, 'strip', '890103000108'),
(9, 'Glycomet-GP 1 Tablet', 'Metformin (500mg) + Glimepiride (1mg)', 'USV Private Limited', '3004', 12.0, 30, 'strip', '890103000109'),
(10, 'Betadine 10% Ointment 20g', 'Povidone Iodine (10% w/w)', 'Win-Medicare', '3004', 12.0, 15, 'tube', '890103000110');

-- Inventory Batches (FIFO - earliest expiry first)
INSERT OR IGNORE INTO inventory_batches (id, medicine_id, batch_number, expiry_date, mrp, purchase_rate, selling_rate, quantity, rack_location) VALUES
(1, 1, 'AUG-24A', '2026-11-30', 215.50, 160.00, 205.00, 35, 'Rack A-1'),
(2, 1, 'AUG-24B', '2027-04-30', 220.00, 165.00, 210.00, 50, 'Rack A-1'),
(3, 2, 'PAND-101', '2026-12-15', 185.00, 130.00, 175.00, 42, 'Rack A-3'),
(4, 2, 'PAND-102', '2027-08-31', 190.00, 135.00, 180.00, 60, 'Rack A-3'),
(5, 3, 'DOLO-992', '2026-10-25', 33.60, 22.00, 32.00, 12, 'Rack B-1'), -- Near expiry alert!
(6, 3, 'DOLO-993', '2027-05-31', 34.00, 22.50, 33.00, 120, 'Rack B-1'),
(7, 4, 'AZI-55', '2026-11-15', 132.00, 95.00, 125.00, 18, 'Rack B-2'),
(8, 5, 'MLC-881', '2027-03-31', 220.00, 155.00, 205.00, 45, 'Rack B-4'),
(9, 6, 'ASC-402', '2026-10-30', 145.00, 102.00, 138.00, 8, 'Rack C-1'), -- Low stock & near expiry
(10, 7, 'LAN-77', '2027-01-31', 680.00, 560.00, 650.00, 14, 'Fridge-1'),
(11, 8, 'TEL-209', '2027-09-30', 110.00, 75.00, 102.00, 55, 'Rack C-3'),
(12, 9, 'GLY-33', '2027-06-30', 98.00, 68.00, 92.00, 40, 'Rack C-4'),
(13, 10, 'BET-11', '2026-12-31', 65.00, 44.00, 60.00, 25, 'Rack D-2');
