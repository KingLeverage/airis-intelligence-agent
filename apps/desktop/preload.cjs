"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("airisNativeShell", {
  isElectron: true,
  /** Position the native BrowserView over this rect (window / client coordinates, device pixels). */
  setBounds: (bounds) => ipcRenderer.invoke("airis:native-browser:setBounds", bounds),
  loadURL: (url) => ipcRenderer.invoke("airis:native-browser:loadURL", url),
  goBack: () => ipcRenderer.invoke("airis:native-browser:goBack"),
  reload: () => ipcRenderer.invoke("airis:native-browser:reload"),
  getCurrentUrl: () => ipcRenderer.invoke("airis:native-browser:getCurrentUrl"),
  /** Subscribe to top-level and in-page navigations in the BrowserView. */
  onNavigated: (fn) => {
    const listener = (_event, url) => {
      if (typeof url === "string") fn(url);
    };
    ipcRenderer.on("airis:native-browser:navigated", listener);
    return () => ipcRenderer.removeListener("airis:native-browser:navigated", listener);
  },
  /** Window resized — re-measure your viewport and call setBounds again. */
  onRequestBoundsRefresh: (fn) => {
    const listener = () => fn();
    ipcRenderer.on("airis:native-browser:request-bounds", listener);
    return () => ipcRenderer.removeListener("airis:native-browser:request-bounds", listener);
  },
});
