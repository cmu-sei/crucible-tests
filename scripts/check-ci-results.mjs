// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Table-driven self-check for the CI results evaluator: known failures,
 * skip list, and list linting. Runs on every `npm run validate`.
 *
 * Usage: node --no-warnings scripts/check-ci-results.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { evaluate, lintLists, collectTests } from './lib/ci-results.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Read the sample fixture
const sampleReport = JSON.parse(
  readFileSync(join(__dirname, '__fixtures__/ci-results/sample-report.json'), 'utf8')
);

// Helper to create known/skip entries with all required fields
function knownEntry(file, title, reason = 'test reason') {
  return { file, title, reason, added: '2026-11-11' };
}

function skipEntry(file, title, requires, reason = 'needs infra') {
  return { file, title, requires, reason, added: '2026-11-11' };
}

// Test cases: [description, testFn, expectedResult]
const CASES = [
  // evaluate() cases
  [
    'null report → didNotRun',
    () => evaluate(null, [], [], { fullApps: [], app: 'alloy' }),
    (r) => r.ok === false && r.didNotRun === true,
  ],
  [
    'report with global errors → ok:false, globalErrors populated',
    () => {
      const report = { ...sampleReport, errors: [{ message: 'globalSetup failed' }] };
      return evaluate(report, [], [], { fullApps: [], app: 'alloy' });
    },
    (r) => r.ok === false && r.globalErrors.length === 1,
  ],
  [
    'unexpected test, no known entry → newFailures',
    () => {
      return evaluate(sampleReport, [], [], { fullApps: [], app: 'alloy' });
    },
    (r) =>
      r.newFailures.length === 2 &&
      r.ok === false &&
      r.newFailures.some(
        (f) =>
          f.file === 'alloy/tests/error-handling-and-validation/data-type-validation.spec.ts' &&
          f.title === 'light theme › Error Handling and Validation › Data Type Validation'
      ),
  ],
  [
    'unexpected test with matching known entry → knownFailures, ok:true',
    () => {
      const known = [
        knownEntry(
          'alloy/tests/error-handling-and-validation/data-type-validation.spec.ts',
          'light theme › Error Handling and Validation › Data Type Validation'
        ),
        knownEntry(
          'gameboard/tests/admin/delete-challenge.spec.ts',
          'Admin - Challenges › Delete Challenge (Spec) from Game'
        ),
      ];
      return evaluate(sampleReport, known, [], { fullApps: [], app: 'alloy' });
    },
    (r) => r.knownFailures.length === 2 && r.ok === true,
  ],
  [
    'unexpected test with wildcard * entry → ok:true',
    () => {
      const known = [
        knownEntry('alloy/tests/error-handling-and-validation/data-type-validation.spec.ts', '*'),
        knownEntry('gameboard/tests/admin/delete-challenge.spec.ts', '*'),
      ];
      return evaluate(sampleReport, known, [], { fullApps: [], app: 'alloy' });
    },
    (r) => r.ok === true && r.knownFailures.length === 2,
  ],
  [
    'entry title with doubled spaces still matches',
    () => {
      const known = [
        knownEntry(
          'alloy/tests/error-handling-and-validation/data-type-validation.spec.ts',
          'light theme ›  Error Handling  and Validation › Data  Type Validation'
        ),
        knownEntry('gameboard/tests/admin/delete-challenge.spec.ts', '*'),
      ];
      return evaluate(sampleReport, known, [], { fullApps: [], app: 'alloy' });
    },
    (r) => r.ok === true && r.knownFailures.length === 2,
  ],
  [
    'expected test with matching entry → nowPassing',
    () => {
      const known = [
        knownEntry(
          'alloy/tests/accessibility-and-usability/color-contrast-compliance.spec.ts',
          'Accessibility and Usability › Color Contrast Compliance'
        ),
        // Also add the unexpected tests so they don't block
        knownEntry('alloy/tests/error-handling-and-validation/data-type-validation.spec.ts', '*'),
        knownEntry('gameboard/tests/admin/delete-challenge.spec.ts', '*'),
      ];
      return evaluate(sampleReport, known, [], { fullApps: [], app: 'alloy' });
    },
    (r) => r.nowPassing.length === 1 && r.ok === true,
  ],
  [
    'flaky test with no entry → flaky, ok:true',
    () => {
      const flakyReport = {
        ...sampleReport,
        suites: [
          {
            title: 'alloy/tests/flaky.spec.ts',
            file: 'alloy/tests/flaky.spec.ts',
            column: 0,
            line: 0,
            specs: [],
            suites: [
              {
                title: 'Suite',
                file: 'alloy/tests/flaky.spec.ts',
                line: 10,
                column: 6,
                specs: [
                  {
                    title: 'Flaky Test',
                    ok: false,
                    tags: [],
                    tests: [
                      {
                        timeout: 120000,
                        annotations: [],
                        expectedStatus: 'passed',
                        projectId: 'chromium',
                        projectName: 'chromium',
                        results: [],
                        status: 'flaky',
                      },
                    ],
                    id: 'flaky-1',
                    file: 'alloy/tests/flaky.spec.ts',
                    line: 11,
                    column: 7,
                  },
                ],
              },
            ],
          },
        ],
      };
      return evaluate(flakyReport, [], [], { fullApps: [], app: 'alloy' });
    },
    (r) => r.flaky.length === 1 && r.ok === true,
  ],
  [
    'stale entry with fullApps → staleEntries populated',
    () => {
      const known = [knownEntry('cite/tests/y.spec.ts', 'Test Y')];
      return evaluate(sampleReport, known, [], { fullApps: ['cite'], app: 'cite' });
    },
    (r) => r.staleEntries.length === 1,
  ],
  [
    'stale entry without fullApps → staleEntries empty',
    () => {
      const known = [knownEntry('cite/tests/y.spec.ts', 'Test Y')];
      return evaluate(sampleReport, known, [], { fullApps: [], app: 'cite' });
    },
    (r) => r.staleEntries.length === 0,
  ],
  [
    'unexpected test with skip entry → skipLeaks, ok:false',
    () => {
      const skip = [
        skipEntry(
          'alloy/tests/error-handling-and-validation/data-type-validation.spec.ts',
          '*',
          'gitea'
        ),
      ];
      return evaluate(sampleReport, [], skip, { fullApps: [], app: 'alloy' });
    },
    (r) => r.skipLeaks.length === 1 && r.ok === false,
  ],
  [
    'skipped test with skip entry → no skipLeaks, ok:true',
    () => {
      const skip = [skipEntry('cite/tests/scoring/manual-scoring.spec.ts', '*', 'gitea')];
      // Also handle the unexpected tests from other apps
      const known = [
        knownEntry('alloy/tests/error-handling-and-validation/data-type-validation.spec.ts', '*'),
        knownEntry('gameboard/tests/admin/delete-challenge.spec.ts', '*'),
      ];
      return evaluate(sampleReport, known, skip, { fullApps: [], app: 'cite' });
    },
    (r) => r.skipLeaks.length === 0 && r.ok === true,
  ],
  [
    'skip entries grouped by requires → skippedInCi',
    () => {
      const skip = [
        skipEntry('alloy/tests/a.spec.ts', '*', 'gitea'),
        skipEntry('alloy/tests/b.spec.ts', '*', 'gitea'),
        skipEntry('alloy/tests/c.spec.ts', '*', 'hypervisor'),
      ];
      return evaluate(sampleReport, [], skip, { fullApps: [], app: 'alloy' });
    },
    (r) =>
      r.skippedInCi.length === 2 &&
      r.skippedInCi.some((s) => s.requires === 'gitea' && s.count === 2) &&
      r.skippedInCi.some((s) => s.requires === 'hypervisor' && s.count === 1),
  ],

  // lintLists() cases
  [
    'lint: nonexistent file → error',
    () => lintLists([knownEntry('nope.spec.ts', 't')], []),
    (r) => r.length === 1 && r[0].includes('nope.spec.ts'),
  ],
  [
    'lint: duplicate entries → error',
    () =>
      lintLists(
        [
          knownEntry('alloy/tests/accessibility-and-usability/color-contrast-compliance.spec.ts', 'Test A'),
          knownEntry('alloy/tests/accessibility-and-usability/color-contrast-compliance.spec.ts', 'Test A'),
        ],
        []
      ),
    (r) => r.length === 1 && r[0].includes('Duplicate'),
  ],
  [
    'lint: unknown requires value → error',
    () => lintLists([], [{ ...skipEntry('alloy/tests/accessibility-and-usability/color-contrast-compliance.spec.ts', '*', 'gitea'), requires: 'kubernetes' }]),
    (r) => r.length === 1 && r[0].includes('requires'),
  ],
  [
    'lint: entry on both lists → error',
    () => {
      const file = 'alloy/tests/accessibility-and-usability/color-contrast-compliance.spec.ts';
      return lintLists(
        [knownEntry(file, 'a › b')],
        [skipEntry(file, '*', 'gitea')]
      );
    },
    (r) => r.length === 1 && r[0].includes('both lists'),
  ],
  [
    'lint: real lists → no errors',
    () => {
      const known = JSON.parse(readFileSync(join(rootDir, 'ci/known-failures.json'), 'utf8'));
      const skip = JSON.parse(readFileSync(join(rootDir, 'ci/skip-in-ci.json'), 'utf8'));
      return lintLists(known, skip);
    },
    (r) => r.length === 0,
  ],

  // collectTests() case
  [
    'collectTests on sample fixture',
    () => collectTests(sampleReport),
    (r) =>
      r.some(
        (t) =>
          t.file === 'gameboard/tests/admin/delete-challenge.spec.ts' &&
          t.titlePath.join(' › ') === 'Admin - Challenges › Delete Challenge (Spec) from Game' &&
          t.status === 'unexpected'
      ),
  ],
];

let failures = 0;
for (const [description, testFn, checkFn] of CASES) {
  try {
    const result = testFn();
    if (!checkFn(result)) {
      failures++;
      console.log(`FAIL ${description}`);
      console.log(`     Result: ${JSON.stringify(result, null, 2).slice(0, 200)}...`);
    } else {
      console.log(`ok   ${description}`);
    }
  } catch (err) {
    failures++;
    console.log(`FAIL ${description}: ${err.message}`);
  }
}

console.log(`${CASES.length - failures}/${CASES.length} cases passed`);
process.exit(failures ? 1 : 0);
