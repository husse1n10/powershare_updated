'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

test('QA-ARCH-001 PL -> BLL -> DAL dependency direction is enforced', () => {
  const backendRoot = path.resolve(__dirname, '..', '..');
  const result = spawnSync(process.execPath, ['scripts/check-architecture.js'], {
    cwd: backendRoot,
    encoding: 'utf8'
  });

  assert.equal(
    result.status,
    0,
    `Architecture policy failed.\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`
  );
  assert.match(result.stdout, /PL -> BLL -> DAL/);
});

test('QA-ARCH-002 architecture check detects PL->DAL, BLL->PL and DAL->BLL violations (self-test)', () => {
  const fs = require('node:fs'); const os = require('node:os');
  const backendRoot = path.resolve(__dirname, '..', '..');
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'arch-'));
  const write = (rel, body) => { fs.mkdirSync(path.dirname(path.join(fixture, rel)), { recursive: true }); fs.writeFileSync(path.join(fixture, rel), body); };
  write('PL/controllers/x.js', "require('../../BLL/services/s');");
  write('BLL/services/s.js', "require('../../DAL/repositories/r');");
  write('DAL/repositories/r.js', "require('../database/connection');");
  const clean = spawnSync(process.execPath, ['scripts/check-architecture.js', fixture], { cwd: backendRoot, encoding: 'utf8' });
  assert.equal(clean.status, 0, clean.stderr);
  write('middleware/auth.js', "require('../DAL/repositories/userRepository');");
  write('app.js', "require('./DAL/database/connection');");
  write('BLL/services/bad.js', "require('../../PL/controllers/x');");
  write('DAL/repositories/bad.js', "require('../../BLL/services/s');");
  const dirty = spawnSync(process.execPath, ['scripts/check-architecture.js', fixture], { cwd: backendRoot, encoding: 'utf8' });
  assert.equal(dirty.status, 1);
  for (const expected of ['middleware/auth.js', 'app.js', 'BLL/services/bad.js', 'DAL/repositories/bad.js']) assert.match(dirty.stderr, new RegExp(expected.replace(/[./]/g, '\\$&')));
  fs.rmSync(fixture, { recursive: true, force: true });
});
