// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * CI results evaluator: classifies Playwright JSON reports against
 * known-failures and skip-in-ci lists.
 */

import { existsSync } from 'fs';
import { join } from 'path';

const VALID_REQUIRES = ['terraform', 'gitea', 'hypervisor', 'vm-console', 'gameboard-deploy', 'moodle'];

/**
 * Generate normalized test key from file path and title path.
 * Collapses whitespace runs to single spaces.
 */
export function testKey(file, titlePath) {
  const joinedTitle = titlePath.join(' › ').replace(/\s+/g, ' ');
  return `${file} :: ${joinedTitle}`;
}

/**
 * Walk the report and extract all tests with their status.
 * Returns array of { file, titlePath, status }.
 * Excludes the file-level suite title from titlePath.
 */
export function collectTests(report) {
  const tests = [];

  function walkSuite(suite, titlePath = []) {
    // If this suite has specs, process them
    if (suite.specs && suite.specs.length > 0) {
      for (const spec of suite.specs) {
        if (spec.tests && spec.tests.length > 0) {
          // Get status from the chromium test
          const chromiumTest = spec.tests.find((t) => t.projectName === 'chromium') || spec.tests[0];
          tests.push({
            file: spec.file,
            titlePath: [...titlePath, spec.title],
            status: chromiumTest.status,
          });
        }
      }
    }

    // Recurse into nested suites
    if (suite.suites && suite.suites.length > 0) {
      for (const nested of suite.suites) {
        // If this is NOT the file-level suite (title === file), add to titlePath
        const isFileLevelSuite = nested.title === nested.file;
        const newTitlePath = isFileLevelSuite ? titlePath : [...titlePath, nested.title];
        walkSuite(nested, newTitlePath);
      }
    }
  }

  // Start from top-level suites (these are file-level)
  if (report.suites) {
    for (const topSuite of report.suites) {
      walkSuite(topSuite, []);
    }
  }

  return tests;
}

/**
 * Check if a test matches a list entry.
 * Handles '*' wildcards and whitespace normalization.
 */
function matches(testFile, testTitlePath, entryFile, entryTitle) {
  if (testFile !== entryFile) return false;
  if (entryTitle === '*') return true;

  const testTitle = testTitlePath.join(' › ').replace(/\s+/g, ' ');
  const normalizedEntryTitle = entryTitle.replace(/\s+/g, ' ');
  return testTitle === normalizedEntryTitle;
}

/**
 * Evaluate a Playwright JSON report against known-failures and skip-in-ci lists.
 */
