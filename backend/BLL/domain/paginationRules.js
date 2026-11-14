'use strict';

function normalizeLimit(value, { defaultValue = 50, min = 1, max = 100 } = {}) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(max, Math.max(min, parsed));
}

module.exports = { normalizeLimit };
