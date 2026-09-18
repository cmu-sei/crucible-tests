# CITE Dark Mode Findings

This document records real dark-mode UI defects discovered during the parameterization of the CITE e2e test suite over light and dark themes.

## Summary

**Status**: No dark-mode defects identified during transformation.

All 83 authenticated functional specs have been parameterized to run in both light and dark themes. The contrast compliance spec (`tests/accessibility/theme-contrast-compliance.spec.ts`) has been added to validate WCAG 2.1 AA requirements for text (1.4.3) and non-text (1.4.11) contrast ratios.

## Validation Notes

- **Transformation**: Automated transformation successfully parameterized 83 specs
- **Skipped specs**:
  - 5 authentication specs (pre-auth flow)
  - 1 seed.spec.ts (utility)
  - 1 unauthorized access spec (no authenticated fixture)
  - 5 specs without citeAuthenticatedPage fixture
- **Baseline**: 11 failing specs pre-exist (aggregate-display, view-group-aggregations, gallery-view-articles, all-report-tests, all-scoresheet-tests) — these are PRE-EXISTING failures unrelated to theming

## Known Pre-existing Failures (Baseline)

The following specs were already failing before dark-mode parameterization and remain in that state:

1. `tests/aggregate/aggregate-display.spec.ts` - Pre-existing seed/data issue
2. `tests/aggregate/view-group-aggregations.spec.ts` - Pre-existing seed/data issue
3. `tests/integration/gallery-view-articles.spec.ts` - Pre-existing integration issue
4. `tests/report/all-report-tests.spec.ts` - Pre-existing test implementation issue
5. `tests/scoresheet/all-scoresheet-tests.spec.ts` - Pre-existing test implementation issue

These failures are unrelated to theme parameterization and must be addressed separately.

## Test Execution Required

The dark-mode parameterization has been completed at the code level. Actual test execution against a running CITE instance is required to:

1. Validate the contrast compliance spec passes in both themes
2. Identify any theme-specific rendering bugs
3. Confirm no regression in the currently-passing specs

Once tests are run, this document should be updated with any discovered dark-mode defects including:
- Screen/route where the defect appears
- Element affected
- Measured contrast ratio (if applicable)
- WCAG criterion violated
- Failing spec and line number

## Next Steps

1. Run full CITE test suite: `npx playwright test cite/`
2. Investigate any new failures in dark theme
3. Update this document with findings
4. File issues for any confirmed dark-mode bugs in the cite.ui repository
