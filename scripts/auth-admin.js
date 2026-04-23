#!/usr/bin/env node

const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

dotenv.config();

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
}

function getAuthTableName() {
  const table = (process.env.AUTH_TABLE || "auth_users").trim();
  if (!/^[A-Za-z0-9_]+$/.test(table)) {
    throw new Error("AUTH_TABLE contains invalid characters");
  }
  return table;
}

function getDbConfig() {
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

function getRounds() {
  const rounds = Number(process.env.AUTH_BCRYPT_ROUNDS || 12);
  if (!Number.isInteger(rounds) || rounds < 8 || rounds > 15) {
    throw new Error("AUTH_BCRYPT_ROUNDS must be an integer in range 8..15");
  }
  return rounds;
}

function normalizeUsername(value) {
  const username = String(value || "").trim();
  if (!username) {
    throw new Error("Username is required");
  }
  if (username.length > 100) {
    throw new Error("Username is too long (max 100 chars)");
  }
  return username;
}

function normalizePassword(value) {
  const password = String(value || "");
  if (!password) {
    throw new Error("Password is required");
  }
  if (password.length < 8) {
    throw new Error("Password must contain at least 8 characters");
  }
  return password;
}

function usage() {
  return `
Usage:
  npm run auth:init-table
  npm run auth:create-user -- <username> <password>
  npm run auth:reset-password -- <username> <password>
  npm run auth:disable-user -- <username>
`;
}

async function initTable(connection, tableName) {
  await connection.execute(
    `
      CREATE TABLE IF NOT EXISTS \`${tableName}\` (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `
  );

  console.log(`Table ready: ${tableName}`);
}

async function createUser(connection, tableName, username, password) {
  const hash = await bcrypt.hash(password, getRounds());
  await connection.execute(
    `
      INSERT INTO \`${tableName}\` (username, password_hash, is_active)
      VALUES (?, ?, 1)
    `,
    [username, hash]
  );
  console.log(`User created: ${username}`);
}

async function resetPassword(connection, tableName, username, password) {
  const hash = await bcrypt.hash(password, getRounds());
  const [result] = await connection.execute(
    `
      UPDATE \`${tableName}\`
      SET password_hash = ?, is_active = 1
      WHERE username = ?
      LIMIT 1
    `,
    [hash, username]
  );

  if (result.affectedRows === 0) {
    throw new Error(`User not found: ${username}`);
  }

  console.log(`Password updated: ${username}`);
}

async function disableUser(connection, tableName, username) {
  const [result] = await connection.execute(
    `
      UPDATE \`${tableName}\`
      SET is_active = 0
      WHERE username = ?
      LIMIT 1
    `,
    [username]
  );

  if (result.affectedRows === 0) {
    throw new Error(`User not found: ${username}`);
  }

  console.log(`User disabled: ${username}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(usage().trim());
    return;
  }

  const command = args[0];
  const arg1 = args[1];
  const arg2 = args[2];

  if (!command) {
    console.log(usage().trim());
    return;
  }

  const tableName = getAuthTableName();
  const connection = await mysql.createConnection(getDbConfig());

  try {
    if (command === "init-table") {
      await initTable(connection, tableName);
      return;
    }

    if (command === "create-user") {
      const username = normalizeUsername(arg1);
      const password = normalizePassword(arg2);
      await createUser(connection, tableName, username, password);
      return;
    }

    if (command === "reset-password") {
      const username = normalizeUsername(arg1);
      const password = normalizePassword(arg2);
      await resetPassword(connection, tableName, username, password);
      return;
    }

    if (command === "disable-user") {
      const username = normalizeUsername(arg1);
      await disableUser(connection, tableName, username);
      return;
    }

    throw new Error(`Unknown command: ${command}`);
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY") {
      throw new Error(`User already exists: ${arg1}`);
    }
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  console.log(usage().trim());
  process.exitCode = 1;
});
