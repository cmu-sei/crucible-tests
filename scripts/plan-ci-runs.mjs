#!/usr/bin/env node
// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * CI run planner CLI: computes affected apps from git diff and writes GitHub Actions matrix.
 *
 * Usage:
 *   node scripts/plan-ci-runs.mjs --base <sha> --head <sha>
 *   node scripts/plan-ci-runs.mjs --full [--apps <app1,app2,...>]
 */

import { execFileSync } from 'child_process';
import { readFileSync, existsSync, appendFileSync } from 'fs';
import { affectedRuns, buildImportGraph, toMatrix, parseAppsFilter } from './lib/ci-affected.mjs';

// Parse arguments
const args = process.argv.slice(2);
let base = null;
let head = null;
let full = false;
let appsArg = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--base' && i + 1 < args.length) {
    base = args[++i];
  } else if (args[i] === '--head' && i + 1 < args.length) {
    head = args[++i];
  } else if (args[i] === '--full') {
    full = true;
  } else if (args[i] === '--apps' && i + 1 < args.length) {
    appsArg = args[++i];
  }
}

// Validate arguments
if (!full && (!base || !head)) {
  console.error('Usage: plan-ci-runs.mjs --base <sha> --head <sha> | --full [--apps <app1,app2,...>]');
  process.exit(2);
}

// Validate app names if filter provided
const slices = JSON.parse(readFileSync('ci/slices.json', 'utf8'));
const validApps = Object.keys(slices);
const appsFilterResult = parseAppsFilter(appsArg, full, validApps);
if (!appsFilterResult.ok) {
  console.error(`Error: ${appsFilterResult.error}`);
  process.exit(2);
}
const appsFilter = appsFilterResult.apps;

let result;
let changed = [];

if (full) {
  // Full run mode
  result = {
    full: true,
    runs: validApps.map(app => ({ app, specs: [] })),
    dropped: [],
  };

  // Apply app filter if provided
  if (appsFilter) {
    result.runs = result.runs.filter(run => appsFilter.includes(run.app));
  }
} else {
  // Incremental mode: compute from git diff
  // Get changed files
  try {
    const diffOutput = execFileSync('git', ['diff', '--name-status', `${base}...${head}`], {
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    }).trim();

    if (diffOutput) {
      for (const line of diffOutput.split('\n')) {
        const parts = line.split('\t');
        let status = parts[0];
        let path = parts[1];

        // Handle renames: R100 old new -> treat new path as status R
        if (status.startsWith('R')) {
          path = parts[2];
          status = 'R';
        }

        changed.push({ path, status });
      }
    }
  } catch (err) {
    console.error(`Failed to run git diff: ${err.message}`);
    process.exit(1);
  }

  // Compute listChangedFiles from CI list changes
  const listChangedFiles = [];
  for (const listPath of ['ci/known-failures.json', 'ci/skip-in-ci.json']) {
    if (changed.some(c => c.path === listPath)) {
      // Compare base vs head versions
      let baseList = [];
      try {
        const baseContent = execFileSync('git', ['show', `${base}:${listPath}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        baseList = JSON.parse(baseContent);
      } catch {
        // Base file doesn't exist, treat as empty
      }

      const headList = existsSync(listPath) ? JSON.parse(readFileSync(listPath, 'utf8')) : [];

      // Find added/removed/edited entries
      const baseKeys = new Set(baseList.map(e => `${e.file}::${e.title}`));
      const headKeys = new Set(headList.map(e => `${e.file}::${e.title}`));

      for (const entry of headList) {
        const key = `${entry.file}::${entry.title}`;
        if (!baseKeys.has(key)) {
          listChangedFiles.push(entry.file);
        }
      }

      for (const entry of baseList) {
        const key = `${entry.file}::${entry.title}`;
        if (!headKeys.has(key)) {
          listChangedFiles.push(entry.file);
        }
      }
    }
  }

  // Load skip list from head
  const skipList = existsSync('ci/skip-in-ci.json')
    ? JSON.parse(readFileSync('ci/skip-in-ci.json', 'utf8'))
    : [];

  // Build import graph
  console.log('Building import graph...');
  const graph = buildImportGraph('.');

  // Compute affected runs
  result = affectedRuns(changed, graph, { listChangedFiles: [...new Set(listChangedFiles)], skip: skipList });
}

// Convert to matrix
const matrix = toMatrix(result);

// Write outputs
const outputFile = process.env.GITHUB_OUTPUT;
if (outputFile) {
  appendFileSync(outputFile, `matrix=${JSON.stringify(matrix)}\n`);
  appendFileSync(outputFile, `has_runs=${matrix.include.length > 0 ? 'true' : 'false'}\n`);
}

// Write summary
const summaryFile = process.env.GITHUB_STEP_SUMMARY;
if (summaryFile) {
  let summary = '';

  if (result.full) {
    summary += '## Full CI Run\n\n';
    summary += `Running all ${matrix.include.length} app(s)${appsFilter ? ` (filtered to: ${appsFilter.join(', ')})` : ''}.\n\n`;
  } else {
    summary += '## Affected Runs\n\n';
    if (matrix.include.length === 0) {
      summary += 'No affected apps.\n\n';
    } else {
      summary += `Running ${matrix.include.length} app(s):\n\n`;
      for (const { app, specs } of matrix.include) {
        const specCount = specs === `${app}/tests/` ? 'all specs' : `${specs.split(' ').length} spec(s)`;
        summary += `- **${app}**: ${specCount}\n`;
      }
      summary += '\n';
    }
  }

  if (result.dropped.length > 0) {
    summary += '## Dropped Specs\n\n';
    summary += 'These specs were skipped due to missing infrastructure:\n\n';
    for (const { spec, requires } of result.dropped) {
      summary += `- \`${spec}\` (requires: **${requires}**)\n`;
    }
    summary += '\n';
  }

  appendFileSync(summaryFile, summary);
}

// Print to stdout for local use
console.log(JSON.stringify(matrix, null, 2));
