'use strict';

const INSECURE_DEFAULTS = new Set([
  'dev-access-secret-change-me',
  'change-this-to-a-long-random-secret',
  'change-this-refresh-secret',
  'secret',
  'password'
]);

function validateSecret(name, value, { production = false } = {}) {
  const secret = String(value || '').trim();
  if (!production) return { valid: true };
  if (!secret) return { valid: false, error: `${name} is required in production` };
  if (secret.length < 32) return { valid: false, error: `${name} must be at least 32 characters in production` };
  if (INSECURE_DEFAULTS.has(secret.toLowerCase())) return { valid: false, error: `${name} must not use an insecure default value` };
  return { valid: true };
}

function validateProductionSecurityConfig(env = process.env) {
  const production = String(env.NODE_ENV || '').toLowerCase() === 'production';
  if (!production) return { valid: true, errors: [] };
  const checks = [
    validateSecret('JWT_SECRET', env.JWT_SECRET, { production }),
    validateSecret('JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET, { production })
  ];
  const errors = checks.filter(x => !x.valid).map(x => x.error);
  return { valid: errors.length === 0, errors };
}

module.exports = { validateSecret, validateProductionSecurityConfig };
