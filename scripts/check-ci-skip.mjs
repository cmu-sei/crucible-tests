// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Self-check for the CI skip list application.
 * Runs Playwright --list with fixture and real skip lists to verify filtering works.
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const root = process.cwd();

/**
 * Run playwright test --list with given environment and return parsed test list.
 */
function discoverTests(env) {
  const tmpFile = join(tmpdir(), `check-ci-skip-${Date.now()}.json`);

  try {
    execSync(
      `npx playwright test --list --reporter=json > ${tmpFile} 2>&1`,
      { cwd: root, encoding: 'utf8', env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'], shell: true }
    );

    let output = readFileSync(tmpFile, 'utf8');
    unlinkSync(tmpFile);

    // Strip load-env logging (everything before the JSON report)
    // Look for the line that starts with `{` (the JSON root object)
    const lines = output.split('\n');
    const jsonStartLine = lines.findIndex(line => line.trim().startsWith('{'));
    if (jsonStartLine > 0) {
      output = lines.slice(jsonStartLine).join('\n');
    }

    const report = JSON.parse(output);
    const tests = [];

    function walkSuite(suite, titlePath = []) {
      // Add this suite's title to the path (unless it's the file-level suite)
      const isFileLevelSuite = suite.title === suite.file;
      const currentPath = isFileLevelSuite ? titlePath : [...titlePath, suite.title];

      if (suite.specs && suite.specs.length > 0) {
        for (const spec of suite.specs) {
          if (spec.tests && spec.tests.length > 0) {
            // Build the full title path: suite path + spec title
            const fullTitle = [...currentPath, spec.title].join(' › ');
            tests.push({
              file: spec.file,
              title: fullTitle,
            });
          }
        }
      }

      if (suite.suites && suite.suites.length > 0) {
        for (const nested of suite.suites) {
          walkSuite(nested, currentPath);
        }
      }
    }

    if (report.suites) {
      for (const suite of report.suites) {
        walkSuite(suite);
      }
    }

    return tests;
  } catch (err) {
    console.error('Failed to discover tests:', err.message);
    process.exit(1);
  }
}

/**
 * Check if a test matches a skip entry.
 * Entry uses canonical form (` > ` separator, straight quotes),
 * but test titles from Playwright use ` › ` and may have smart quotes.
 */
function matches(test, entry) {
  if (test.file !== entry.file) return false;
  if (entry.title === '*') return true;

  // Canonicalize both titles: replace › with >, smart quotes with straight, collapse whitespace
  const canonicalize = (title) => {
    return title
      .replace(/›/g, ' > ')
      .replace(/['']/g, "'")
      .replace(/[""]/g, '"')
      .replace(/\s+/g, ' ')
      .trim();
  };

  return canonicalize(test.title) === canonicalize(entry.title);
}

const sampleListPath = join(root, 'scripts/__fixtures__/ci-skip/sample.json');
const realListPath = join(root, 'ci/skip-in-ci.json');

console.log('CI skip self-check\n');

// Run A: aspire target with sample list (unfiltered)
console.log('Run A: CRUCIBLE_TARGET=aspire with sample skip list');
const runA = discoverTests({
  CRUCIBLE_TARGET: 'aspire',
  CRUCIBLE_SKIP_LIST: sampleListPath,
});
console.log(`  Listed ${runA.length} tests (unfiltered)\n`);

// Run B: ci target with sample list (filtered)
console.log('Run B: CRUCIBLE_TARGET=ci with sample skip list');
const runB = discoverTests({
  CRUCIBLE_TARGET: 'ci',
  CRUCIBLE_SKIP_LIST: sampleListPath,
});
console.log(`  Listed ${runB.length} tests (filtered)\n`);

// Load sample skip list
const sampleSkip = JSON.parse(readFileSync(sampleListPath, 'utf8'));

// Verify Run A includes all sample entries
console.log('Checking Run A includes all sample skip entries...');
for (const entry of sampleSkip) {
  const found = runA.find(t => matches(t, entry));
  if (!found) {
    console.error(`  FAIL: Run A missing test: ${entry.file} :: ${entry.title}`);
    process.exit(1);
  }
}
console.log('  OK\n');

// Verify Run B excludes all sample entries
console.log('Checking Run B excludes all sample skip entries...');
let failures = [];
for (const entry of sampleSkip) {
  const found = runB.find(t => matches(t, entry));
  if (found) {
    failures.push(`${entry.file} :: ${entry.title}`);
  }
}

if (failures.length > 0) {
  console.error('  FAIL: Run B still includes skipped tests:');
  for (const f of failures) {
    console.error(`    - ${f}`);
  }
  process.exit(1);
}
console.log('  OK\n');

// Verify sibling test exists in Run B
console.log('Checking Run B includes sibling tests...');
const singleTestEntry = sampleSkip.find(e => e.title !== '*');
if (singleTestEntry) {
  // Find tests from the same file in Run B
  const siblings = runB.filter(t => t.file === singleTestEntry.file);
  if (siblings.length === 0) {
    console.error(`  FAIL: No tests from ${singleTestEntry.file} in Run B`);
    process.exit(1);
  }
  console.log(`  OK: Found ${siblings.length} sibling(s) in ${singleTestEntry.file}\n`);
}

// Run C: Check for stale entries in real skip list
console.log('Run C: Checking real skip list for stale entries');
const realSkip = JSON.parse(readFileSync(realListPath, 'utf8'));

if (realSkip.length === 0) {
  console.log('  Real skip list is empty, skipping stale check\n');
} else {
  const runC = discoverTests({
    CRUCIBLE_TARGET: 'aspire',
  });

  let stale = [];
  for (const entry of realSkip) {
    const matched = runC.find(t => matches(t, entry));
    if (!matched) {
      stale.push(`${entry.file} :: ${entry.title}`);
    }
  }

  if (stale.length > 0) {
    console.error('  FAIL: Stale skip entries (no matching test):');
    for (const s of stale) {
      console.error(`    - ${s}`);
    }
    process.exit(1);
  }

  console.log(`  OK: All ${realSkip.length} entry(ies) match discovered tests\n`);
}

console.log('✓ All checks passed');