export function evaluate(report, known, skip, opts) {
  const { fullApps, app } = opts;

  const result = {
    ok: true,
    didNotRun: false,
    globalErrors: [],
    newFailures: [],
    knownFailures: [],
    nowPassing: [],
    flaky: [],
    staleEntries: [],
    skipLeaks: [],
    skippedInCi: [],
    counts: { expected: 0, unexpected: 0, flaky: 0, skipped: 0 },
  };

  // Check for null report or zero tests
  if (!report) {
    result.didNotRun = true;
    result.ok = false;
    return result;
  }

  // Check for global errors
  if (report.errors && report.errors.length > 0) {
    result.globalErrors = report.errors.map((e) => e.message || String(e));
    result.ok = false;
  }

  // Collect all tests
  const tests = collectTests(report);

  // If no tests collected, mark as didNotRun
  if (tests.length === 0) {
    result.didNotRun = true;
    result.ok = false;
    return result;
  }

  // Track which list entries were matched
  const matchedEntries = new Set();

  // Process each test
  for (const test of tests) {
    const { file, titlePath, status } = test;
    const key = { file, title: titlePath.join(' › ') };

    // Update counts
    if (status === 'expected') result.counts.expected++;
    else if (status === 'unexpected') result.counts.unexpected++;
    else if (status === 'flaky') result.counts.flaky++;
    else if (status === 'skipped') result.counts.skipped++;

    // Check if this test is on the skip list
    const skipEntry = skip.find((s) => matches(file, titlePath, s.file, s.title));

    // Check if this test is on the known list
    const knownEntry = known.find((k) => matches(file, titlePath, k.file, k.title));

    if (status === 'unexpected') {
      // Check for skip list leak first
      if (skipEntry) {
        result.skipLeaks.push(key);
      } else if (knownEntry) {
        result.knownFailures.push(key);
        matchedEntries.add(knownEntry);
      } else {
        result.newFailures.push(key);
      }
    } else if (status === 'expected') {
      if (knownEntry) {
        result.nowPassing.push(key);
        matchedEntries.add(knownEntry);
      }
    } else if (status === 'flaky') {
      result.flaky.push(key);
    }

    // Check for skip leaks (skipped test should be on skip list)
    if (status === 'skipped' && skipEntry) {
      matchedEntries.add(skipEntry);
    } else if (status !== 'skipped' && skipEntry) {
      // Test ran but should have been skipped
      if (!result.skipLeaks.some((k) => k.file === key.file && k.title === key.title)) {
        result.skipLeaks.push(key);
      }
    }
  }

  // Find stale entries (only for fullApps)
  if (fullApps.includes(app)) {
    const testedFiles = new Set(tests.map((t) => t.file));
    for (const entry of known) {
      const entryApp = entry.file.split('/')[0];
      if (entryApp === app && !matchedEntries.has(entry)) {
        // Check if any test from this file ran
        if (entry.title === '*') {
          if (!testedFiles.has(entry.file)) {
            result.staleEntries.push(entry);
          }
        } else {
          // Check if this specific test ran
          const testRan = tests.some((t) =>
            matches(t.file, t.titlePath, entry.file, entry.title)
          );
          if (!testRan) {
            result.staleEntries.push(entry);
          }
        }
      }
    }
  }

  // Count skipped tests by requires
  const skipCounts = {};
  for (const entry of skip) {
    const entryApp = entry.file.split('/')[0];
    if (entryApp === app) {
      skipCounts[entry.requires] = (skipCounts[entry.requires] || 0) + 1;
    }
  }
  result.skippedInCi = Object.entries(skipCounts)
    .map(([requires, count]) => ({ requires, count }))
    .sort((a, b) => a.requires.localeCompare(b.requires));

  // Determine if the run is OK
  result.ok =
    !result.didNotRun &&
    result.globalErrors.length === 0 &&
    result.newFailures.length === 0 &&
    result.skipLeaks.length === 0;

  return result;
}

/**
 * Lint the known-failures and skip-in-ci lists.
 * Returns array of error messages.
 */
export function lintLists(known, skip) {
  const errors = [];

  // Validate known list
  if (!Array.isArray(known)) {
    errors.push('known-failures.json must be an array');
    return errors;
  }

  // Validate skip list
  if (!Array.isArray(skip)) {
    errors.push('skip-in-ci.json must be an array');
    return errors;
  }

  const knownKeys = new Set();
  const skipKeys = new Set();

  // Check known entries
  for (const entry of known) {
    if (!entry.file || !entry.title || !entry.reason || !entry.added) {
      errors.push(`Known entry missing required fields: ${JSON.stringify(entry)}`);
      continue;
    }

    // Check date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.added)) {
      errors.push(`Known entry has invalid date format: ${entry.file} :: ${entry.title}`);
    }

    // Check file exists
    if (!existsSync(entry.file)) {
      errors.push(`Known entry references nonexistent file: ${entry.file}`);
    }

    // Check for duplicates
    const key = `${entry.file}::${entry.title}`;
    if (knownKeys.has(key)) {
      errors.push(`Duplicate known entry: ${entry.file} :: ${entry.title}`);
    }
    knownKeys.add(key);
  }

  // Check skip entries
  for (const entry of skip) {
    if (!entry.file || !entry.title || !entry.requires || !entry.reason || !entry.added) {
      errors.push(`Skip entry missing required fields: ${JSON.stringify(entry)}`);
      continue;
    }

    // Check requires value
    if (!VALID_REQUIRES.includes(entry.requires)) {
      errors.push(
        `Skip entry has invalid requires value "${entry.requires}": ${entry.file} :: ${entry.title}`
      );
    }

    // Check date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.added)) {
      errors.push(`Skip entry has invalid date format: ${entry.file} :: ${entry.title}`);
    }

    // Check file exists
    if (!existsSync(entry.file)) {
      errors.push(`Skip entry references nonexistent file: ${entry.file}`);
    }

    // Check for duplicates
    const key = `${entry.file}::${entry.title}`;
    if (skipKeys.has(key)) {
      errors.push(`Duplicate skip entry: ${entry.file} :: ${entry.title}`);
    }
    skipKeys.add(key);
  }

  // Check for entries on both lists
  for (const knownEntry of known) {
    for (const skipEntry of skip) {
      if (knownEntry.file === skipEntry.file) {
        // Check if they overlap
        if (
          knownEntry.title === skipEntry.title ||
          knownEntry.title === '*' ||
          skipEntry.title === '*'
        ) {
          errors.push(
            `Test appears on both lists: ${knownEntry.file} (known: "${knownEntry.title}", skip: "${skipEntry.title}")`
          );
        }
      }
    }
  }

  return errors;
}

