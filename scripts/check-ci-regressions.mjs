// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Table-driven self-check for the regression issue renderer.
 * Runs on every `npm run validate`.
 *
 * Usage: node --no-warnings scripts/check-ci-regressions.mjs
 */

import {
  confirmedRegressions,
  digestDiff,
  renderRegressionIssue,
  renderRecurrenceComment,
  renderRecoveredComment,
  mentionFor,
} from './lib/ci-regressions.mjs';
import { lintLists } from './lib/ci-results.mjs';

const ctx = {
  runUrl: 'https://github.com/org/repo/actions/runs/12345',
  mention: '@test-team',
};

// Sample test keys
const A = { file: 'cite/tests/a.spec.ts', title: 'Test A › Should work' };
const B = { file: 'cite/tests/b.spec.ts', title: 'Test B › Should work' };
const C = { file: 'gallery/tests/c.spec.ts', title: 'Test C › Should work' };

// Test cases: [description, testFn, expectedResult]
const CASES = [
  [
    'confirmedRegressions with intersecting failures → returns intersection',
    () => confirmedRegressions({ newFailures: [A, B] }, { newFailures: [B] }),
    (r) => Array.isArray(r) && r.length === 1 && r[0].file === B.file && r[0].title === B.title,
  ],
  [
    'confirmedRegressions with null confirm → returns []',
    () => confirmedRegressions({ newFailures: [A] }, null),
    (r) => Array.isArray(r) && r.length === 0,
  ],
  [
    'digestDiff with changed service → returns diff',
    () => digestDiff({ x: 'i@sha256:2', y: 'j@sha256:1' }, { x: 'i@sha256:1', y: 'j@sha256:1' }),
    (r) =>
      Array.isArray(r) &&
      r.length === 1 &&
      r[0].service === 'x' &&
      r[0].from === 'i@sha256:1' &&
      r[0].to === 'i@sha256:2',
  ],
  [
    'digestDiff with null lastClean → returns []',
    () => digestDiff({ x: 'i@sha256:2' }, null),
    (r) => Array.isArray(r) && r.length === 0,
  ],
  [
    'renderRegressionIssue title → E2E regression: <app>',
    () => renderRegressionIssue('cite', [A], [], ctx),
    (r) => r && r.title === 'E2E regression: cite',
  ],
  [
    'renderRegressionIssue body → contains marker, mention, key, and run link',
    () => renderRegressionIssue('cite', [A], [], ctx),
    (r) => {
      if (!r || typeof r.body !== 'string') return false;
      if (!r.body.includes('<!-- crucible-tests:e2e-regression:cite -->')) return false;
      if (!r.body.includes(ctx.mention)) return false;
      if (!r.body.includes(`${A.file} :: ${A.title}`)) return false;
      if (!r.body.includes(ctx.runUrl)) return false;
      return true;
    },
  ],
  [
    'renderRegressionIssue with no diff → contains "no earlier clean run to compare"',
    () => renderRegressionIssue('cite', [A], [], ctx),
    (r) => r && r.body.includes('no earlier clean run to compare'),
  ],
  [
    'renderRegressionIssue details block → parses and passes lintLists (except TODO)',
    () => renderRegressionIssue('cite', [A, B], [], ctx),
    (r) => {
      if (!r || typeof r.body !== 'string') return false;
      // Extract JSON from details block
      const jsonMatch = r.body.match(/```json\n([\s\S]*?)\n```/);
      if (!jsonMatch) return false;
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (!Array.isArray(parsed) || parsed.length !== 2) return false;

        // Check that entries have required fields
        for (const entry of parsed) {
          if (!entry.file || !entry.title || !entry.reason || !entry.added) return false;
        }

        // Run lintLists with a version that has real reasons instead of TODO
        const withRealReasons = parsed.map((e) => ({
          ...e,
          reason: 'Real reason',
        }));

        const errors = lintLists(withRealReasons, []);
        // Should have no errors (file existence errors are expected in tests)
        return errors.filter(e => !e.includes('nonexistent file')).length === 0;
      } catch {
        return false;
      }
    },
  ],
  [
    'mentionFor cmu-sei/crucible-tests → live mention',
    () => mentionFor('cmu-sei/crucible-tests'),
    (r) => r === '@cmu-sei/crucible-code-owners',
  ],
  [
    'mentionFor other repo → backticked mention',
    () => mentionFor('someone/crucible-tests'),
    (r) => r === '`@cmu-sei/crucible-code-owners`',
  ],
  [
    'renderRecoveredComment → contains "closing"',
    () => renderRecoveredComment('cite', ctx),
    (r) => typeof r === 'string' && r.toLowerCase().includes('closing'),
  ],
  [
    'renderRecurrenceComment → contains keys and run link',
    () => renderRecurrenceComment([A], [], ctx),
    (r) => {
      if (typeof r !== 'string') return false;
      if (!r.includes(`${A.file} :: ${A.title}`)) return false;
      if (!r.includes(ctx.runUrl)) return false;
      return true;
    },
  ],
];

// Run all test cases
let failed = 0;
for (const [desc, testFn, expectFn] of CASES) {
  try {
    const result = testFn();
    const pass = expectFn(result);
    if (pass) {
      console.log(`✓ ${desc}`);
    } else {
      console.error(`✗ ${desc}`);
      console.error('  Result did not match expectations');
      failed++;
    }
  } catch (err) {
    console.error(`✗ ${desc}`);
    console.error(`  ${err.message}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}

console.log(`\nAll ${CASES.length} tests passed`);
