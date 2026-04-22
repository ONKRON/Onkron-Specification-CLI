const { withDbConnection, fetchSourceRows, upsertSpecification } = require("./db");

async function runSpecificationUpdate({
  taskName,
  sourceLanguageId = 1,
  targetLanguageId,
  specificationId,
  transform,
  dryRun = false,
}) {
  if (!taskName || !targetLanguageId || !specificationId || typeof transform !== "function") {
    throw new Error("Invalid task configuration");
  }

  return withDbConnection(async (connection) => {
    const rows = await fetchSourceRows(connection, {
      sourceLanguageId,
      specificationId,
    });

    const stats = {
      taskName,
      sourceLanguageId,
      targetLanguageId,
      specificationId,
      total: rows.length,
      updated: 0,
      skipped: 0,
      failed: 0,
      dryRun,
    };

    for (const row of rows) {
      try {
        const transformed = transform(row);
        if (transformed === null || transformed === undefined || transformed === "") {
          stats.skipped += 1;
          continue;
        }

        if (!dryRun) {
          await upsertSpecification(connection, {
            productId: row.products_id,
            languageId: targetLanguageId,
            specification: transformed,
            specificationId,
          });
        }

        stats.updated += 1;
      } catch (error) {
        stats.failed += 1;
        console.error(
          `[${taskName}] Failed for product ${row.products_id}: ${error.message}`
        );
      }
    }

    return stats;
  });
}

function printStats(stats) {
  console.log("\n=== REPORT ===");
  console.log(`Task: ${stats.taskName}`);
  console.log(`Source language: ${stats.sourceLanguageId}`);
  console.log(`Target language: ${stats.targetLanguageId}`);
  console.log(`Specification ID: ${stats.specificationId}`);
  console.log(`Total: ${stats.total}`);
  console.log(`Updated: ${stats.updated}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Failed: ${stats.failed}`);
  console.log(`Mode: ${stats.dryRun ? "dry-run" : "write"}`);
}

module.exports = {
  runSpecificationUpdate,
  printStats,
};
