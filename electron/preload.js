const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  invoke: (channel, ...args) => {
    const validPrefixes = ['db:', 'printer:', 'app:', 'backup:'];
    const isValid = validPrefixes.some(prefix => channel.startsWith(prefix));
    if (isValid) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`));
  },
  on: (channel, listener) => {
    ipcRenderer.on(channel, (event, ...args) => listener(...args));
  },
  removeListener: (channel, listener) => {
    ipcRenderer.removeListener(channel, listener);
  }
});
