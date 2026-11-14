'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const backendRoutes = path.join(root, 'backend', 'PL', 'routes');
const frontendSrc = path.join(root, 'frontend', 'src');
const prefixes = {
  'authRoutes.js': '/auth',
  'adminRoutes.js': '/admin',
  'ownerRoutes.js': '/owner',
  'collectorRoutes.js': '/collector',
  'subscriberRoutes.js': '/subscriber',
  'commonRoutes.js': '',
};

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]
  );
}

function normalizeTemplate(value) {
  return value.replace(/\$\{[^}]+\}/g, ':param').replace(/\/{2,}/g, '/');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function routeRegex(route) {
  const tokens = route.split('/').map((part) => {
    if (!part) return '';
    if (part.startsWith(':')) return '[^/]+';
    return escapeRegex(part);
  });
  return new RegExp(`^${tokens.join('/')}$`);
}

const routes = [];
for (const file of fs.readdirSync(backendRoutes)) {
  if (!file.endsWith('.js')) continue;
  const src = fs.readFileSync(path.join(backendRoutes, file), 'utf8');
  const prefix = prefixes[file] ?? '';
  const re = /r\.(get|post|put|delete|patch)\(\s*['"]([^'"]+)['"]/g;
  for (const match of src.matchAll(re)) {
    routes.push({
      method: match[1].toUpperCase(),
      path: `${prefix}${match[2]}`.replace(/\/{2,}/g, '/'),
    });
  }
}

const calls = [];
for (const file of walk(frontendSrc).filter((f) => f.endsWith('.js'))) {
  const src = fs.readFileSync(file, 'utf8');
  const re = /api\.(get|post|put|delete|patch)\(\s*([`'"])([\s\S]*?)\2/g;
  for (const match of src.matchAll(re)) {
    const raw = match[3].trim();
    if (!raw.startsWith('/')) continue;
    calls.push({
      method: match[1].toUpperCase(),
      path: normalizeTemplate(raw),
      file: path.relative(root, file),
    });
  }
}

const missing = [];
for (const call of calls) {
  const ok = routes.some((route) => route.method === call.method && routeRegex(route.path).test(call.path));
  if (!ok) missing.push(call);
}

if (missing.length) {
  console.error('Frontend/API contract check FAILED. Missing backend routes:');
  for (const item of missing) console.error(` - ${item.method} ${item.path} (${item.file})`);
  process.exit(1);
}

console.log(`Frontend/API contract check passed: ${calls.length} frontend API calls matched ${routes.length} backend routes.`);
