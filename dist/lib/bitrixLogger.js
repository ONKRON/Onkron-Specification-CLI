const APP_TAG = "Webobscurium";
const BITRIX_WEBHOOK_URL = String(process.env.BITRIX_WEBHOOK_URL || "").trim();
const BITRIX_WEBHOOK_BASE_URL = String(
  process.env.BITRIX_WEBHOOK_BASE_URL || "",
).trim();
const BITRIX_CHAT_URL = String(process.env.BITRIX_CHAT_URL || "").trim();
const BITRIX_DIALOG_ID = String(process.env.BITRIX_DIALOG_ID || "").trim();
const BITRIX_TIMEOUT_MS = Number(process.env.BITRIX_TIMEOUT_MS || 4000);

function normalizeBaseUrl(url) {
  return String(url || "")
    .trim()
    .replace(/\/+$/, "");
}

function parseDialogIdFromChatUrl(chatUrl) {
  if (!chatUrl) {
    return "";
  }

  try {
    const parsed = new URL(chatUrl);
    return String(parsed.searchParams.get("IM_DIALOG") || "").trim();
  } catch (_error) {
    return "";
  }
}

function resolveDialogId() {
  if (BITRIX_DIALOG_ID) {
    return BITRIX_DIALOG_ID;
  }

  return parseDialogIdFromChatUrl(BITRIX_CHAT_URL);
}

function createAbortSignal(timeoutMs) {
  if (typeof AbortController === "undefined") {
    return null;
  }

  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs).unref?.();
  return controller.signal;
}

function collectStats(input) {
  if (!input) {
    return [];
  }

  if (Array.isArray(input)) {
    return input;
  }

  return [input];
}

function sumBy(stats, key) {
  return stats.reduce((acc, item) => acc + (Number(item?.[key]) || 0), 0);
}

function buildMessage({
  channel,
  task,
  dryRun,
  user,
  sourceLanguageId,
  targetLanguageId,
  productId,
  productName,
  specIds,
  stats,
}) {
  const lines = [
    `[${APP_TAG}]`,
    `Channel: ${channel || "-"}`,
    `Task: ${task || "-"}`,
    `Mode: ${dryRun ? "dry-run" : "write"}`,
    `Updated: ${sumBy(stats, "updated")}`,
    `Skipped: ${sumBy(stats, "skipped")}`,
    `Failed: ${sumBy(stats, "failed")}`,
  ];

  if (user) {
    lines.push(`User: ${user}`);
  }

  if (sourceLanguageId) {
    lines.push(`Source language: ${sourceLanguageId}`);
  }

  if (targetLanguageId) {
    lines.push(`Target: ${targetLanguageId}`);
  }

  if (productId) {
    lines.push(`Product ID: ${productId}`);
  }

  if (productName) {
    lines.push(`Product: ${productName}`);
  }

  if (Array.isArray(specIds) && specIds.length > 0) {
    lines.push(`Spec IDs: ${specIds.join(", ")}`);
  }

  lines.push(`Time: ${new Date().toISOString()}`);
  return lines.join("\n");
}

async function postToBitrixChat(message) {
  const baseUrl = normalizeBaseUrl(BITRIX_WEBHOOK_BASE_URL);
  const dialogId = resolveDialogId();
  if (!baseUrl || !dialogId) {
    return false;
  }

  const endpoint = `${baseUrl}/im.message.add.json`;
  const body = new URLSearchParams({
    DIALOG_ID: dialogId,
    MESSAGE: message,
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body,
    signal: createAbortSignal(BITRIX_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Bitrix chat API responded with HTTP ${response.status}`);
  }

  return true;
}

async function postToGenericWebhook(payload) {
  if (!BITRIX_WEBHOOK_URL) {
    return false;
  }

  const response = await fetch(BITRIX_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: createAbortSignal(BITRIX_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Bitrix webhook responded with HTTP ${response.status}`);
  }

  return true;
}

async function sendBitrixChangeLog({
  channel,
  task,
  dryRun = false,
  user = null,
  sourceLanguageId = null,
  targetLanguageId = null,
  productId = null,
  productName = null,
  specIds = [],
  stats = [],
}) {
  const normalizedStats = collectStats(stats);
  const updated = sumBy(normalizedStats, "updated");

  if (dryRun || updated <= 0) {
    return false;
  }

  const message = buildMessage({
    channel,
    task,
    dryRun,
    user,
    sourceLanguageId,
    targetLanguageId,
    productId,
    productName,
    specIds,
    stats: normalizedStats,
  });

  const genericPayload = {
    app: APP_TAG,
    channel: channel || null,
    task: task || null,
    dryRun: Boolean(dryRun),
    user: user || null,
    sourceLanguageId: sourceLanguageId ?? null,
    targetLanguageId: targetLanguageId ?? null,
    productId: productId ?? null,
    productName: productName ?? null,
    specIds: Array.isArray(specIds) ? specIds : [],
    updated,
    skipped: sumBy(normalizedStats, "skipped"),
    failed: sumBy(normalizedStats, "failed"),
    timestamp: new Date().toISOString(),
    message,
  };

  try {
    const sentToChat = await postToBitrixChat(message);
    if (sentToChat) {
      return true;
    }

    return await postToGenericWebhook(genericPayload);
  } catch (error) {
    console.error(`[bitrix-log] ${error.message}`);
    return false;
  }
}

module.exports = {
  sendBitrixChangeLog,
  parseDialogIdFromChatUrl,
};
