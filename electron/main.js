const path = require("path");
const fs = require("fs");
const { app, BrowserWindow, ipcMain, nativeImage } = require("electron");
const { COUNTRY_BY_LANGUAGE_ID } = require("../dist/config/specs");
const { runTask } = require("../dist/cli");
const ALL_TARGETS = "all";

function resolveIconPath() {
  const candidates = [
    path.join(__dirname, "..", "build", "icons", "icon.icns"),
    path.join(__dirname, "..", "build", "icons", "icon.png"),
    path.join(__dirname, "..", "build", "icons", "icon.ico"),
    path.join(__dirname, "..", "build", "icons", "icon.jpg"),
    path.join(__dirname, "..", "build", "icons", "icon.jpeg"),
  ];

  let bestPath = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    const iconImage = nativeImage.createFromPath(candidate);
    if (iconImage.isEmpty()) {
      continue;
    }

    const { width, height } = iconImage.getSize();
    const extension = path.extname(candidate).toLowerCase();
    const pixelScore = Math.max(0, width) * Math.max(0, height);
    const macIcnsBonus =
      process.platform === "darwin" && extension === ".icns" ? 1_000_000_000 : 0;
    const score = macIcnsBonus + pixelScore;

    if (score > bestScore) {
      bestScore = score;
      bestPath = candidate;
    }
  }

  return bestPath;
}

const appIconPath = resolveIconPath();

function normalizeLanguageInput(value, fallback, { allowAll = false } = {}) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return fallback;
    }
    if (allowAll && normalized === ALL_TARGETS) {
      return ALL_TARGETS;
    }

    const parsed = Number(normalized);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }

  return fallback;
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1260,
    height: 860,
    minWidth: 1000,
    minHeight: 680,
    title: "VamShop Spec GUI",
    backgroundColor: "#f4f1e8",
    ...(appIconPath ? { icon: appIconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

ipcMain.handle("spec:get-countries", async () => COUNTRY_BY_LANGUAGE_ID);

ipcMain.handle("spec:run-task", async (_event, payload) => {
  const {
    task,
    sourceLanguageId = 1,
    targetLanguageId = ALL_TARGETS,
    materialLanguageId = ALL_TARGETS,
    dryRun = false,
  } = payload || {};

  if (!task) {
    throw new Error("Task is required");
  }

  const flags = {
    sourceLanguageId: normalizeLanguageInput(sourceLanguageId, 1),
    targetLanguageId: normalizeLanguageInput(targetLanguageId, ALL_TARGETS, {
      allowAll: true,
    }),
    materialLanguageId: normalizeLanguageInput(materialLanguageId, ALL_TARGETS, {
      allowAll: true,
    }),
    dryRun: Boolean(dryRun),
  };

  const result = await runTask(task, flags);
  const tasks = Array.isArray(result) ? result : [result];

  return {
    ok: true,
    task,
    tasks,
    finishedAt: new Date().toISOString(),
  };
});

app.whenReady().then(() => {
  if (process.platform === "darwin" && appIconPath) {
    const iconImage = nativeImage.createFromPath(appIconPath);
    if (!iconImage.isEmpty()) {
      app.dock.setIcon(iconImage);
    }
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
