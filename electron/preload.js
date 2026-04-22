const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("specApi", {
  getCountries: () => ipcRenderer.invoke("spec:get-countries"),
  runTask: (payload) => ipcRenderer.invoke("spec:run-task", payload),
});
