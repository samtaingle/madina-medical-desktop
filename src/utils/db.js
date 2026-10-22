/**
 * Universal Database Client for Madina Medical
 * Works via native Electron IPC (`window.api.invoke`)
 * AND automatically falls back to local HTTP bridge on http://127.0.0.1:5174 if opened in a browser!
 */

const LOCAL_BRIDGE_URL = 'http://127.0.0.1:5174';

export async function query(sql, params = []) {
  if (window.api && window.api.invoke) {
    const res = await window.api.invoke('db:all', sql, params);
    if (!res.success) throw new Error(res.error);
    return res.data;
  }

  // Browser fallback to local HTTP bridge
  try {
    const resp = await fetch(`${LOCAL_BRIDGE_URL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    });
    const res = await resp.json();
    if (!res.success) throw new Error(res.error);
    return res.data;
  } catch (err) {
    console.warn('[DB Bridge] Could not reach local bridge:', err.message);
    return [];
  }
}

export async function getOne(sql, params = []) {
  if (window.api && window.api.invoke) {
    const res = await window.api.invoke('db:get', sql, params);
    if (!res.success) throw new Error(res.error);
    return res.data;
  }

  try {
    const resp = await fetch(`${LOCAL_BRIDGE_URL}/api/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    });
    const res = await resp.json();
    if (!res.success) throw new Error(res.error);
    return res.data;
  } catch (err) {
    console.warn('[DB Bridge] Could not reach local bridge:', err.message);
    return null;
  }
}

export async function run(sql, params = []) {
  if (window.api && window.api.invoke) {
    const res = await window.api.invoke('db:run', sql, params);
    if (!res.success) throw new Error(res.error);
    return { lastInsertRowid: res.lastInsertRowid, changes: res.changes };
  }

  try {
    const resp = await fetch(`${LOCAL_BRIDGE_URL}/api/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    });
    const res = await resp.json();
    if (!res.success) throw new Error(res.error);
    return { lastInsertRowid: res.lastInsertRowid, changes: res.changes };
  } catch (err) {
    console.warn('[DB Bridge] Could not reach local bridge:', err.message);
    return { lastInsertRowid: 0, changes: 0 };
  }
}
