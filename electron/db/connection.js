const path = require('path');
const fs = require('fs');
const { app } = require('electron');

let dbInstance = null;
let dbPath = null;
let isSqlJs = false;

async function getDatabase() {
  if (dbInstance) return dbInstance;

  // Store in userData directory or alongside app in dev mode
  const userDataDir = app ? app.getPath('userData') : path.join(__dirname, '../../');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }
  dbPath = path.join(userDataDir, 'madina_medical.db');

  try {
    // Try native better-sqlite3 first if available
    const BetterSqlite3 = require('better-sqlite3');
    const db = new BetterSqlite3(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    dbInstance = {
      all: (sql, params = []) => db.prepare(sql).all(params),
      get: (sql, params = []) => db.prepare(sql).get(params),
      run: (sql, params = []) => {
        const info = db.prepare(sql).run(params);
        return { lastInsertRowid: Number(info.lastInsertRowid), changes: info.changes };
      },
      exec: (sql) => db.exec(sql),
      transaction: (fn) => db.transaction(fn)(),
      persist: () => {}, // better-sqlite3 auto-persists in WAL mode
      isNative: true,
    };
    console.log('[DB] Connected via native better-sqlite3 at:', dbPath);
  } catch (nativeErr) {
    console.log('[DB] better-sqlite3 not native-compiled, using official SQLite WebAssembly (sql.js):', nativeErr.message);
    const initSqlJs = require('sql.js');
    const SQL = await initSqlJs();

    let db;
    if (fs.existsSync(dbPath)) {
      const filebuffer = fs.readFileSync(dbPath);
      db = new SQL.Database(filebuffer);
    } else {
      db = new SQL.Database();
    }

    isSqlJs = true;
    const persistToDisk = () => {
      try {
        const data = db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
      } catch (e) {
        console.error('[DB] Persist error:', e);
      }
    };

    dbInstance = {
      all: (sql, params = []) => {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        const results = [];
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      },
      get: (sql, params = []) => {
        const stmt = db.prepare(sql);
        stmt.bind(params);
        let result = null;
        if (stmt.step()) {
          result = stmt.getAsObject();
        }
        stmt.free();
        return result;
      },
      run: (sql, params = []) => {
        db.run(sql, params);
        // Get last insert rowid and changes
        const idRes = db.exec("SELECT last_insert_rowid() as id, changes() as chg");
        let lastInsertRowid = 0;
        let changes = 0;
        if (idRes && idRes[0] && idRes[0].values && idRes[0].values[0]) {
          lastInsertRowid = Number(idRes[0].values[0][0]);
          changes = Number(idRes[0].values[0][1]);
        }
        persistToDisk();
        return { lastInsertRowid, changes };
      },
      exec: (sql) => {
        db.exec(sql);
        persistToDisk();
      },
      transaction: (fn) => {
        db.run("BEGIN TRANSACTION");
        try {
          const res = fn();
          db.run("COMMIT");
          persistToDisk();
          return res;
        } catch (err) {
          db.run("ROLLBACK");
          throw err;
        }
      },
      persist: persistToDisk,
      isNative: false,
    };
    console.log('[DB] Connected via SQLite WebAssembly (sql.js) at:', dbPath);
  }

  // Run schema initialization and seed
  initSchema(dbInstance);

  return dbInstance;
}

function initSchema(db) {
  try {
    const schemaFile = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaFile)) {
      const schemaSql = fs.readFileSync(schemaFile, 'utf8');
      db.exec(schemaSql);
      db.run("INSERT OR IGNORE INTO _migrations (name) VALUES ('001_initial_schema')");
      console.log('[DB] Schema and triggers verified/migrated successfully.');
    }

    // Check if medicines table is populated, if not, load seed data
    const countRow = db.get("SELECT COUNT(*) as count FROM medicines");
    if (!countRow || countRow.count === 0) {
      const seedFile = path.join(__dirname, 'seed.sql');
      if (fs.existsSync(seedFile)) {
        const seedSql = fs.readFileSync(seedFile, 'utf8');
        db.exec(seedSql);
        console.log('[DB] Seed data loaded successfully.');
      }
    }

    // Migrations for sub-units (tablets per strip) and DL numbers
    const runSafeAlter = (sql) => {
      try { db.run(sql); } catch (e) { /* column already exists */ }
    };
    runSafeAlter("ALTER TABLE medicines ADD COLUMN tablets_per_strip INTEGER DEFAULT 10");
    runSafeAlter("ALTER TABLE distributors ADD COLUMN dl_number TEXT");
    runSafeAlter("ALTER TABLE sales_items ADD COLUMN unit_type TEXT DEFAULT 'strip'");
    runSafeAlter("ALTER TABLE sales_items ADD COLUMN tablets_per_strip INTEGER DEFAULT 10");
  } catch (err) {
    console.error('[DB] Schema initialization failed:', err);
  }
}

module.exports = {
  getDatabase,
  getDbPath: () => dbPath,
};
