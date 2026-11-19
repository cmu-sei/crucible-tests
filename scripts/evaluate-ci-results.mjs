#!/usr/bin/env node
// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Evaluate Playwright CI results against known-failures and skip-in-ci lists.
 *
 * Usage:
 *   node --no-warnings scripts/evaluate-ci-results.mjs \
 *     --results test-results/results.json \
 *     --known ci/known-failures.json \
 *     --skip ci/skip-in-ci.json \
 *     --app <app> \
 *     [--full]
 *
 * Writes ci-evaluation.json alongside the results file and exits 0 if ok, 1 otherwise.
 * Appends summary to $GITHUB_STEP_SUMMARY when that variable is set.
 */

import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { evaluate, renderSummary } from './lib/ci-results.mjs';

// Parse CLI args
const args = process.argv.slice(2);
let resultsPath, knownPath, skipPath, app;
let full = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--results' && i + 1 < args.length) {
    resultsPath = args[++i];
  } else if (args[i] === '--known' && i + 1 < args.length) {
    knownPath = args[++i];
  } else if (args[i] === '--skip' && i + 1 < args.length) {
    skipPath = args[++i];
  } else if (args[i] === '--app' && i + 1 < args.length) {
    app = args[++i];
  } else if (args[i] === '--full') {
    full = true;
  }
}

// --full may come before or after --app, so resolve it once parsing is done.
const fullApps = full && app ? [app] : [];

if (!resultsPath || !knownPath || !skipPath || !app) {
  console.error('Usage: evaluate-ci-results.mjs --results <path> --known <path> --skip <path> --app <app> [--full]');
  process.exit(1);
}

// Load files
let report = null;
try {
  report = JSON.parse(readFileSync(resultsPath, 'utf8'));
} catch (err) {
  console.error(`Failed to read results file: ${err.message}`);
}

const known = JSON.parse(readFileSync(knownPath, 'utf8'));
const skip = JSON.parse(readFileSync(skipPath, 'utf8'));

// Evaluate
const evaluation = evaluate(report, known, skip, { fullApps, app });

// Enrich nowPassing items with reason and tracking from known list
const enrichedNowPassing = evaluation.nowPassing.map((item) => {
  const knownEntry = known.find(
    (k) =>
      k.file === item.file &&
      (k.title === item.title || k.title === '*' || k.title.replace(/\s+/g, ' ') === item.title.replace(/\s+/g, ' '))
  );
  return {
    ...item,
    reason: knownEntry?.reason,
    tracking: knownEntry?.tracking,
  };
});

// Build output object for ci-evaluation.json
const output = {
  app,
  ...evaluation,
  nowPassing: enrichedNowPassing,
};

// Write ci-evaluation.json alongside results file
// The results directory is missing when Playwright never started, and that is
// exactly the run that must still leave a didNotRun evaluation behind.
const evalPath = join(dirname(resultsPath), 'ci-evaluation.json');
mkdirSync(dirname(evalPath), { recursive: true });
writeFileSync(evalPath, JSON.stringify(output, null, 2) + '\n');
console.log(`Wrote evaluation to ${evalPath}`);

// Render summary
const summary = renderSummary(evaluation, app);
console.log('\n' + summary);

// Append to GitHub step summary if env var is set
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
  console.log(`Appended summary to ${process.env.GITHUB_STEP_SUMMARY}`);
}

// Exit with appropriate code
process.exit(evaluation.ok ? 0 : 1);
