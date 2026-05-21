const mysql = require("mysql2/promise");
const dotenv = require("dotenv");
const { getAuthDbConfig, isAuthRequired } = require("../electron/auth");

dotenv.config();

function parseBoolean(value, fallback = true) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(
    String(value).trim().toLowerCase(),
  );
}

function getAuditTableName() {
  const table = String(process.env.AUDIT_TABLE || "audit_logs").trim();
  if (!/^[A-Za-z0-9_]+$/.test(table)) {
    throw new Error("AUDIT_TABLE содержит недопустимые символы");
  }
  return table;
}

function getClientIp(req) {
  const forwardedFor = String(req?.headers?.["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return (
    String(req?.headers?.["cf-connecting-ip"] || "").trim() ||
    String(req?.headers?.["x-real-ip"] || "").trim() ||
    forwardedFor ||
    String(req?.socket?.remoteAddress || "")
  );
}

function serializeSpecIds(specIds) {
  if (Array.isArray(specIds)) {
    const serialized = specIds
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)
      .join(",");
    return serialized || null;
  }

  const value = String(specIds || "").trim();
  return value || null;
}

function normalizeProductId(productId) {
  const normalized = Number(productId);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
}

async function writeAuditLog({
  req,
  user,
  username,
  role,
  action,
  productId = null,
  specIds = null,
}) {
  if (!parseBoolean(process.env.AUDIT_LOG_ENABLED, true) || !isAuthRequired()) {
    return;
  }

  const tableName = getAuditTableName();
  const connection = await mysql.createConnection(getAuthDbConfig());

  try {
    await connection.execute(
      `
        INSERT INTO \`${tableName}\`
          (username, role, action, product_id, specification_ids, ip, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        String(username || user?.username || "unknown").slice(0, 191),
        String(role || user?.role || "user").slice(0, 32),
        String(action || "unknown").slice(0, 191),
        normalizeProductId(productId),
        serializeSpecIds(specIds),
        getClientIp(req).slice(0, 64) || null,
        String(req?.headers?.["user-agent"] || "").slice(0, 1000) || null,
      ],
    );
  } finally {
    await connection.end();
  }
}

function auditLog(payload) {
  void writeAuditLog(payload).catch((error) => {
    console.warn(`[audit] ${error?.message || error}`);
  });
}

module.exports = {
  auditLog,
  writeAuditLog,
};
