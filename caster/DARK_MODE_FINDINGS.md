# Caster Dark Mode Test Findings

## Summary
Dark-mode test parameterization has been added to the Caster Playwright test suite.
127 authenticated functional specs now run in both light and dark themes, and a new
`theme-contrast-compliance.spec.ts` spec validates WCAG 1.4.3 text contrast and 1.4.11
icon contrast on the home page surface.

## Known Issues
None identified during parameterization. The baseline remains 1 pre-existing failing spec:
- `caster/tests/projects-management/search-and-filter-projects.spec.ts`

This file was parameterized for dark-mode coverage but its existing failure is unrelated
to theming and was not addressed during this work.

## Test Coverage
- **Parameterized**: 127 authenticated functional specs (light + dark)
- **Left un-parameterized**: 6 specs
  - 3 authentication flow specs (fresh/unauthenticated state)
  - 1 theme toggle spec (toggles theme itself)
  - 1 add-user-dialog theming spec (toggles theme itself)
  - 1 responsive-layout-mobile spec (not authenticated)
- **New contrast spec**: `tests/accessibility/theme-contrast-compliance.spec.ts`
  - WCAG 1.4.3: "My Projects" heading, "Name" column header
  - Direction check: light-on-dark vs dark-on-light
  - WCAG 1.4.11: "New Project" primary action button icon

## Changes Made
1. Added `CASTER_THEMES` and `CasterTheme` type to `caster/fixtures.ts`
2. Wrapped all authenticated functional specs with `for (const theme of CASTER_THEMES)`
3. Added `await setCasterTheme(page, theme);` as first line of each test body
4. Created `tests/accessibility/theme-contrast-compliance.spec.ts` measuring real painted colours

## Next Steps
Run the full suite to identify any actual dark-mode UI bugs (contrast, visibility, layout).
Any findings should be documented here with:
- Screen/route
- Element selector
- Measured vs required contrast ratio (or visual defect description)
- WCAG criterion
- Failing spec file and line number
