const {
  COUNTRY_BY_LANGUAGE_ID,
  TRANSFER_SPEC_IDS,
  TRANSFER_SPEC_LABELS,
  TRANSFER_GROUP_LABELS,
  TRANSFER_GROUP_ORDER,
  TRANSFER_SPEC_GROUPS,
  LOAD_SPEC_IDS,
  HEIGHT_SPEC_IDS,
} = require("../config/specs");
const { withDbConnection, upsertSpecification } = require("./db");
const {
  parseNumber,
  formatQuarterFraction,
  transformNumericTokens,
  stripMillimeterUnits,
  normalizeDimensionSeparators,
  normalizeVolumeToM3,
} = require("./numbers");

const ALL_TARGETS = "all";
const DEFAULT_TRANSFER_GROUP_KEY = "other";
const US_LANGUAGE_ID = 2;
const KG_TO_POUNDS = Number(process.env.KG_TO_POUNDS_FACTOR || 2.2);
const MM_TO_INCH = Number(process.env.MM_TO_INCH_FACTOR || 0.04);
const M3_TO_FT3 = Number(process.env.M3_TO_FT3_FACTOR || 35.31);
const VOLUME_FT3_DECIMALS = Math.max(
  0,
  Math.min(10, Number(process.env.VOLUME_FT3_DECIMALS || 6))
);
const VOLUME_RAW_TO_M3_THRESHOLD = Number(
  process.env.VOLUME_RAW_TO_M3_THRESHOLD || 1000
);
const VOLUME_RAW_TO_M3_DIVISOR = Number(
  process.env.VOLUME_RAW_TO_M3_DIVISOR || 1000000
);
const PRODUCT_IMAGE_BASE_URL = String(
  process.env.PRODUCT_IMAGE_BASE_URL ||
    "https://shop.onkron.ru/images/product_images/info_images"
).trim();
const TRANSFER_GROUP_ORDER_INDEX = new Map(
  TRANSFER_GROUP_ORDER.map((groupKey, index) => [groupKey, index])
);
const LOAD_SPEC_ID_SET = new Set(
  (Array.isArray(LOAD_SPEC_IDS) ? LOAD_SPEC_IDS : [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0)
);
const HEIGHT_SPEC_ID_SET = new Set(
  (Array.isArray(HEIGHT_SPEC_IDS) ? HEIGHT_SPEC_IDS : [])
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0)
);
const EXTRA_WEIGHT_SPEC_ID_SET = new Set([766, 767]);
const EXTRA_MM_SPEC_ID_SET = new Set([68, 760, 762]);
const EXTRA_VOLUME_SPEC_ID_SET = new Set([763]);
const KG_TO_LBS_SPEC_ID_SET = new Set([
  ...LOAD_SPEC_ID_SET,
  ...EXTRA_WEIGHT_SPEC_ID_SET,
]);
const MM_TO_INCH_SPEC_ID_SET = new Set([
  ...HEIGHT_SPEC_ID_SET,
  ...EXTRA_MM_SPEC_ID_SET,
]);
const DIMENSION_SPEC_ID_SET = new Set([68, 760, 762]);
const M3_TO_FT3_SPEC_ID_SET = new Set([...EXTRA_VOLUME_SPEC_ID_SET]);

function normalizeInt(value, { name, min = 1 } = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new Error(`Invalid ${name || "number"}: ${value}`);
  }
  return parsed;
}

function normalizeSpecIds(specIds) {
  const source = Array.isArray(specIds) ? specIds : TRANSFER_SPEC_IDS;
  const normalized = source
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (normalized.length === 0) {
    throw new Error("No valid spec ids provided for transfer");
  }

  return [...new Set(normalized)];
}

function getSpecLabel(specificationId) {
  return TRANSFER_SPEC_LABELS[specificationId] || `spec-${specificationId}`;
}

