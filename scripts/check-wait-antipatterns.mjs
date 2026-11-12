// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Lint for performance-harmful wait patterns in Playwright tests.
 *
 * Detects five kinds of antipatterns:
 * - fixed-sleep: `.waitForTimeout(`
 * - networkidle: the string literal `networkidle`
 * - race-over-wait: `Promise.race(` containing `.waitFor*` calls
 * - long-timeout: `timeout: N` with N > 30000 in spec files
 * - set-timeout: `test.setTimeout(` in spec files
 *
 * Escape hatch: `// allow-wait-antipattern: <why>` on the line immediately above.
 *
 * Usage:
 *   node scripts/check-wait-antipatterns.mjs [--app <name>] [--list] [paths...]
 *
 * There is no baseline: every violation without an escape comment fails the check.
 */

import { readFileSync, statSync } from 'node:fs';
import { relative, sep, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectTsFiles, blankCommentsAndStrings } from './lib/source-scan.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ALLOW_MARKER = 'allow-wait-antipattern';
const EXCLUDED_DIRS = new Set(['node_modules', '.claude', 'scripts', 'docs', 'playwright-report', 'test-results', 'moodle']);

// Parse CLI arguments
const args = process.argv.slice(2);
let listMode = false;
let appFilter = null;
const explicitPaths = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--list') {
    listMode = true;
  } else if (args[i] === '--app') {
    appFilter = args[++i];
    if (!appFilter || appFilter.startsWith('-')) {
      console.error('wait-antipatterns: --app needs an app directory name, e.g. --app cite');
      process.exit(2);
    }
  } else {
    explicitPaths.push(args[i]);
  }
}

// Determine scan roots
function getScanRoots() {
  if (explicitPaths.length > 0) {
    return explicitPaths;
  }

  if (appFilter) {
    return [join(ROOT, appFilter)];
  }

  return [ROOT];
}

// Collect files to scan
function collectFilesToScan() {
  const roots = getScanRoots();
  const files = [];

  for (const root of roots) {
    if (explicitPaths.length > 0) {
      // When explicit paths are given, bypass the exclude list
      // Check if the path is a file or directory
      try {
        const stat = statSync(root);
        if (stat.isFile() && root.endsWith('.ts')) {
          files.push(root);
        } else if (stat.isDirectory()) {
          collectTsFiles(root, files);
        }
      } catch (err) {
        console.error(`Warning: Could not access ${root}: ${err.message}`);
      }
    } else {
      // Default scan: respect exclude list
      const candidates = [];
      collectTsFiles(root, candidates);

      for (const file of candidates) {
        const relPath = relative(ROOT, file);
        const pathParts = relPath.split(sep);

        // Skip if any part of the path is in the exclude list
        if (pathParts.some(part => EXCLUDED_DIRS.has(part))) {
          continue;
        }

        files.push(file);
      }
    }
  }

  return files;
}

// Check if a file is a spec file
function isSpecFile(filePath) {
  return /tests\/.*\.spec\.ts$/.test(filePath);
}

// Find all occurrences of a pattern in source
function findAll(source, pattern, fromIndex = 0) {
  const results = [];
  let index = fromIndex;

  while (true) {
    index = source.indexOf(pattern, index);
    if (index === -1) break;
    results.push(index);
    index += pattern.length;
  }

  return results;
}

