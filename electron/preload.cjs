const { contextBridge } = require('electron');

// The only thing the page gets from the desktop shell: a way to know it is running in one.
// Everything else the app needs comes from the deployed web app itself.
contextBridge.exposeInMainWorld('desktop', { isElectron: true });
