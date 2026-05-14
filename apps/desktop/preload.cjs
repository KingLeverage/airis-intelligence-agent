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
  evaluate: (expression, timeoutMs) =>
    ipcRenderer.invoke("airis:native-browser:evaluate", { expression, timeoutMs }),
  scrollWheel: (payload) => ipcRenderer.invoke("airis:native-browser:scrollWheel", payload ?? {}),
  extractText: async () => {
    const bs = "\\";
    const expression = `(function(){
      function pickContainer() {
        var sels = ['[role="feed"]','[role="main"]','main','article','#content','#main','body'];
        for (var i = 0; i < sels.length; i++) {
          var el = document.querySelector(sels[i]);
          if (!el) continue;
          var t = (el.innerText || '').trim();
          if (sels[i] === 'body' || t.length > 50) return el;
        }
        return document.body;
      }
      var container = pickContainer() || document.body;
      var raw = (container.innerText || '')
        .replace(/${bs}u00a0/g, ' ')
        .replace(/[ ${bs}t]+${bs}n/g, String.fromCharCode(10))
        .replace(/${bs}n{3,}/g, String.fromCharCode(10, 10))
        .trim();
      return { text: raw, url: location.href, title: document.title };
    })()`;
    const r = await ipcRenderer.invoke("airis:native-browser:evaluate", {
      expression,
      timeoutMs: 15_000,
    });
    if (!r || r.ok !== true) {
      return { ok: false, error: typeof r?.error === "string" ? r.error : "extractText_failed" };
    }
    const inner = r.result;
    let text = "";
    let url = "";
    let title = "";
    if (inner && typeof inner === "object") {
      text = typeof inner.text === "string" ? inner.text : String(inner.text ?? "");
      url = typeof inner.url === "string" ? inner.url : "";
      title = typeof inner.title === "string" ? inner.title : "";
    } else {
      text = typeof inner === "string" ? inner : String(inner ?? "");
    }
    const cap = 200_000;
    const marker = "\n…[truncated]";
    if (text.length > cap) {
      text = text.slice(0, Math.max(0, cap - marker.length)) + marker;
    }
    return { ok: true, url, title, text };
  },
  extractHtml: () => ipcRenderer.invoke("airis:native-browser:extractHtml"),
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