// Get matching closing delimiter for Promise.race argument
function getMatchingCloseParen(source, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

// Extract number from timeout: N pattern
function extractTimeoutValue(source, startIndex) {
  const match = source.slice(startIndex).match(/^timeout:\s*(\d[\d_]*)/);
  if (!match) return null;
  // Strip underscores before parsing (e.g., 60_000 -> 60000)
  return parseInt(match[1].replace(/_/g, ''), 10);
}

// Get line number from character offset
function getLineNumber(source, offset) {
  return source.slice(0, offset).split('\n').length;
}

// Check if line has allow marker on the previous line
function hasAllowMarker(source, lineNumber) {
  const lines = source.split('\n');
  if (lineNumber < 2) return false;
  const previousLine = lines[lineNumber - 2];
  return previousLine && previousLine.includes(ALLOW_MARKER);
}

// Scan a file for violations
function scanFile(filePath) {
  const source = readFileSync(filePath, 'utf8');
  const blanked = blankCommentsAndStrings(source);
  const violations = [];
  const isSpec = isSpecFile(filePath);

  // Kind 1: fixed-sleep (.waitForTimeout()
  const sleepOccurrences = findAll(blanked, '.waitForTimeout(');
  for (const index of sleepOccurrences) {
    const line = getLineNumber(source, index);
    if (!hasAllowMarker(source, line)) {
      violations.push({ line, kind: 'fixed-sleep' });
    }
  }

  // Kind 2: networkidle (string literal only, not in comments)
  // Search for quoted 'networkidle' in unblanked source
  for (const quote of ["'", '"', '`']) {
    const pattern = `${quote}networkidle${quote}`;
    const occurrences = findAll(source, pattern);

    for (const index of occurrences) {
      // Check if this location is preserved in blanked source (i.e., not in a comment)
      // In blanked source, string contents are blanked but quotes remain
      // Comments are completely blanked
      const blankedSlice = blanked.slice(index, index + pattern.length);

      // If the quotes are still there in the blanked source, it was a real string literal
      if (blankedSlice.startsWith(quote) && blankedSlice.endsWith(quote)) {
        const line = getLineNumber(source, index);
        if (!hasAllowMarker(source, line)) {
          violations.push({ line, kind: 'networkidle' });
        }
      }
    }
  }

  // Kind 3: race-over-wait
  const raceOccurrences = findAll(blanked, 'Promise.race(');
  for (const index of raceOccurrences) {
    const openParen = index + 'Promise.race('.length - 1;
    const closeParen = getMatchingCloseParen(blanked, openParen);

    if (closeParen !== -1) {
      const argument = blanked.slice(openParen + 1, closeParen);
      const hasWait =
        argument.includes('.waitFor(') ||
        argument.includes('.waitForURL(') ||
        argument.includes('.waitForSelector(') ||
        argument.includes('.waitForResponse(');

      if (hasWait) {
        const line = getLineNumber(source, index);
        if (!hasAllowMarker(source, line)) {
          violations.push({ line, kind: 'race-over-wait' });
        }
      }
    }
  }

  // Kind 4 & 5: long-timeout and set-timeout (only in spec files)
  if (isSpec) {
    // long-timeout: timeout: N with N > 30000
    const timeoutOccurrences = findAll(blanked, 'timeout:');
    for (const index of timeoutOccurrences) {
      const value = extractTimeoutValue(blanked, index);
      if (value !== null && value > 30000) {
        const line = getLineNumber(source, index);
        if (!hasAllowMarker(source, line)) {
          violations.push({ line, kind: 'long-timeout' });
        }
      }
    }

    // set-timeout: test.setTimeout(
    const setTimeoutOccurrences = findAll(blanked, 'test.setTimeout(');
    for (const index of setTimeoutOccurrences) {
      const line = getLineNumber(source, index);
      if (!hasAllowMarker(source, line)) {
        violations.push({ line, kind: 'set-timeout' });
      }
    }
  }

  return violations;
}

// Main logic
const files = collectFilesToScan();
const allViolations = [];
const scannedFiles = new Set();

for (const file of files) {
  const violations = scanFile(file);
  const relPath = relative(ROOT, file).split(sep).join('/');
  scannedFiles.add(relPath);

  for (const violation of violations) {
    allViolations.push({
      file: relPath,
      line: violation.line,
      kind: violation.kind,
    });
  }
}

// Sort violations by file then line
allViolations.sort((a, b) => {
  if (a.file !== b.file) return a.file.localeCompare(b.file);
  return a.line - b.line;
});

// List mode: print all violations and exit 0
if (listMode) {
  for (const v of allViolations) {
    console.log(`${v.file}:${v.line} ${v.kind}`);
  }
  process.exit(0);
}

if (allViolations.length === 0) {
  console.log(`wait-antipatterns: 0 violation(s) in ${scannedFiles.size} file(s)`);
  process.exit(0);
}

console.error(`wait-antipatterns: ${allViolations.length} violation(s) without an escape comment:\n`);
for (const v of allViolations) {
  console.error(`  ${v.file}:${v.line} ${v.kind}`);
}
console.error(
  `\nReplace each with an event-driven wait (CLAUDE.md "Waiting rules"), or, only where the app\n` +
  `genuinely lacks a completion signal, add \`// ${ALLOW_MARKER}: <what the app lacks>\` on the line above.`
);
process.exit(1);