function getSpecGroupMeta(specificationId) {
  const groupKey =
    TRANSFER_SPEC_GROUPS[specificationId] || DEFAULT_TRANSFER_GROUP_KEY;
  const groupLabel =
    TRANSFER_GROUP_LABELS[groupKey] ||
    TRANSFER_GROUP_LABELS[DEFAULT_TRANSFER_GROUP_KEY] ||
    "Прочее";
  const groupOrder = TRANSFER_GROUP_ORDER_INDEX.has(groupKey)
    ? TRANSFER_GROUP_ORDER_INDEX.get(groupKey)
    : TRANSFER_GROUP_ORDER_INDEX.get(DEFAULT_TRANSFER_GROUP_KEY) ?? 999;

  return {
    groupKey,
    groupLabel,
    groupOrder,
  };
}

function resolveTargetLanguageIds(sourceLanguageId, targetLanguageId) {
  if (
    targetLanguageId !== ALL_TARGETS &&
    targetLanguageId !== null &&
    targetLanguageId !== undefined
  ) {
    return [normalizeInt(targetLanguageId, { name: "target language id" })];
  }

  const targetIds = Object.keys(COUNTRY_BY_LANGUAGE_ID)
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id !== sourceLanguageId)
    .sort((a, b) => a - b);

  if (targetIds.length === 0) {
    throw new Error("No target languages available for transfer");
  }

  return targetIds;
}

function buildProductImageUrl(rawImage) {
  const image = rawImage === null || rawImage === undefined
    ? ""
    : String(rawImage).trim();
  if (!image) {
    return null;
  }

  if (/^https?:\/\//i.test(image)) {
    return image;
  }

  const normalizedBase = PRODUCT_IMAGE_BASE_URL.replace(/\/+$/, "");
  if (!normalizedBase) {
    return null;
  }

  const normalizedImage = image.replace(/^\/+/, "");
  return `${normalizedBase}/${normalizedImage}`;
}

function normalizeProductStatus(rawStatus) {
  const status = Number(rawStatus);
  if (status === 1) {
    return 1;
  }

  if (status === 0) {
    return 0;
  }

  return null;
}

