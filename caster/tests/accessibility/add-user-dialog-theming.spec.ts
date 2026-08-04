// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: caster/caster-test-plan.md
// seed: seed.spec.ts

import {
  test,
  expect,
  gotoCasterUsersAdmin,
  openAddUserDialog,
  setCasterTheme,
} from '../../fixtures';

/**
 * Accessibility and Usability — Add User modal light/dark theming.
 *
 * The modal design specification (`design-specs/angular/modals.md` §5, §7, §10)
 * requires that a dialog inherit its colours from the M3 system tokens so both
 * themes are correct automatically, and that it be spot-checked in light *and* dark.
 * `add-user-dialog-modal-spec-compliance.spec.ts` runs the theme-agnostic rules in
 * both themes; this spec asserts what is specific to theming:
 *
 *   1. The palette genuinely inverts between themes (a modal that hardcoded its
 *      colours would look identical in both, which is the regression to catch).
 *   2. In each theme the dialog's own text tracks `--mat-sys-on-surface` and stays
 *      readable against the surface it is actually painted on (WCAG 1.4.3).
 *
 * Contrast is computed here rather than delegated to axe on purpose. Caster fails
 * axe's `color-contrast` theme-wide for two app-side reasons this modal does not own
 * and cannot fix — `AppComponent.setTheme` overwrites the generated
 * `--mat-sys-primary` with the branding orange, and `styles.scss` hardcodes
 * `--mat-sys-error` inside `.darkMode` — so a blanket axe assertion would be
 * permanently red and tell us nothing. Measuring the specific pairs the modal is
 * responsible for keeps a real signal: the dialog's body text and title must meet AA
 * in both themes, and they do.
 *
 * Read-only: the modal is dismissed via Cancel and never submitted, so no user is
 * created. The theme is a persisted user preference, so it is restored in afterEach.
 */

