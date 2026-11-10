// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Table-driven self-check for `playwright-run-filters.ts`: which apps a
 * `playwright test` argument list may include. global-setup and global-teardown gate
 * auth provisioning, CITE seeding and the per-app purges on this answer, so a filter
 * the parser misreads silently skips setup (or a purge).
 *
 * Usage: node --no-warnings scripts/check-run-filters.mjs   (Node >= 22.18 strips the TS types)
 */

import { getPlaywrightPathFilters, pathFiltersIncludeApp } from '../playwright-run-filters.ts';

const APP_DIRS = ['alloy', 'blueprint', 'caster', 'cite', 'gallery', 'player', 'playervm', 'steamfitter'];

// [argv after `playwright`, expected path filters, { app: expected include }, excluded apps?]
const CASES = [
  [['test'], [], { cite: true, gallery: true }],
  [['test', 'cite/tests'], ['cite/tests'], { cite: true, gallery: false }],
  [['test', './cite/tests/home/'], ['./cite/tests/home/'], { cite: true, gallery: false }],
  [['test', 'gallery/tests'], ['gallery/tests'], { cite: false, gallery: true }],
  [['test', '-g', 'Dashboard'], [], { cite: true, gallery: true }],
  [['test', 'dashboard-initial-load'], ['dashboard-initial-load'], { cite: true, gallery: true }],
  [['test', '--grep', 'x', 'cite/tests/home'], ['cite/tests/home'], { cite: true, gallery: false }],
  [['test', '-j', '4', 'gallery/tests'], ['gallery/tests'], { cite: false, gallery: true }],
  [['test', '-j4', '-x', 'gallery/tests'], ['gallery/tests'], { cite: false, gallery: true }],
  // A bare app name is a regex over the full path, not a directory: `cite` also matches
  // Blueprint's `...-and-cite` specs and `player` matches every `playerVm/` path.
  [['test', '-c', 'playwright.config.ts', '-G', 'slow', 'cite'], ['cite'], { cite: true, gallery: true, blueprint: true }],
  [['test', 'player'], ['player'], { player: true, playervm: true, cite: true }],
  // A directory with a trailing slash is still an unanchored regex: `cite/` matches
  // Blueprint's `admin-gallery-and-cite/` specs, `alloy/` Caster's `integration-alloy/`.
  [['test', 'player/'], ['player/'], { player: true, playervm: true, cite: true }],
  [['test', 'cite/'], ['cite/'], { cite: true, blueprint: true }],
  [['test', 'alloy/'], ['alloy/'], { alloy: true, caster: true }],
  [['test', 'alloy/tests/'], ['alloy/tests/'], { alloy: true, caster: false }],
  [['test', 'playerVm/tests'], ['playerVm/tests'], { player: false, playervm: true }],
  [['test', 'cite/tests/home/x.spec.ts'], ['cite/tests/home/x.spec.ts'], { cite: true, blueprint: false }],
  [['test', 'cite/tests|gallery'], ['cite/tests|gallery'], { cite: true, gallery: true, alloy: true }],
  [['test', '-u', 'cite/tests'], [], { cite: true, gallery: true }],
  [['test', '-u', '--', 'cite/tests'], ['cite/tests'], { cite: true, gallery: false }],
  [['test', '--project=chromium', '--workers=2', 'player/tests'], ['player/tests'], { player: true, playervm: false, cite: false }],
  [['test', '--project', 'chromium', 'firefox', '--grep', 'x'], [], { cite: true }],
  [['test', 'cite/tests', 'gallery/tests'], ['cite/tests', 'gallery/tests'], { cite: true, gallery: true, alloy: false }],
  [['test', 'tests/home'], ['tests/home'], { cite: true, alloy: true }],
  // CRUCIBLE_EXCLUDE_APPS (run-tests.sh --exclude) wins over any filter.
  [['test'], [], { cite: false, gallery: true }, ['cite']],
  [['test', 'cite/tests', 'gallery/tests'], ['cite/tests', 'gallery/tests'], { cite: true, gallery: false }, ['gallery']],
];

let failures = 0;
for (const [argv, expectedFilters, expectedApps, excluded = []] of CASES) {
  const filters = getPlaywrightPathFilters(argv);
  const problems = [];
  if (JSON.stringify(filters) !== JSON.stringify(expectedFilters)) {
    problems.push(`filters ${JSON.stringify(filters)} != ${JSON.stringify(expectedFilters)}`);
  }
  for (const [app, expected] of Object.entries(expectedApps)) {
    const actual = pathFiltersIncludeApp(app, filters, APP_DIRS, excluded);
    if (actual !== expected) problems.push(`${app}: ${actual} != ${expected}`);
  }
  const label = JSON.stringify(argv.slice(1));
  if (problems.length) {
    failures++;
    console.log(`FAIL ${label}: ${problems.join('; ')}`);
  } else {
    console.log(`ok   ${label} -> ${JSON.stringify(expectedApps)}`);
  }
}

console.log(`${CASES.length - failures}/${CASES.length} cases passed`);
process.exit(failures ? 1 : 0);
