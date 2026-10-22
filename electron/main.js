const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { getDatabase } = require('./db/connection');

// ─── Auto Backup ──────────────────────────────────────────────────────────────
const MAX_BACKUPS = 7;

function getBackupDir() {
  const docsPath = app.getPath('documents');
  const backupDir = path.join(docsPath, 'MadinaBackups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  return backupDir;
}

function getDbFilePath() {
  const userDataDir = app.getPath('userData');
  return path.join(userDataDir, 'madina_medical.db');
}

function runBackup() {
  try {
    const dbFile = getDbFilePath();
    if (!fs.existsSync(dbFile)) {
      console.log('[Backup] DB file not found yet, skipping.');
      return { success: false, message: 'Database not found.' };
    }

    const backupDir = getBackupDir();
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-'); // HH-MM-SS
    const backupName = `madina_backup_${dateStr}_${timeStr}.db`;
    const backupPath = path.join(backupDir, backupName);

    fs.copyFileSync(dbFile, backupPath);
    console.log('[Backup] Created:', backupPath);

    // Keep only the latest MAX_BACKUPS files
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('madina_backup_') && f.endsWith('.db'))
      .map(f => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtimeMs }))
      .sort((a, b) => b.time - a.time);

    if (files.length > MAX_BACKUPS) {
      files.slice(MAX_BACKUPS).forEach(f => {
        fs.unlinkSync(path.join(backupDir, f.name));
        console.log('[Backup] Removed old backup:', f.name);
      });
    }

    return { success: true, backupPath, backupName };
  } catch (err) {
    console.error('[Backup] Failed:', err.message);
    return { success: false, message: err.message };
  }
}

function listBackups() {
  try {
    const backupDir = getBackupDir();
    const files = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('madina_backup_') && f.endsWith('.db'))
      .map(f => {
        const stat = fs.statSync(path.join(backupDir, f));
        return { name: f, size: stat.size, time: stat.mtimeMs, path: path.join(backupDir, f) };
      })
      .sort((a, b) => b.time - a.time);
    return { success: true, backups: files, backupDir };
  } catch (err) {
    return { success: false, message: err.message, backups: [] };
  }
}

function startAutoBackup() {
  // Run once on startup (after 5 second delay so DB loads first)
  setTimeout(() => {
    console.log('[Backup] Running startup backup...');
    runBackup();
  }, 5000);

  // Then every 24 hours
  setInterval(() => {
    console.log('[Backup] Running scheduled 24h backup...');
    runBackup();
  }, 24 * 60 * 60 * 1000);
}
// ─────────────────────────────────────────────────────────────────────────────

