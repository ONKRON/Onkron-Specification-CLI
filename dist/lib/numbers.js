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

module.exports = {
  parseNumber,
  formatNumber,
};
