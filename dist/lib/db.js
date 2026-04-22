const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

dotenv.config();

function getDbConfig() {
  const { host, user, database, password } = process.env;

  if (!host || !user || !database) {
    throw new Error("Missing DB config. Set host, user, database, password in .env");
  }

  return { host, user, database, password };
}

async function withDbConnection(fn) {
  const connection = await mysql.createConnection(getDbConfig());

  try {
    return await fn(connection);
  } finally {
    await connection.end();
  }
}

async function fetchSourceRows(connection, { sourceLanguageId, specificationId }) {
  const [rows] = await connection.execute(
    `
      SELECT products_id, language_id, specification, specifications_id
      FROM products_specifications
      WHERE language_id = ? AND specifications_id = ?
    `,
    [sourceLanguageId, specificationId]
  );

  return rows;
}

async function upsertSpecification(connection, {
  productId,
  languageId,
  specification,
  specificationId,
}) {
  await connection.execute(
    `
      INSERT INTO products_specifications
        (products_id, language_id, specification, specifications_id)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        specification = VALUES(specification),
        language_id = VALUES(language_id)
    `,
    [productId, languageId, specification, specificationId]
  );
}

module.exports = {
  withDbConnection,
  fetchSourceRows,
  upsertSpecification,
};
