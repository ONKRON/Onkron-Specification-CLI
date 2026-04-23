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
      SELECT
        ps.products_id,
        ps.language_id,
        ps.specification,
        ps.specifications_id
      FROM products_specifications ps
      INNER JOIN (
        SELECT
          products_id,
          specifications_id,
          language_id,
          MAX(products_specification_id) AS max_id
        FROM products_specifications
        WHERE language_id = ? AND specifications_id = ?
        GROUP BY products_id, specifications_id, language_id
      ) latest
        ON latest.max_id = ps.products_specification_id
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
  const [updateResult] = await connection.execute(
    `
      UPDATE products_specifications
      SET specification = ?
      WHERE products_id = ? AND language_id = ? AND specifications_id = ?
    `,
    [specification, productId, languageId, specificationId]
  );

  if (updateResult.affectedRows > 0) {
    return;
  }

  await connection.execute(
    `
      INSERT INTO products_specifications
        (products_id, language_id, specification, specifications_id)
      VALUES (?, ?, ?, ?)
    `,
    [productId, languageId, specification, specificationId]
  );
}

module.exports = {
  withDbConnection,
  fetchSourceRows,
  upsertSpecification,
};
