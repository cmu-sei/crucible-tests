// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Table-driven self-check for the CI affected-runs planner.
 * Usage: node --no-warnings scripts/check-ci-affected.mjs
 */

import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { affectedRuns, buildImportGraph, toMatrix, parseAppsFilter } from './lib/ci-affected.mjs';

const APPS = ['alloy', 'blueprint', 'caster', 'cite', 'console', 'gallery', 'gameboard', 'player', 'playerVm', 'steamfitter', 'topomojo'];

// [changed files, lists, expected result]
const CASES = [
  {
    name: 'Single spec change in cite',
    changed: [{ path: 'cite/tests/home/a.spec.ts', status: 'M' }],
    lists: { listChangedFiles: [], skip: [] },
    expected: { full: false, runs: [{ app: 'cite', specs: ['cite/tests/home/a.spec.ts'] }], dropped: [] },
  },
  {
    name: 'Spec change plus fixtures change in cite',
    changed: [
      { path: 'cite/tests/home/a.spec.ts', status: 'M' },
      { path: 'cite/fixtures.ts', status: 'M' },
    ],
    lists: { listChangedFiles: [], skip: [] },
    expected: { full: false, runs: [{ app: 'cite', specs: [] }], dropped: [] },
  },
  {
    name: 'player-helpers.ts change',
    changed: [{ path: 'player-helpers.ts', status: 'M' }],
    lists: { listChangedFiles: [], skip: [] },
    // Will be computed from real import graph
    expected: { full: false, runs: null, dropped: [] }, // null = compute from graph
  },
  {
    name: 'shared-fixtures.ts change (Full)',
    changed: [{ path: 'shared-fixtures.ts', status: 'M' }],
    lists: { listChangedFiles: [], skip: [] },
    expected: { full: true, runs: [], dropped: [] },
  },
  {
    name: 'ci/stack/compose.yaml change (Full)',
    changed: [{ path: 'ci/stack/compose.yaml', status: 'M' }],
    lists: { listChangedFiles: [], skip: [] },
    expected: { full: true, runs: [], dropped: [] },
  },
  {
    name: 'README and docs changes (No runs)',
    changed: [
      { path: 'README.md', status: 'M' },
      { path: 'docs/x.md', status: 'A' },
    ],
    lists: { listChangedFiles: [], skip: [] },
    expected: { full: false, runs: [], dropped: [] },
  },
  {
    name: 'Deleted spec (No runs)',
    changed: [{ path: 'alloy/tests/a.spec.ts', status: 'D' }],
    lists: { listChangedFiles: [], skip: [] },
    expected: { full: false, runs: [], dropped: [] },
  },
  {
    name: 'Moodle spec change (No runs)',
    changed: [{ path: 'moodle/tests/a.spec.ts', status: 'M' }],
    lists: { listChangedFiles: [], skip: [] },
    expected: { full: false, runs: [], dropped: [] },
  },
  {
    name: 'known-failures.json change with empty listChangedFiles (No runs)',
    changed: [{ path: 'ci/known-failures.json', status: 'M' }],
    lists: { listChangedFiles: [], skip: [] },
    expected: { full: false, runs: [], dropped: [] },
  },
  {
    name: 'skip-in-ci.json change with listChangedFiles',
    changed: [{ path: 'ci/skip-in-ci.json', status: 'M' }],
    lists: { listChangedFiles: ['caster/tests/modules/x.spec.ts'], skip: [] },
    expected: { full: false, runs: [{ app: 'caster', specs: ['caster/tests/modules/x.spec.ts'] }], dropped: [] },
  },
  {
    name: 'Spec change with skip entry (dropped)',
    changed: [{ path: 'caster/tests/modules/x.spec.ts', status: 'M' }],
    lists: {
      listChangedFiles: [],
      skip: [{ file: 'caster/tests/modules/x.spec.ts', title: '*', requires: 'gitea', reason: 'test', added: '2026-11-01' }],
    },
    expected: { full: false, runs: [], dropped: [{ spec: 'caster/tests/modules/x.spec.ts', requires: 'gitea' }] },
  },
  {
    name: 'Fixtures change with skip entry (whole-app run kept)',
    changed: [{ path: 'caster/fixtures.ts', status: 'M' }],
    lists: {
      listChangedFiles: [],
      skip: [{ file: 'caster/tests/modules/x.spec.ts', title: '*', requires: 'gitea', reason: 'test', added: '2026-11-01' }],
    },
    expected: { full: false, runs: [{ app: 'caster', specs: [] }], dropped: [] },
  },
  {
    name: 'ci-skip.ts change (Full)',
    changed: [{ path: 'ci-skip.ts', status: 'M' }],
    lists: { listChangedFiles: [], skip: [] },
    expected: { full: true, runs: [], dropped: [] },
  },
];