/**
 * Render a markdown summary of the evaluation.
 */
export function renderSummary(e, app) {
  const sections = [];

  // Counts table
  sections.push('## Test Results\n');
  sections.push('| Status | Count |');
  sections.push('|--------|-------|');
  sections.push(`| Expected | ${e.counts.expected} |`);
  sections.push(`| Unexpected | ${e.counts.unexpected} |`);
  sections.push(`| Flaky | ${e.counts.flaky} |`);
  sections.push(`| Skipped | ${e.counts.skipped} |`);
  sections.push('');

  // New failures (blocking)
  if (e.newFailures.length > 0) {
    sections.push('## ❌ New Failures (BLOCKING)\n');
    for (const f of e.newFailures) {
      sections.push(`- \`${f.file} :: ${f.title}\``);
    }
    sections.push('');
  }

  // Did not run / global errors
  if (e.didNotRun || e.globalErrors.length > 0) {
    sections.push('## ❌ Did Not Run (BLOCKING)\n');
    if (e.didNotRun) {
      sections.push('Suite did not run or produced no results.\n');
    }
    for (const err of e.globalErrors) {
      sections.push(`- ${err}`);
    }
    sections.push('');
  }

  // Skip list not applied (blocking)
  if (e.skipLeaks.length > 0) {
    sections.push('## ❌ Skip List Not Applied (BLOCKING)\n');
    sections.push('These tests should have been skipped but ran anyway:\n');
    for (const f of e.skipLeaks) {
      sections.push(`- \`${f.file} :: ${f.title}\``);
    }
    sections.push('');
  }

  // Now passing
  if (e.nowPassing.length > 0) {
    sections.push('## ✅ Now Passing — Remove from known-failures\n');
    for (const f of e.nowPassing) {
      sections.push(`- \`${f.file} :: ${f.title}\``);
    }
    sections.push('');
  }

  // Known failures
  if (e.knownFailures.length > 0) {
    sections.push('## Known Failures\n');
    for (const f of e.knownFailures) {
      sections.push(`- \`${f.file} :: ${f.title}\``);
    }
    sections.push('');
  }

  // Flaky
  if (e.flaky.length > 0) {
    sections.push('## Flaky Tests\n');
    for (const f of e.flaky) {
      sections.push(`- \`${f.file} :: ${f.title}\``);
    }
    sections.push('');
  }

  // Stale entries
  if (e.staleEntries.length > 0) {
    sections.push('## Stale Entries\n');
    sections.push('These known-failures entries did not match any test in this run:\n');
    for (const entry of e.staleEntries) {
      sections.push(`- \`${entry.file} :: ${entry.title}\``);
    }
    sections.push('');
  }

  // Skipped in CI
  if (e.skippedInCi.length > 0) {
    sections.push('## Skipped in CI\n');
    for (const s of e.skippedInCi) {
      sections.push(`- **${s.requires}**: ${s.count} test(s)`);
    }
    sections.push('');
  }

  return sections.join('\n');
}
