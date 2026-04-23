const path = require("path");
const fs = require("fs");
const { app, BrowserWindow, ipcMain, nativeImage } = require("electron");
const { COUNTRY_BY_LANGUAGE_ID } = require("../dist/config/specs");
const { runTask } = require("../dist/cli");
const {
  listTransferProducts,
  getTransferProductSpecifications,
  transferSelectedProductSpecifications,
} = require("../dist/lib/transfer");
const { isAuthRequired, authenticate } = require("./auth");
const ALL_TARGETS = "all";
const TRANSFER_SOURCE_LANGUAGE_ID = Number(
  process.env.TRANSFER_SOURCE_LANGUAGE_ID || 1
);
let sessionUser = null;

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

function getSessionState() {
  const required = isAuthRequired();
  if (!required) {
    return {
      required: false,
      authenticated: true,
      user: { id: 0, username: "local" },
    };
  }

  return {
    required: true,
    authenticated: Boolean(sessionUser),
    user: sessionUser,
  };
}

function ensureAuthenticated() {
  const session = getSessionState();
  if (!session.required) {
    return;
  }
  if (!session.authenticated) {
    throw new Error("Authentication required");
  }
}

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

ipcMain.handle("spec:auth:get-config", async () => ({
  required: isAuthRequired(),
}));

ipcMain.handle("spec:auth:get-session", async () => getSessionState());

ipcMain.handle("spec:auth:login", async (_event, credentials) => {
  const user = await authenticate(credentials);
  sessionUser = user;
  return getSessionState();
});

ipcMain.handle("spec:auth:logout", async () => {
  sessionUser = null;
  return getSessionState();
});

ipcMain.handle("spec:run-task", async (_event, payload) => {
  ensureAuthenticated();

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

ipcMain.handle("spec:transfer:list-products", async (_event, payload) => {
  ensureAuthenticated();

  const {
    search = "",
    limit = 120,
  } = payload || {};

  return listTransferProducts({
    sourceLanguageId: normalizeLanguageInput(
      TRANSFER_SOURCE_LANGUAGE_ID,
      1
    ),
    search: String(search || ""),
    limit: Number(limit) || 120,
  });
});

ipcMain.handle("spec:transfer:get-product-specs", async (_event, payload) => {
  ensureAuthenticated();

  const {
    productId,
  } = payload || {};

  const normalizedProductId = Number(productId);
  if (!Number.isInteger(normalizedProductId) || normalizedProductId < 1) {
    throw new Error("Valid productId is required");
  }

  return getTransferProductSpecifications({
    sourceLanguageId: normalizeLanguageInput(
      TRANSFER_SOURCE_LANGUAGE_ID,
      1
    ),
    productId: normalizedProductId,
  });
});

ipcMain.handle("spec:transfer:submit", async (_event, payload) => {
  ensureAuthenticated();

  const {
    productId,
    targetLanguageId = ALL_TARGETS,
    specIds = [],
    dryRun = false,
  } = payload || {};

  const normalizedProductId = Number(productId);
  if (!Number.isInteger(normalizedProductId) || normalizedProductId < 1) {
    throw new Error("Valid productId is required");
  }

  return transferSelectedProductSpecifications({
    productId: normalizedProductId,
    sourceLanguageId: normalizeLanguageInput(
      TRANSFER_SOURCE_LANGUAGE_ID,
      1
    ),
    targetLanguageId: normalizeLanguageInput(targetLanguageId, ALL_TARGETS, {
      allowAll: true,
    }),
    specIds: Array.isArray(specIds) ? specIds.map((id) => Number(id)) : [],
    dryRun: Boolean(dryRun),
  });
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
