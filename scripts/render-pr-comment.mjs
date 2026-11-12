#!/usr/bin/env node
// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Render PR comment for nowPassing tests.
 *
 * Usage:
 *   node --no-warnings scripts/render-pr-comment.mjs \
 *     --dir <artifacts-dir> \
 *     --run-url <url> \
 *     --sha <sha>
 *
 * Reads ci-evaluation.json from each e2e-eval-<app> subdirectory in <artifacts-dir>,
 * aggregates nowPassing items, and outputs markdown comment to stdout.
 * Writes empty file when no nowPassing items exist.
 * Exits 0 in all cases.
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { renderNowPassingComment } from './lib/ci-pr-comment.mjs';

// Parse CLI args
const args = process.argv.slice(2);
let artifactsDir, runUrl, sha;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--dir' && i + 1 < args.length) {
    artifactsDir = args[++i];
  } else if (args[i] === '--run-url' && i + 1 < args.length) {
    runUrl = args[++i];
  } else if (args[i] === '--sha' && i + 1 < args.length) {
    sha = args[++i];
  }
}

if (!artifactsDir || !runUrl || !sha) {
  console.error('Usage: render-pr-comment.mjs --dir <dir> --run-url <url> --sha <sha>');
  process.exit(1);
}

// Collect evaluations from all e2e-eval-<app> directories
const evals = [];

if (existsSync(artifactsDir)) {
  const entries = readdirSync(artifactsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith('e2e-eval-')) {
      const app = entry.name.substring('e2e-eval-'.length);
      const evalPath = join(artifactsDir, entry.name, 'ci-evaluation.json');

      if (existsSync(evalPath)) {
        try {
          const evaluation = JSON.parse(readFileSync(evalPath, 'utf8'));
          evals.push({
            app: evaluation.app || app,
            nowPassing: evaluation.nowPassing || [],
          });
        } catch (err) {
          console.error(`Warning: Failed to read ${evalPath}: ${err.message}`, { file: 'stderr' });
        }
      }
    }
  }
}

// Render the comment
const comment = renderNowPassingComment(evals, { runUrl, sha });

// Output to stdout (empty string if null)
process.stdout.write(comment || '');