/** WCAG relative luminance for an `rgb(r, g, b)` string. */
function luminance(rgb: string): number {
  const [r, g, b] = rgb
    .match(/\d+(\.\d+)?/g)!
    .slice(0, 3)
    .map((v) => {
      const channel = Number(v) / 255;
      return channel <= 0.03928
        ? channel / 12.92
        : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two `rgb()` colours. */
function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Sample the colours the dialog actually renders with.
 *
 * `paintedSurface` walks up from the dialog container for the first non-transparent
 * background: the container itself computes to `rgba(0, 0, 0, 0)`, so comparing text
 * against it directly would divide by the wrong colour and report a bogus ratio.
 */
async function sampleDialogColors(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const container = document.querySelector('mat-dialog-container')!;
    const title = container.querySelector('.mat-mdc-dialog-title')!;

    const resolveToken = (token: string) => {
      const probe = document.createElement('span');
      probe.style.color = `var(${token})`;
      container.appendChild(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value;
    };

    const paintedBackground = (from: Element) => {
      let node: Element | null = from;
      while (node) {
        const bg = getComputedStyle(node).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
        node = node.parentElement;
      }
      return null;
    };

    return {
      isDark: document.body.classList.contains('darkMode'),
      // The overlay is appended outside the app root, so it only inherits the theme
      // if the theme class is applied somewhere it can see. If this is ever false in
      // dark mode, the dialog is rendering light-on-light in a dark app.
      overlayInheritsTheme:
        document.body.classList.contains('darkMode') ===
        !!document.querySelector('.cdk-overlay-container')?.closest('.darkMode'),
      bodyText: getComputedStyle(container).color,
      titleText: getComputedStyle(title).color,
      onSurfaceToken: resolveToken('--mat-sys-on-surface'),
      surface: paintedBackground(container),
    };
  });
}

test.describe('Accessibility and Usability', () => {
  test.afterEach(async ({ casterAuthenticatedPage: page }) => {
    // Restore even on failure — the theme persists per user and would otherwise
    // bleed into every spec that runs after this one.
    await setCasterTheme(page, 'light');
  });

  test('Add User Modal - light and dark theming', async ({
    casterAuthenticatedPage: page,
  }) => {
    await gotoCasterUsersAdmin(page);

    // ---- Light theme ----
    await setCasterTheme(page, 'light');
    let dialog = await openAddUserDialog(page);
    const light = await sampleDialogColors(page);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();

    // ---- Dark theme ----
    await setCasterTheme(page, 'dark');
    dialog = await openAddUserDialog(page);
    const dark = await sampleDialogColors(page);
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();

    // Sanity: each sample came from the theme we asked for.
    expect(light.isDark).toBe(false);
    expect(dark.isDark).toBe(true);

    // The overlay lives outside the app root; if it stopped inheriting the theme the
    // dialog would render with light colours inside a dark app.
    expect(light.overlayInheritsTheme).toBe(true);
    expect(dark.overlayInheritsTheme).toBe(true);

    // ---- 1. The palette actually inverts ----
    // A dialog that hardcoded its colours would produce identical samples here.
    expect(dark.bodyText).not.toBe(light.bodyText);
    expect(dark.surface).not.toBe(light.surface);

    // And it inverts in the right direction: dark theme means light text on a dark
    // surface, light theme the reverse.
    expect(luminance(light.bodyText)).toBeLessThan(luminance(light.surface!));
    expect(luminance(dark.bodyText)).toBeGreaterThan(luminance(dark.surface!));

    // ---- 2. Text comes from the token, and is readable, in both themes ----
    for (const [themeName, sample] of [
      ['light', light],
      ['dark', dark],
    ] as const) {
      // §5: the dialog does not set its own text colour — it inherits on-surface.
      expect(
        sample.bodyText,
        `${themeName}: dialog text should track --mat-sys-on-surface`,
      ).toBe(sample.onSurfaceToken);

      // WCAG 1.4.3: body text needs 4.5:1; the 24px title is large text (3:1), but
      // it shares the same token here so it clears the stricter bar too.
      const bodyContrast = contrastRatio(sample.bodyText, sample.surface!);
      expect(
        bodyContrast,
        `${themeName}: dialog body text contrast ${bodyContrast.toFixed(2)}:1 ` +
          `(${sample.bodyText} on ${sample.surface}) must be >= 4.5:1`,
      ).toBeGreaterThanOrEqual(4.5);

      const titleContrast = contrastRatio(sample.titleText, sample.surface!);
      expect(
        titleContrast,
        `${themeName}: dialog title contrast ${titleContrast.toFixed(2)}:1 ` +
          `(${sample.titleText} on ${sample.surface}) must be >= 3:1`,
      ).toBeGreaterThanOrEqual(3);
    }
  });

  /**
   * Validation error text must stay readable in both themes.
   *
   * Pending upstream: Caster's `src/styles/styles.scss` sets `--mat-sys-error: #ba1a1a`
   * inside its `.darkMode` block, overriding the `light-dark(#ba1a1a, #ffb4ab)` pair
   * that `mat.theme()` generates. One red cannot be readable on both surfaces, so dark
   * mode paints a dark red on a dark background: the error measures 2.01:1 where the
   * generated dark tone gives 7.66:1. WCAG 2.1 AA 1.4.3 requires 4.5:1, and Section 508
   * incorporates it.
   *
   * This test therefore FAILS IN DARK MODE against a build that still has that line,
   * and asserts the correct requirement rather than the broken behavior (per AGENTS.md,
   * "never adjust a test to work around an app bug"). Deleting the override in Caster is
   * the whole fix and makes both halves pass — no change is needed here when it lands.
   * Not skipped: the light half passes, and skipping would bury a Section 508 defect.
   */
  test('Add User Modal - error text contrast in both themes', async ({
    casterAuthenticatedPage: page,
  }) => {
    await gotoCasterUsersAdmin(page);

    const measureErrorContrast = async () => {
      const dialog = await openAddUserDialog(page);
      await dialog.getByRole('textbox', { name: 'User ID' }).fill('not-a-guid');
      await dialog.getByRole('textbox', { name: 'Name' }).click();

      const errorMessage = dialog
        .locator('mat-form-field')
        .filter({ has: page.getByText('User ID', { exact: true }) })
        .locator('mat-error');
      await expect(errorMessage).toBeVisible();

      // Material fades the subscript wrapper in, so wait for the colour to settle on
      // the theme token before measuring, or the sample is a mid-fade value.
      await expect
        .poll(() =>
          errorMessage.evaluate((el) => {
            const probe = document.createElement('span');
            probe.style.color = 'var(--mat-sys-error)';
            document.body.appendChild(probe);
            const token = getComputedStyle(probe).color;
            probe.remove();
            return getComputedStyle(el).color === token;
          }),
        )
        .toBe(true);

      const sample = await errorMessage.evaluate((el) => {
        const paintedBackground = (from: Element) => {
          let node: Element | null = from;
          while (node) {
            const bg = getComputedStyle(node).backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
            node = node.parentElement;
          }
          return null;
        };
        return {
          color: getComputedStyle(el).color,
          surface: paintedBackground(el),
        };
      });

      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog).not.toBeVisible();
      return sample;
    };

    await setCasterTheme(page, 'light');
    const light = await measureErrorContrast();

    await setCasterTheme(page, 'dark');
    const dark = await measureErrorContrast();

    // The error colour must differ between themes: M3 ships a light/dark pair
    // precisely because one red cannot be readable on both surfaces.
    expect(
      dark.color,
      'error colour should differ between themes — a single hardcoded red cannot ' +
        'be readable on both a light and a dark surface (see the Pending upstream ' +
        'note on this test)',
    ).not.toBe(light.color);

    for (const [themeName, sample] of [
      ['light', light],
      ['dark', dark],
    ] as const) {
      const ratio = contrastRatio(sample.color, sample.surface!);
      expect(
        ratio,
        `${themeName}: validation error contrast ${ratio.toFixed(2)}:1 ` +
          `(${sample.color} on ${sample.surface}) must be >= 4.5:1 (WCAG 1.4.3)`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
