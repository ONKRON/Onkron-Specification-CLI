function parseNumber(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  const normalized = String(rawValue).trim().replace(",", ".");
  const match = normalized.match(/-?\d+(\.\d+)?/);

  if (!match) {
    return null;
  }

  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

function formatNumber(value) {
  const rounded = Math.round(value * 100) / 100;
  if (Number.isInteger(rounded)) {
    return String(rounded);
  }

  return rounded.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function formatQuarterFraction(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  const rounded = Math.round(value * 4) / 4;
  const sign = rounded < 0 ? "-" : "";
  const absValue = Math.abs(rounded);
  let integerPart = Math.floor(absValue);
  let quarterPart = Math.round((absValue - integerPart) * 4);

  if (quarterPart === 4) {
    integerPart += 1;
    quarterPart = 0;
  }

  if (quarterPart === 0) {
    return `${sign}${integerPart}`;
  }

  const quarterSymbolByValue = {
    1: "¼",
    2: "½",
    3: "¾",
  };

  const fraction = quarterSymbolByValue[quarterPart] || "";
  if (!fraction) {
    return `${sign}${formatNumber(rounded)}`;
  }

  if (integerPart === 0) {
    return `${sign}${fraction}`;
  }

  return `${sign}${integerPart} ${fraction}`;
}

function transformNumericTokens(rawValue, transformNumber) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  if (typeof transformNumber !== "function") {
    return null;
  }

  const source = String(rawValue).trim();
  if (!source) {
    return null;
  }

  let matched = false;
  const transformed = source.replace(/(?<!\d)-?\d+(?:[.,]\d+)?/g, (token) => {
    const numeric = Number(String(token).replace(",", "."));
    if (!Number.isFinite(numeric)) {
      return token;
    }

    matched = true;
    const next = transformNumber(numeric);
    if (next === null || next === undefined) {
      return token;
    }

    if (typeof next === "number") {
      return formatNumber(next);
    }

    return String(next);
  });

  return matched ? transformed : null;
}

function stripMillimeterUnits(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  const normalized = String(rawValue)
    .replace(/\s*(?:мм|mm)/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return normalized || null;
}

function normalizeDimensionSeparators(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  const normalized = String(rawValue)
    .replace(/\s*[xх×]\s*/giu, " x ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return normalized || null;
}

function normalizeVolumeToM3(rawNumericValue, {
  largeValueThreshold = 1000,
  largeValueDivisor = 1_000_000,
} = {}) {
  const value = Number(rawNumericValue);
  if (!Number.isFinite(value)) {
    return null;
  }

  const threshold = Number(largeValueThreshold);
  const divisor = Number(largeValueDivisor);
  if (!Number.isFinite(threshold) || !Number.isFinite(divisor) || divisor <= 0) {
    return value;
  }

  if (Math.abs(value) >= threshold) {
    return value / divisor;
  }

  return value;
}

module.exports = {
  parseNumber,
  formatNumber,
  formatQuarterFraction,
  transformNumericTokens,
  stripMillimeterUnits,
  normalizeDimensionSeparators,
  normalizeVolumeToM3,
};
