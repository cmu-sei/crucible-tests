#!/usr/bin/env node
// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Decide the regression-issue action for a single app of a weekly run.
 *
 * Usage:
 *   node --no-warnings scripts/report-regressions.mjs \
 *     --app <app> \
 *     --first <first-eval.json> \
 *     [--confirm <confirm-eval.json>] \
 *     [--current-digests <digests.json>] \
 *     [--last-clean-digests <digests.json>] \
 *     --run-url <url> \
 *     --repo <owner/repo>
 *
 * --first is the path the app's first-pass evaluation should be at; a missing file means
 * the app was in the matrix but left no evaluation, which counts as "suite did not run".
 *
 * Outputs JSON to stdout (see planRegressionReport in lib/ci-regressions.mjs):
 *   { action: "recovered"|"did-not-run"|"regression"|"none", status, summary,
 *     title?, issueBody?, recurrenceBody?, recoveredBody? }
 * Exits 0 unless the arguments are wrong or an existing file cannot be parsed.
 */

import { readFileSync, existsSync } from 'fs';
import { planRegressionReport } from './lib/ci-regressions.mjs';

// Parse CLI args
const args = process.argv.slice(2);
let app, firstPath, confirmPath, currentDigestsPath, lastCleanDigestsPath, runUrl, repo;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--app' && i + 1 < args.length) {
    app = args[++i];
  } else if (args[i] === '--first' && i + 1 < args.length) {
    firstPath = args[++i];
  } else if (args[i] === '--confirm' && i + 1 < args.length) {
    confirmPath = args[++i];
  } else if (args[i] === '--current-digests' && i + 1 < args.length) {
    currentDigestsPath = args[++i];
  } else if (args[i] === '--last-clean-digests' && i + 1 < args.length) {
    lastCleanDigestsPath = args[++i];
  } else if (args[i] === '--run-url' && i + 1 < args.length) {
    runUrl = args[++i];
  } else if (args[i] === '--repo' && i + 1 < args.length) {
    repo = args[++i];
  }
}

if (!app || !firstPath || !runUrl || !repo) {
  console.error('Usage: report-regressions.mjs --app <app> --first <eval> --run-url <url> --repo <owner/repo>');
  process.exit(1);
}

const readJson = (path) => (path && existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null);

const plan = planRegressionReport(app, readJson(firstPath), readJson(confirmPath), {
  currentDigests: readJson(currentDigestsPath) || {},
  lastCleanDigests: readJson(lastCleanDigestsPath),
  runUrl,
  repo,
});

process.stdout.write(JSON.stringify(plan));
