'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const requirementsPath = path.join(projectRoot, 'qa', 'requirements.json');
const manualTestsPath = path.join(projectRoot, 'qa', 'manual-test-cases.md');
const automatedTestsRoot = path.join(projectRoot, 'backend', 'tests');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function collectTestIds(text) {
  return new Set(text.match(/QA-[A-Z0-9-]+/g) || []);
}

function fail(messages) {
  console.error('Requirements traceability check FAILED.');
  for (const message of messages) console.error(` - ${message}`);
  process.exit(1);
}

if (!fs.existsSync(requirementsPath)) fail(['qa/requirements.json is missing']);

const requirements = JSON.parse(fs.readFileSync(requirementsPath, 'utf8'));
if (!Array.isArray(requirements) || requirements.length === 0) fail(['requirements.json must contain at least one requirement']);

const manualText = fs.existsSync(manualTestsPath) ? fs.readFileSync(manualTestsPath, 'utf8') : '';
const manualIds = collectTestIds(manualText);

const automatedIds = new Set();
if (fs.existsSync(automatedTestsRoot)) {
  for (const file of walk(automatedTestsRoot).filter(f => f.endsWith('.js'))) {
    const ids = collectTestIds(fs.readFileSync(file, 'utf8'));
    for (const id of ids) automatedIds.add(id);
  }
}

const knownTestIds = new Set([...manualIds, ...automatedIds]);
const errors = [];
const requirementIds = new Set();
let implementedCount = 0;
let automatedCoverageCount = 0;
let manualCoverageCount = 0;

for (const req of requirements) {
  if (!req || typeof req !== 'object') {
    errors.push('A requirement entry is not an object');
    continue;
  }

  const { id, title, status, implementation, test_ids: testIds } = req;
  if (!id || !/^((FR|NFR)-\d{3})$/.test(id)) errors.push(`Invalid or missing requirement ID: ${String(id)}`);
  if (requirementIds.has(id)) errors.push(`Duplicate requirement ID ${id}`);
  requirementIds.add(id);

  if (!title || !String(title).trim()) errors.push(`${id}: missing title`);
  if (status !== 'implemented') errors.push(`${id}: status is '${status}', expected 'implemented' for proposal scope`);
  else implementedCount += 1;

  if (!Array.isArray(implementation) || implementation.length === 0) {
    errors.push(`${id}: no implementation paths listed`);
  } else {
    for (const rel of implementation) {
      const absolute = path.join(projectRoot, rel);
      if (!fs.existsSync(absolute)) errors.push(`${id}: implementation path does not exist: ${rel}`);
    }
  }

  if (!Array.isArray(testIds) || testIds.length === 0) {
    errors.push(`${id}: no test IDs listed`);
  } else {
    let hasAuto = false;
    let hasManual = false;
    for (const testId of testIds) {
      if (!knownTestIds.has(testId)) errors.push(`${id}: referenced test ID does not exist: ${testId}`);
      if (automatedIds.has(testId)) hasAuto = true;
      if (manualIds.has(testId)) hasManual = true;
    }
    if (hasAuto) automatedCoverageCount += 1;
    if (hasManual) manualCoverageCount += 1;
  }
}

// Ensure all declared manual test cases have unique test IDs in the table.
const manualTableIds = [...manualText.matchAll(/^\|\s*(QA-[A-Z0-9-]+)\s*\|/gm)].map(m => m[1]);
const duplicates = manualTableIds.filter((id, i) => manualTableIds.indexOf(id) !== i);
for (const id of [...new Set(duplicates)]) errors.push(`Duplicate manual test case ID: ${id}`);

if (errors.length) fail(errors);

console.log(
  `Requirements traceability check passed: ${requirements.length}/${requirements.length} requirements implemented and traceable; ` +
  `${automatedCoverageCount} have automated coverage and ${manualCoverageCount} have manual/system coverage.`
);
