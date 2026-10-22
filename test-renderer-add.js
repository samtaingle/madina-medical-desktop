const { app, BrowserWindow } = require('electron');
const path = require('path');
const { getDatabase } = require('./electron/db/connection');

app.whenReady().then(async () => {
  const db = await getDatabase();
  const { ipcMain } = require('electron');

  ipcMain.handle('db:run', async (event, sql, params = []) => {
    try {
      console.log('[TEST db:run CALL]', sql, params);
      const res = db.run(sql, params);
      console.log('[TEST db:run RESULT]', res);
      return { success: true, ...res };
    } catch (e) {
      console.error('[TEST db:run ERROR]', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('db:all', async (event, sql, params = []) => {
    try {
      const res = db.all(sql, params);
      return { success: true, data: res };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'electron/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.webContents.on('console-message', (e, level, msg) => {
    console.log('[BROWSER CONSOLE]', msg);
  });

  await win.loadFile(path.join(__dirname, 'dist/index.html'));

  setTimeout(async () => {
    try {
      console.log('Testing invoke from window.api...');
      const result = await win.webContents.executeJavaScript(`
        window.api.invoke('db:run', 
          'INSERT INTO medicines (name, generic_name, manufacturer, hsn_code, gst_rate, reorder_level, unit, barcode) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          ['Test Direct Med', 'Direct Salt', 'Cipla', '3004', 12, 10, 'strip', null]
        )
      `);
      console.log('Renderer invoke result:', result);

      const check = db.all("SELECT id, name FROM medicines WHERE name = 'Test Direct Med'");
      console.log('DB Check after renderer invoke:', check);

      // Clean up
      db.run("DELETE FROM medicines WHERE name = 'Test Direct Med'");
      console.log('Cleaned up direct test.');
    } catch (err) {
      console.error('Renderer execution error:', err);
    } finally {
      app.quit();
    }
  }, 1000);
});
