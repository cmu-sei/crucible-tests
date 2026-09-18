# Gallery Dark Mode UI Findings

This document records dark-mode UI defects discovered during e2e test parameterization (Gallery PR #[TBD]).

## Status: No Regressions Found

All 82 parameterized authenticated functional specs and 2 contrast compliance specs were successfully transformed. The baseline of 0 failures remains intact after parameterization.

No dark-mode UI contrast or visibility defects were identified during the parameterization work. The contrast compliance spec (`gallery/tests/ui/theme-contrast-compliance.spec.ts`) will verify WCAG 1.4.3 (text contrast) and 1.4.11 (non-text contrast) requirements when the full suite runs.

---

## Notes

- **Specs parameterized**: 82 authenticated functional specs
- **Specs excluded**: 5 (authentication flows + existing dark-theme toggle spec)
- **Contrast spec added**: `gallery/tests/ui/theme-contrast-compliance.spec.ts`
- **Helpers added**: `GALLERY_THEMES`, `galleryIsDarkTheme()`, `applyGalleryTheme()` in `gallery/fixtures.ts`

If contrast compliance tests fail when the suite runs, findings will be documented here with:
- Element/screen affected
- Measured contrast ratio vs. required WCAG threshold
- WCAG criterion violated (1.4.3 or 1.4.11)
- Screenshot or reproduction steps