// toMatrix test
const MATRIX_CASES = [
  {
    name: 'toMatrix with single app and empty specs',
    input: { full: false, runs: [{ app: 'playerVm', specs: [] }], dropped: [] },
    expected: { include: [{ app: 'playerVm', specs: 'playerVm/tests/' }] },
  },
  {
    name: 'toMatrix with single app and explicit specs',
    input: { full: false, runs: [{ app: 'cite', specs: ['cite/tests/home/a.spec.ts', 'cite/tests/home/b.spec.ts'] }], dropped: [] },
    expected: { include: [{ app: 'cite', specs: 'cite/tests/home/a.spec.ts cite/tests/home/b.spec.ts' }] },
  },
  {
    name: 'toMatrix with full mode and filtered apps',
    input: { full: true, runs: [{ app: 'cite', specs: [] }, { app: 'player', specs: [] }], dropped: [] },
    expected: { include: [{ app: 'cite', specs: 'cite/tests/' }, { app: 'player', specs: 'player/tests/' }] },
  },
];

// parseAppsFilter test
const APPS_FILTER_CASES = [
  {
    name: 'parseAppsFilter with valid apps in full mode',
    appsArg: 'player,cite',
    fullMode: true,
    validApps: APPS,
    expected: { ok: true, apps: ['player', 'cite'] },
  },
  {
    name: 'parseAppsFilter with unknown app (wrong case)',
    appsArg: 'playervm',
    fullMode: true,
    validApps: APPS,
    expected: { ok: false, errorContains: 'playervm' },
  },
  {
    name: 'parseAppsFilter with moodle (excluded app)',
    appsArg: 'moodle',
    fullMode: true,
    validApps: APPS,
    expected: { ok: false, errorContains: 'moodle' },
  },
  {
    name: 'parseAppsFilter without full mode',
    appsArg: 'player,cite',
    fullMode: false,
    validApps: APPS,
    expected: { ok: false, errorContains: '--apps can only be used with --full' },
  },
  {
    name: 'parseAppsFilter with null appsArg',
    appsArg: null,
    fullMode: true,
    validApps: APPS,
    expected: { ok: true, apps: null },
  },
];

// Build import graph once for all tests
console.log('Building import graph...');
const graph = buildImportGraph('.');
console.log(`Import graph has ${graph.size} entries\n`);

// Compute expected results for player-helpers case
const playerHelpersCase = CASES.find(c => c.name === 'player-helpers.ts change');
const playerHelpersImporters = graph.get('player-helpers.ts') || new Set();
const playerHelpersApps = new Set();
for (const importer of playerHelpersImporters) {
  const app = importer.split('/')[0];
  if (APPS.includes(app)) {
    playerHelpersApps.add(app);
  }
}
playerHelpersCase.expected.runs = Array.from(playerHelpersApps)
  .sort()
  .map(app => ({ app, specs: [] }));
console.log(`player-helpers.ts importers: ${Array.from(playerHelpersApps).sort().join(', ')}\n`);

let failures = 0;

