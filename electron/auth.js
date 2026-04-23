const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

dotenv.config();

const failedAttempts = new Map();

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function isAuthRequired() {
  return parseBoolean(process.env.AUTH_REQUIRED, true);
}

function getAuthTableName() {
  const table = (process.env.AUTH_TABLE || "auth_users").trim();
  if (!/^[A-Za-z0-9_]+$/.test(table)) {
    throw new Error("AUTH_TABLE contains invalid characters");
  }
  return table;
}

function getAuthDbConfig() {
  const connectionUrl = process.env.AUTH_DB_URL || process.env.AUTH_DATABASE_URL;
  if (connectionUrl) {
    const parsed = new URL(connectionUrl);
    if (parsed.protocol !== "mysql:") {
      throw new Error("AUTH_DB_URL must start with mysql://");
    }

    const dbName = parsed.pathname.replace(/^\//, "").trim();
    if (!dbName) {
      throw new Error("AUTH_DB_URL must include database name");
    }

    const useSsl = parseBoolean(process.env.AUTH_DB_SSL, false);
    const rejectUnauthorized = parseBoolean(
      process.env.AUTH_DB_SSL_REJECT_UNAUTHORIZED,
      true
    );

    return {
      host: parsed.hostname,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password || ""),
      database: dbName,
      port: Number(parsed.port || 3306),
      ssl: useSsl ? { rejectUnauthorized } : undefined,
    };
  }

  const host = process.env.AUTH_DB_HOST || process.env.host;
  const user = process.env.AUTH_DB_USER || process.env.user;
  const database = process.env.AUTH_DB_NAME || process.env.database;
  const password = process.env.AUTH_DB_PASSWORD || process.env.password;
  const port = Number(process.env.AUTH_DB_PORT || process.env.port || 3306);

  if (!host || !user || !database) {
    throw new Error("Missing auth DB config. Set AUTH_DB_HOST, AUTH_DB_USER, AUTH_DB_NAME");
  }

  if (!Number.isInteger(port) || port < 1) {
    throw new Error("AUTH_DB_PORT must be a positive integer");
  }

  const useSsl = parseBoolean(process.env.AUTH_DB_SSL, false);
  const rejectUnauthorized = parseBoolean(
    process.env.AUTH_DB_SSL_REJECT_UNAUTHORIZED,
    true
  );

  return {
    host,
    user,
    database,
    password,
    port,
    ssl: useSsl ? { rejectUnauthorized } : undefined,
  };
}

function getPasswordHashFromRow(row) {
  return row.password_hash || row.passwordHash || row.password || null;
}

function isUserActive(row) {
  if (row.is_active === undefined || row.is_active === null) {
    return true;
  }

  return Number(row.is_active) !== 0;
}

function getLockConfig() {
  const maxAttempts = Number(process.env.AUTH_MAX_FAILED_ATTEMPTS || 5);
  const lockMs = Number(process.env.AUTH_LOCKOUT_MS || 300000);

  return {
    maxAttempts: Number.isInteger(maxAttempts) && maxAttempts > 0 ? maxAttempts : 5,
    lockMs: Number.isInteger(lockMs) && lockMs > 0 ? lockMs : 300000,
  };
}

function getAttemptState(username) {
  const key = username.toLowerCase();
  const state = failedAttempts.get(key);

  if (!state) {
    return { key, count: 0, lockedUntil: 0 };
  }

  if (state.lockedUntil > 0 && Date.now() > state.lockedUntil) {
    failedAttempts.delete(key);
    return { key, count: 0, lockedUntil: 0 };
  }

  return { key, ...state };
}

function registerFailure(username) {
  const { maxAttempts, lockMs } = getLockConfig();
  const { key, count, lockedUntil } = getAttemptState(username);
  const nextCount = count + 1;

  if (lockedUntil > Date.now()) {
    failedAttempts.set(key, { count: nextCount, lockedUntil });
    return;
  }

  if (nextCount >= maxAttempts) {
    failedAttempts.set(key, { count: nextCount, lockedUntil: Date.now() + lockMs });
    return;
  }

  failedAttempts.set(key, { count: nextCount, lockedUntil: 0 });
}

function clearFailures(username) {
  failedAttempts.delete(username.toLowerCase());
}

function getRemainingLockMs(username) {
  const { lockedUntil } = getAttemptState(username);
  if (!lockedUntil || lockedUntil <= Date.now()) {
    return 0;
  }
  return lockedUntil - Date.now();
}

function toPublicUser(row) {
  return {
    id: Number(row.id),
    username: String(row.username),
  };
}

async function fetchUserByUsername(username) {
  const connection = await mysql.createConnection(getAuthDbConfig());
  const tableName = getAuthTableName();

  try {
    const [rows] = await connection.execute(
      `
        SELECT id, username, password_hash, is_active
        FROM \`${tableName}\`
        WHERE username = ?
        LIMIT 1
      `,
      [username]
    );

    return rows[0] || null;
  } finally {
    await connection.end();
  }
}

async function authenticate(credentials) {
  if (!isAuthRequired()) {
    return {
      id: 0,
      username: "local",
    };
  }

  const username = String(credentials?.username || "").trim();
  const password = String(credentials?.password || "");

  if (!username || !password) {
    throw new Error("Username and password are required");
  }

  const remainingMs = getRemainingLockMs(username);
  if (remainingMs > 0) {
    const seconds = Math.ceil(remainingMs / 1000);
    throw new Error(`Too many attempts. Try again in ${seconds}s`);
  }

  const row = await fetchUserByUsername(username);
  const passwordHash = row ? getPasswordHashFromRow(row) : null;
  const hasValidPassword =
    Boolean(row) && Boolean(passwordHash) && (await bcrypt.compare(password, passwordHash));

  if (!hasValidPassword || !isUserActive(row)) {
    registerFailure(username);
    throw new Error("Invalid credentials");
  }

  clearFailures(username);
  return toPublicUser(row);
}

module.exports = {
  isAuthRequired,
  authenticate,
};
