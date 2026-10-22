const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const dbPaths = [
  path.join(process.env.APPDATA, 'madina-medical-desktop', 'madina_medical.db'),
  path.join(__dirname, '..', 'madina_medical.db')
];

async function updateSettings() {
  const SQL = await initSqlJs();
  for (const p of dbPaths) {
    if (!fs.existsSync(p)) {
      console.log('Skipping non-existent path:', p);
      continue;
    }
    const buf = fs.readFileSync(p);
    const db = new SQL.Database(buf);
    
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ['store_address', 'Zp school Nagar Panchayat road Barshitakli dist Akola 444401']);
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ['store_phone', '7378654515, 9359630126']);
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ['store_dl_number', 'MH-AKL-12345/67890']);
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ['store_gstin', '27AAAAA0000A1Z5']);

    const exported = db.export();
    fs.writeFileSync(p, Buffer.from(exported));
    console.log('Successfully updated settings in DB:', p);

    const check = db.exec("SELECT key, value FROM settings WHERE key IN ('store_address', 'store_phone', 'store_dl_number', 'store_gstin')");
    console.log('Verified:', JSON.stringify(check, null, 2));
  }
}

updateSettings().catch(console.error);