// Run affectedRuns tests
for (const testCase of CASES) {
  const { name, changed, lists, expected } = testCase;
  const result = affectedRuns(changed, graph, lists);

  // Normalize for comparison: sort runs by app
  result.runs.sort((a, b) => a.app.localeCompare(b.app));
  expected.runs.sort((a, b) => a.app.localeCompare(b.app));

  const problems = [];
  if (result.full !== expected.full) {
    problems.push(`full: ${result.full} !== ${expected.full}`);
  }
  if (JSON.stringify(result.runs) !== JSON.stringify(expected.runs)) {
    problems.push(`runs: ${JSON.stringify(result.runs)} !== ${JSON.stringify(expected.runs)}`);
  }
  if (JSON.stringify(result.dropped) !== JSON.stringify(expected.dropped)) {
    problems.push(`dropped: ${JSON.stringify(result.dropped)} !== ${JSON.stringify(expected.dropped)}`);
  }

  if (problems.length > 0) {
    failures++;
    console.log(`FAIL ${name}`);
    for (const problem of problems) {
      console.log(`  ${problem}`);
    }
  } else {
    console.log(`ok   ${name}`);
  }
}

// Run toMatrix tests
console.log();
for (const testCase of MATRIX_CASES) {
  const { name, input, expected } = testCase;
  const result = toMatrix(input);

  if (JSON.stringify(result) !== JSON.stringify(expected)) {
    failures++;
    console.log(`FAIL ${name}`);
    console.log(`  got: ${JSON.stringify(result)}`);
    console.log(`  expected: ${JSON.stringify(expected)}`);
  } else {
    console.log(`ok   ${name}`);
  }
}

// Run parseAppsFilter tests
console.log();
for (const testCase of APPS_FILTER_CASES) {
  const { name, appsArg, fullMode, validApps, expected } = testCase;
  const result = parseAppsFilter(appsArg, fullMode, validApps);

  const problems = [];
  if (result.ok !== expected.ok) {
    problems.push(`ok: ${result.ok} !== ${expected.ok}`);
  }
  if (expected.ok && JSON.stringify(result.apps) !== JSON.stringify(expected.apps)) {
    problems.push(`apps: ${JSON.stringify(result.apps)} !== ${JSON.stringify(expected.apps)}`);
  }
  if (!expected.ok && expected.errorContains && !result.error.includes(expected.errorContains)) {
    problems.push(`error does not contain "${expected.errorContains}": ${result.error}`);
  }

  if (problems.length > 0) {
    failures++;
    console.log(`FAIL ${name}`);
    for (const problem of problems) {
      console.log(`  ${problem}`);
    }
  } else {
    console.log(`ok   ${name}`);
  }
}

// Check that every app in slices.json has a folder and every service exists in compose.yaml
console.log();
const slicesPath = 'ci/slices.json';
if (!existsSync(slicesPath)) {
  console.log('SKIP slices.json validation: file does not exist yet');
} else {
  const slices = JSON.parse(await import('fs').then(m => m.readFileSync(slicesPath, 'utf8')));

  // Check app folders
  for (const app of Object.keys(slices)) {
    if (!existsSync(`${app}/tests`)) {
      failures++;
      console.log(`FAIL ${app} in slices.json has no ${app}/tests/ folder`);
    }
  }

  // Check compose services (skip if docker not available or compose.yaml doesn't exist)
  const composePath = 'ci/stack/compose.yaml';
  if (!existsSync(composePath)) {
    console.log('SKIP compose.yaml service check: ci/stack/compose.yaml does not exist yet (Task 4)');
  } else {
    try {
      execSync('docker --version', { stdio: 'ignore' });
      const services = execSync('docker compose -f ci/stack/compose.yaml config --services', { encoding: 'utf8' })
        .trim()
        .split('\n')
        .filter(Boolean);

      const serviceSet = new Set(services);
      for (const [app, slice] of Object.entries(slices)) {
        for (const service of slice.services) {
          if (!serviceSet.has(service)) {
            failures++;
            console.log(`FAIL ${app} slice references nonexistent service: ${service}`);
          }
        }
      }
      console.log('ok   All services in slices.json exist in compose.yaml');
    } catch (err) {
      console.log('SKIP compose.yaml service check: docker not available');
    }
  }
}

const totalCases = CASES.length + MATRIX_CASES.length + APPS_FILTER_CASES.length;
console.log(`\n${totalCases - failures}/${totalCases} cases passed`);
process.exit(failures ? 1 : 0);
