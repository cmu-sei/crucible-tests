#!/usr/bin/env node
// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Render regression issue body for a single app.
 *
 * Usage:
 *   node --no-warnings scripts/report-regressions.mjs \
 *     --app <app> \
 *     --first <first-eval.json> \
 *     --confirm <confirm-eval.json> \
 *     --current-digests <digests.json> \
 *     --last-clean-digests <digests.json> \
 *     --run-url <url> \
 *     --repo <owner/repo>
 *
 * Outputs JSON to stdout: { action: "open"|"recurrence"|"none", title?: string, body?: string }
 * Exit 0 in all cases.
 */

import { readFileSync, existsSync } from 'fs';
import {
  confirmedRegressions,
  digestDiff,
  renderRegressionIssue,
  renderRecurrenceComment,
  mentionFor,
} from './lib/ci-regressions.mjs';

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

// Read evaluations
const first = JSON.parse(readFileSync(firstPath, 'utf8'));
const confirm = confirmPath && existsSync(confirmPath) ? JSON.parse(readFileSync(confirmPath, 'utf8')) : null;

// Compute confirmed regressions
const keys = confirmedRegressions(first, confirm);

if (keys.length === 0) {
  // No confirmed regressions
  process.stdout.write(JSON.stringify({ action: 'none' }));
  process.exit(0);
}

// Read digests
const currentDigests = currentDigestsPath && existsSync(currentDigestsPath)
  ? JSON.parse(readFileSync(currentDigestsPath, 'utf8'))
  : {};
const lastCleanDigests = lastCleanDigestsPath && existsSync(lastCleanDigestsPath)
  ? JSON.parse(readFileSync(lastCleanDigestsPath, 'utf8'))
  : null;

const diff = digestDiff(currentDigests, lastCleanDigests);
const mention = mentionFor(repo);
const ctx = { runUrl, mention };

// Render both issue and recurrence bodies
// The shell script will choose which to use based on whether an issue exists
const issue = renderRegressionIssue(app, keys, diff, ctx);
const recurrence = renderRecurrenceComment(keys, diff, { runUrl });

process.stdout.write(JSON.stringify({
  action: 'regression',
  title: issue.title,
  issueBody: issue.body,
  recurrenceBody: recurrence,
}));
