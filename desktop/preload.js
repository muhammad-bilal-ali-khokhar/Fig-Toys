"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("fig", {
  isElectron: true,
  platform: process.platform,
  runtime: {
    get: () => ipcRenderer.invoke("runtime:get"),
    set: (cfg) => ipcRenderer.invoke("runtime:set", cfg),
  },
  theme: {
    get: () => ipcRenderer.invoke("theme:get"),
    set: (theme) => ipcRenderer.invoke("theme:set", theme),
  },
  report: {
    get: () => ipcRenderer.invoke("report:get"),
    set: (cfg) => ipcRenderer.invoke("report:set", cfg),
    send: () => ipcRenderer.invoke("report:send"),
  },
  logs: {
    get: () => ipcRenderer.invoke("logs:get"),
    open: () => ipcRenderer.invoke("logs:open"),
  },
  dialog: {
    pickDirectory: () => ipcRenderer.invoke("dialog:pick-directory"),
  },
  update: {
    status: () => ipcRenderer.invoke("update:status"),
    check: () => ipcRenderer.invoke("update:check"),
    download: () => ipcRenderer.invoke("update:download"),
    install: () => ipcRenderer.invoke("update:install"),
    openChangelog: () => ipcRenderer.invoke("update:open-changelog"),
    onStatus: (cb) => {
      const handler = (_event, state) => cb(state);
      ipcRenderer.on("update:status", handler);
      return () => ipcRenderer.removeListener("update:status", handler);
    },
  },
  content: {
    status: () => ipcRenderer.invoke("content:status"),
    check: () => ipcRenderer.invoke("content:check"),
    apply: () => ipcRenderer.invoke("content:apply"),
    onStatus: (cb) => {
      const handler = (_event, state) => cb(state);
      ipcRenderer.on("content:status", handler);
      return () => ipcRenderer.removeListener("content:status", handler);
    },
  },
  error: {
    get: () => ipcRenderer.invoke("error:get"),
    copy: (text) => ipcRenderer.invoke("error:copy", text),
  },
  share: {
    pdf: (dataUrl, name) => ipcRenderer.invoke("share:pdf", dataUrl, name),
  },
  loading: {
    onStatus: (cb) => ipcRenderer.on("loading:status", (_event, text) => cb(text)),
  },
  about: {
    open: () => ipcRenderer.invoke("about:open"),
    close: () => ipcRenderer.invoke("about:close"),
    info: () => ipcRenderer.invoke("about:info"),
  },
});