function stripCubicMeterUnits(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  const normalized = String(rawValue)
    .replace(/\s*(?:м3|м\^3|m3|m\^3|куб\.?\s*м(?:етр(?:а|ов)?)?)/giu, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return normalized || null;
}

function stripCubicFootUnits(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  const normalized = String(rawValue)
    .replace(/\s*(?:ft3|ft\^3|cu\.?\s*ft|cft)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return normalized || null;
}

function formatVolumeValue(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  if (VOLUME_FT3_DECIMALS === 0) {
    return String(Math.round(value));
  }

  return value
    .toFixed(VOLUME_FT3_DECIMALS)
    .replace(/(\.\d*?[1-9])0+$/u, "$1")
    .replace(/\.0+$/u, "");
}

function mapProductMetaFromRow(row, productId) {
  const name = row?.products_name ? String(row.products_name).trim() : "";
  const model = row?.products_model ? String(row.products_model).trim() : "";
  const productName = name || model || `Product #${productId}`;

  return {
    productName,
    productModel: model || null,
    productImageUrl: buildProductImageUrl(row?.products_image),
    productStatus: normalizeProductStatus(row?.products_status),
  };
}

async function fetchTransferProductMeta(connection, { productId, languageId }) {
  try {
    const [rows] = await connection.execute(
      `
        SELECT
          MAX(pd.products_name) AS products_name,
          MAX(p.products_model) AS products_model,
          MAX(p.products_image) AS products_image,
          MAX(p.products_status) AS products_status
        FROM products p
        LEFT JOIN products_description pd
          ON pd.products_id = p.products_id
          AND pd.language_id = ?
        WHERE p.products_id = ?
      `,
      [languageId, productId]
    );

    const row = rows[0] || {};
    return mapProductMetaFromRow(row, productId);
  } catch (error) {
    const noMetaTables =
      error &&
      (error.code === "ER_NO_SUCH_TABLE" || error.code === "ER_BAD_FIELD_ERROR");
    if (!noMetaTables) {
      throw error;
    }

    return {
      productName: `Product #${productId}`,
      productModel: null,
      productImageUrl: null,
      productStatus: null,
    };
  }
}

function transformTransferValue({
  specificationId,
  sourceValue,
  sourceLanguageId,
  targetLanguageId,
}) {
  const value =
    sourceValue === null || sourceValue === undefined
      ? ""
      : String(sourceValue).trim();

  if (!value) {
    return null;
  }

  if (KG_TO_LBS_SPEC_ID_SET.has(specificationId)) {
    if (sourceLanguageId === US_LANGUAGE_ID && targetLanguageId !== US_LANGUAGE_ID) {
      return transformNumericTokens(value, (lbsValue) => lbsValue / KG_TO_POUNDS);
    }

    if (targetLanguageId === US_LANGUAGE_ID) {
      return transformNumericTokens(value, (kgValue) =>
        formatQuarterFraction(kgValue * KG_TO_POUNDS)
      );
    }

    return value;
  }

  if (MM_TO_INCH_SPEC_ID_SET.has(specificationId)) {
    if (sourceLanguageId === US_LANGUAGE_ID && targetLanguageId !== US_LANGUAGE_ID) {
      const converted = transformNumericTokens(value, (inchValue) => inchValue / MM_TO_INCH);
      if (!converted) {
        return null;
      }

      if (DIMENSION_SPEC_ID_SET.has(specificationId)) {
        return normalizeDimensionSeparators(converted);
      }

      return converted;
    }

    if (targetLanguageId === US_LANGUAGE_ID) {
      const converted = transformNumericTokens(value, (mmValue) =>
        formatQuarterFraction(mmValue * MM_TO_INCH)
      );
      const withoutUnits = stripMillimeterUnits(converted);
      if (!withoutUnits) {
        return null;
      }

      if (DIMENSION_SPEC_ID_SET.has(specificationId)) {
        return normalizeDimensionSeparators(withoutUnits);
      }

      return withoutUnits;
    }

    if (DIMENSION_SPEC_ID_SET.has(specificationId)) {
      return normalizeDimensionSeparators(value);
    }

    return value;
  }

  if (M3_TO_FT3_SPEC_ID_SET.has(specificationId)) {
    const numericVolume = parseNumber(value);
    if (numericVolume === null) {
      return null;
    }

    if (sourceLanguageId === US_LANGUAGE_ID && targetLanguageId !== US_LANGUAGE_ID) {
      const normalizedUs = stripCubicFootUnits(value) || value;
      const usVolume = parseNumber(normalizedUs);
      if (usVolume === null) {
        return null;
      }
      return formatVolumeValue(usVolume / M3_TO_FT3);
    }

    if (targetLanguageId === US_LANGUAGE_ID) {
      const normalizedM3 = normalizeVolumeToM3(numericVolume, {
        largeValueThreshold: VOLUME_RAW_TO_M3_THRESHOLD,
        largeValueDivisor: VOLUME_RAW_TO_M3_DIVISOR,
      });
      if (normalizedM3 === null) {
        return null;
      }

      const ft3Value = formatVolumeValue(normalizedM3 * M3_TO_FT3);
      if (!ft3Value) {
        return null;
      }

      return `${ft3Value} ft³`;
    }

    return value;
  }

  return value;
}

async function listTransferProducts({
  sourceLanguageId = 1,
  specIds = TRANSFER_SPEC_IDS,
  search = "",
  limit = 120,
}) {
  const langId = normalizeInt(sourceLanguageId, { name: "source language id" });
  const normalizedLimit = Math.min(
    Math.max(normalizeInt(limit || 120, { name: "limit" }), 1),
    500
  );
  const ids = normalizeSpecIds(specIds);
  const trimmedSearch = String(search || "").trim();

  return withDbConnection(async (connection) => {
    const wildcard = `%${trimmedSearch}%`;

    const buildSimpleResult = async () => {
      const params = [langId, ...ids];
      let query = `
        SELECT DISTINCT products_id
        FROM products_specifications
        WHERE language_id = ?
          AND specifications_id IN (${ids.map(() => "?").join(", ")})
      `;

      if (trimmedSearch) {
        query += " AND CAST(products_id AS CHAR) LIKE ?";
        params.push(wildcard);
      }

      query += " ORDER BY products_id DESC LIMIT ?";
      params.push(normalizedLimit);

      const [rows] = await connection.execute(query, params);
      return rows
        .map((row) => Number(row.products_id))
        .filter((id) => Number.isInteger(id) && id > 0)
        .map((id) => ({
          id,
          label: `Product #${id}`,
          name: null,
          model: null,
          imageUrl: null,
          status: null,
        }));
    };

    try {
      const params = [langId, langId, ...ids];
      let query = `
        SELECT
          ps.products_id,
          MAX(pd.products_name) AS products_name,
          MAX(p.products_model) AS products_model,
          MAX(p.products_image) AS products_image,
          MAX(p.products_status) AS products_status
        FROM products_specifications ps
        LEFT JOIN products_description pd
          ON pd.products_id = ps.products_id
          AND pd.language_id = ?
        LEFT JOIN products p
          ON p.products_id = ps.products_id
        WHERE ps.language_id = ?
          AND ps.specifications_id IN (${ids.map(() => "?").join(", ")})
      `;

      if (trimmedSearch) {
        query += `
          AND (
            CAST(ps.products_id AS CHAR) LIKE ?
            OR COALESCE(pd.products_name, "") LIKE ?
            OR COALESCE(p.products_model, "") LIKE ?
          )
        `;
        params.push(wildcard, wildcard, wildcard);
      }

      query += `
        GROUP BY ps.products_id
        ORDER BY ps.products_id DESC
        LIMIT ?
      `;
      params.push(normalizedLimit);

      const [rows] = await connection.execute(query, params);
      const mapped = rows
        .map((row) => {
          const id = Number(row.products_id);
          if (!Number.isInteger(id) || id <= 0) {
            return null;
          }

          const name = row.products_name ? String(row.products_name).trim() : "";
          const model = row.products_model ? String(row.products_model).trim() : "";
          const labelBase = name || `Product #${id}`;
          const label = model ? `${labelBase} (${model})` : labelBase;

          return {
            id,
            label,
            name: name || null,
            model: model || null,
            imageUrl: buildProductImageUrl(row.products_image),
            status: normalizeProductStatus(row.products_status),
          };
        })
        .filter(Boolean);

      if (mapped.length > 0 || !trimmedSearch) {
        return mapped;
      }

      return buildSimpleResult();
    } catch (error) {
      const noMetaTables =
        error &&
        (error.code === "ER_NO_SUCH_TABLE" || error.code === "ER_BAD_FIELD_ERROR");
      if (!noMetaTables) {
        throw error;
      }

      return buildSimpleResult();
    }
  });
}

async function getTransferProductSpecifications({
  sourceLanguageId = 1,
  productId,
  specIds = TRANSFER_SPEC_IDS,
}) {
  const langId = normalizeInt(sourceLanguageId, { name: "source language id" });
  const normalizedProductId = normalizeInt(productId, { name: "product id" });
  const ids = normalizeSpecIds(specIds);

  return withDbConnection(async (connection) => {
    const [rows] = await connection.execute(
      `
        SELECT
          ps.specifications_id,
          ps.specification
        FROM products_specifications ps
        INNER JOIN (
          SELECT
            specifications_id,
            MAX(products_specification_id) AS max_id
          FROM products_specifications
          WHERE language_id = ?
            AND products_id = ?
            AND specifications_id IN (${ids.map(() => "?").join(", ")})
          GROUP BY specifications_id
        ) latest
          ON latest.max_id = ps.products_specification_id
        ORDER BY specifications_id
      `,
      [langId, normalizedProductId, ...ids]
    );

    const mapped = rows.map((row) => {
      const specificationId = Number(row.specifications_id);
      const groupMeta = getSpecGroupMeta(specificationId);

      return {
        specificationId,
        label: getSpecLabel(specificationId),
        value: row.specification,
        ...groupMeta,
      };
    });

    mapped.sort((a, b) => {
      if (a.groupOrder !== b.groupOrder) {
        return a.groupOrder - b.groupOrder;
      }

      return a.specificationId - b.specificationId;
    });

    return mapped;
  });
}

async function transferSelectedProductSpecifications({
  sourceLanguageId = 1,
  targetLanguageId = ALL_TARGETS,
  productId,
  specIds = TRANSFER_SPEC_IDS,
  dryRun = false,
}) {
  const langId = normalizeInt(sourceLanguageId, { name: "source language id" });
  const normalizedProductId = normalizeInt(productId, { name: "product id" });
  const selectedSpecIds = normalizeSpecIds(specIds);
  const targetLanguageIds = resolveTargetLanguageIds(langId, targetLanguageId);

  return withDbConnection(async (connection) => {
    const [sourceRows] = await connection.execute(
      `
        SELECT
          ps.products_id,
          ps.specifications_id,
          ps.specification
        FROM products_specifications ps
        INNER JOIN (
          SELECT
            specifications_id,
            MAX(products_specification_id) AS max_id
          FROM products_specifications
          WHERE language_id = ?
            AND products_id = ?
            AND specifications_id IN (${selectedSpecIds.map(() => "?").join(", ")})
          GROUP BY specifications_id
        ) latest
          ON latest.max_id = ps.products_specification_id
      `,
      [langId, normalizedProductId, ...selectedSpecIds]
    );

    const stats = {
      taskName: "transfer-selected-specifications",
      productId: normalizedProductId,
      productName: `Product #${normalizedProductId}`,
      productModel: null,
      productImageUrl: null,
      sourceLanguageId: langId,
      targetLanguageId: targetLanguageIds.length === 1 ? targetLanguageIds[0] : ALL_TARGETS,
      targetLanguageIds,
      specIds: selectedSpecIds,
      total: sourceRows.length * targetLanguageIds.length,
      updated: 0,
      skipped: 0,
      failed: 0,
      dryRun: Boolean(dryRun),
      details: [],
    };

    const meta = await fetchTransferProductMeta(connection, {
      productId: normalizedProductId,
      languageId: langId,
    });
    stats.productName = meta.productName;
    stats.productModel = meta.productModel;
    stats.productImageUrl = meta.productImageUrl;

    for (const targetId of targetLanguageIds) {
      const targetStat = {
        targetLanguageId: targetId,
        updated: 0,
        skipped: 0,
        failed: 0,
      };

      for (const row of sourceRows) {
        const specificationId = Number(row.specifications_id);
        const transformedValue = transformTransferValue({
          specificationId,
          sourceValue: row.specification,
          sourceLanguageId: langId,
          targetLanguageId: targetId,
        });

        if (
          transformedValue === null ||
          transformedValue === undefined ||
          String(transformedValue).trim() === ""
        ) {
          stats.skipped += 1;
          targetStat.skipped += 1;
          continue;
        }

        try {
          if (!dryRun) {
            await upsertSpecification(connection, {
              productId: Number(row.products_id),
              languageId: targetId,
              specification: transformedValue,
              specificationId,
            });
          }

          stats.updated += 1;
          targetStat.updated += 1;
        } catch (error) {
          stats.failed += 1;
          targetStat.failed += 1;
        }
      }

      stats.details.push(targetStat);
    }

    return stats;
  });
}

module.exports = {
  ALL_TARGETS,
  listTransferProducts,
  getTransferProductSpecifications,
  transferSelectedProductSpecifications,
};
