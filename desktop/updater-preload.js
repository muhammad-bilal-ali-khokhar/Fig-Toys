"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("updater", {
  onStatus: (cb) => {
    const h = (_e, s) => cb(s);
    ipcRenderer.on("updater:status", h);
    return () => ipcRenderer.removeListener("updater:status", h);
  },
});