let mainWindow = null;
let db = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    title: 'Madina Medical (Pharmacy & Billing)',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    autoHideMenuBar: true,
    show: true,
  });

  mainWindow.maximize();
  mainWindow.show();
  mainWindow.focus();

  mainWindow.webContents.on('console-message', (e, level, msg) => {
    console.log('[RENDERER CONSOLE]', msg);
  });

  // Handle load failure with automatic fallback to dist/index.html
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Load Error ${errorCode}] ${errorDescription} on ${validatedURL}`);
    if (require('fs').existsSync(distIndex)) {
      console.log('[Recovery] Falling back to local offline dist/index.html');
      mainWindow.loadFile(distIndex);
    }
  });

  // If dev server URL is provided, load it; otherwise load built dist/index.html
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  const distIndex = path.join(__dirname, '../dist/index.html');

  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else if (require('fs').existsSync(distIndex)) {
    mainWindow.loadFile(distIndex);
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  // Developer shortcuts: F12 for DevTools, F5 for safe reload
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    } else if (input.key === 'F5' && input.type === 'keyDown') {
      if (require('fs').existsSync(distIndex)) {
        mainWindow.loadFile(distIndex);
      } else {
        mainWindow.loadURL('http://localhost:5173');
      }
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Register Database IPC Handlers
function registerIpcHandlers() {
  ipcMain.handle('app:getInfo', async () => {
    return {
      appName: 'Madina Medical (Pharmacy & Billing)',
      version: app.getVersion(),
      isPackaged: app.isPackaged,
      platform: process.platform,
    };
  });

  // Backup IPC Handlers
  ipcMain.handle('backup:run', async () => {
    return runBackup();
  });

  ipcMain.handle('backup:list', async () => {
    return listBackups();
  });

  ipcMain.handle('backup:restore', async (event, backupFilePath) => {
    try {
      const dbFile = getDbFilePath();
      if (!fs.existsSync(backupFilePath)) {
        return { success: false, message: 'Backup file not found.' };
      }
      // Make a safety copy of current DB before restoring
      const safetyBackup = dbFile + '.before_restore';
      fs.copyFileSync(dbFile, safetyBackup);
      // Copy backup file over current DB
      fs.copyFileSync(backupFilePath, dbFile);
      // Reset DB instance so it reloads fresh
      db = null;
      return { success: true, message: 'Restored successfully. Please restart the app.' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  });

  ipcMain.handle('backup:openFolder', async () => {
    const { shell } = require('electron');
    const backupDir = getBackupDir();
    shell.openPath(backupDir);
    return { success: true };
  });

  ipcMain.handle('db:all', async (event, sql, params = []) => {
    try {
      if (!db) db = await getDatabase();
      const data = db.all(sql, params);
      return { success: true, data };
    } catch (err) {
      console.error('[IPC db:all Error]', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:get', async (event, sql, params = []) => {
    try {
      if (!db) db = await getDatabase();
      const data = db.get(sql, params);
      return { success: true, data };
    } catch (err) {
      console.error('[IPC db:get Error]', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:run', async (event, sql, params = []) => {
    try {
      console.log('>>> [IPC db:run CALLED] SQL:', sql);
      console.log('>>> [IPC db:run CALLED] PARAMS:', JSON.stringify(params));
      if (!db) db = await getDatabase();
      const res = db.run(sql, params);
      console.log('>>> [IPC db:run SUCCESS] RESULT:', JSON.stringify(res));
      return { success: true, ...res };
    } catch (err) {
      console.error('>>> [IPC db:run ERROR]', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('db:exec', async (event, sql) => {
    try {
      if (!db) db = await getDatabase();
      db.exec(sql);
      return { success: true };
    } catch (err) {
      console.error('[IPC db:exec Error]', err);
      return { success: false, error: err.message };
    }
  });

  // Thermal Printer IPC
  ipcMain.handle('printer:getPrinters', async () => {
    try {
      if (mainWindow) {
        const printers = await mainWindow.webContents.getPrintersAsync();
        return { success: true, data: printers };
      }
      return { success: true, data: [] };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('printer:generateReceipt', async (event, { invoice, items, paperWidth = '80mm' }) => {
    try {
      if (!db) db = await getDatabase();
      const settingsList = db.all("SELECT key, value FROM settings");
      const storeSettings = {};
      settingsList.forEach((s) => {
        storeSettings[s.key] = s.value;
      });

      const { generateEscPosReceipt } = require('./hardware/printer');
      const receipt = generateEscPosReceipt(invoice, items, storeSettings, paperWidth);
      return { success: true, receipt };
    } catch (err) {
      console.error('[IPC printer:generateReceipt Error]', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('printer:printSilent', async (event, { invoice, items, printerName, paperWidth = '80mm' }) => {
    try {
      if (!db) db = await getDatabase();
      const settingsList = db.all("SELECT key, value FROM settings");
      const storeSettings = {};
      settingsList.forEach((s) => {
        storeSettings[s.key] = s.value;
      });

      const { generateEscPosReceipt } = require('./hardware/printer');
      const receipt = generateEscPosReceipt(invoice, items, storeSettings, paperWidth);

      // Create an invisible print window for silent OS printing
      const printWin = new BrowserWindow({
        show: false,
        webPreferences: { nodeIntegration: true, contextIsolation: false },
      });

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @page { margin: 0; size: ${paperWidth === '80mm' ? '80mm' : '58mm'} auto; }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: ${paperWidth === '80mm' ? '12px' : '10px'};
              line-height: 1.25;
              margin: 0;
              padding: 4mm;
              color: black;
              white-space: pre-wrap;
            }
          </style>
        </head>
        <body>${receipt.plainText.replace(/\n/g, '<br/>').replace(/ /g, '&nbsp;')}</body>
        </html>
      `;

      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

      const printOptions = {
        silent: true,
        printBackground: true,
        margins: { marginType: 'none' },
      };

      if (printerName) {
        printOptions.deviceName = printerName;
      }

      printWin.webContents.print(printOptions, (success, failureReason) => {
        printWin.close();
        if (!success) console.warn('[Printer] Silent print status:', failureReason);
      });

      return { success: true, receipt };
    } catch (err) {
      console.error('[IPC printer:printSilent Error]', err);
      return { success: false, error: err.message };
    }
  });
}

// Start lightweight local HTTP API bridge so browser preview has 100% full DB access
function startLocalHttpBridge() {
  const http = require('http');
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      return res.end();
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { sql, params } = JSON.parse(body || '{}');
          if (!db) db = await getDatabase();
          
          if (req.url === '/api/query') {
            const data = db.all(sql, params || []);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data }));
          } else if (req.url === '/api/get') {
            const data = db.get(sql, params || []);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, data }));
          } else if (req.url === '/api/run') {
            const result = db.run(sql, params || []);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, ...result }));
          } else {
            res.writeHead(404);
            res.end();
          }
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  server.listen(5174, '127.0.0.1', () => {
    console.log('[Main] Local DB HTTP Bridge listening on http://127.0.0.1:5174');
  });
}

app.whenReady().then(async () => {
  try {
    // Initialize SQLite database
    db = await getDatabase();
    console.log('[Main] SQLite Database loaded and ready.');
  } catch (err) {
    console.error('[Main] Failed to initialize DB on startup:', err);
  }

  registerIpcHandlers();
  startLocalHttpBridge();
  startAutoBackup();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
