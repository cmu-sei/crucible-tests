// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

/**
 * Theme, contrast and seeding helpers shared by the Player-family suites
 * (`player/`, `playerVm/`, `console/`). All three UIs use the same Crucible
 * theme plumbing (a `darkMode` class on `<body>`, a `?theme=` boot param, a
 * Material menu "Dark Theme" switch, and `ComnSettingsService` layered settings),
 * so the mechanics live here. Each suite's `fixtures.ts` keeps its own
 * app-specific entry points (`setPlayerTheme`, `gotoPlayerVm`, `gotoConsole`, ...)
 * and builds them on these.
 */

import { createHash } from 'crypto';
import { expect, Locator, Page, TestInfo } from '@playwright/test';

// ---------------------------------------------------------------------------
// Theme state
// ---------------------------------------------------------------------------

/** The themes each authenticated spec is parameterized over. */
export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

/** Whether the page is currently rendering the dark theme (`<body class="darkMode">`). */
export async function isDarkTheme(page: Page): Promise<boolean> {
  return page.evaluate(() => document.body.classList.contains('darkMode'));
}

/** Wait for `<body>` to reflect `theme`. */
export async function expectBodyTheme(page: Page, theme: Theme): Promise<void> {
  if (theme === 'dark') {
    await expect(page.locator('body')).toHaveClass(/\bdarkMode\b/, { timeout: 10000 });
  } else {
    await expect(page.locator('body')).not.toHaveClass(/\bdarkMode\b/, { timeout: 10000 });
  }
}

/**
 * Close an open Material menu and wait for its overlay to tear down, so a
 * lingering CDK backdrop can't silently intercept the test's next click.
 */
export async function closeMenuAndWaitForOverlay(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await page.locator('.mat-mdc-menu-panel').waitFor({ state: 'detached', timeout: 5000 });
  await page.locator('.cdk-overlay-backdrop').waitFor({ state: 'detached', timeout: 5000 });
}

/** `?theme=` values the Crucible UIs' `AppComponent` understands. */
const THEME_PARAM: Record<Theme, string> = { light: 'light-theme', dark: 'dark-theme' };

/** A URL for `path` on `baseUrl` that boots straight into `theme` via `?theme=`. */
export function themedUrl(baseUrl: string, path: string, theme: Theme): string {
  const url = new URL(path, baseUrl);
  url.searchParams.set('theme', THEME_PARAM[theme]);
  return url.toString();
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

/**
 * `<baseName> [<project>-w<worker>-r<retry>-<hash>]`, where the hash covers the
 * file and full title path. The title path includes the `light theme ›` /
 * `dark theme ›` describe prefix, so the two theme variants of a spec never share
 * a seeded name.
 */
export function seededName(baseName: string, testInfo: TestInfo): string {
  const seed = createHash('sha1')
    .update(`${testInfo.project.name}:${testInfo.file}:${testInfo.titlePath.join(' > ')}:${testInfo.retry}`)
    .digest('hex')
    .slice(0, 8);
  return `${baseName} [${testInfo.project.name}-w${testInfo.workerIndex}-r${testInfo.retry}-${seed}]`;
}

/** The OIDC access token the page holds in its current origin's browser storage. */
export async function oidcAccessToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => {
    for (const storage of [localStorage, sessionStorage]) {
      for (let i = 0; i < storage.length; i++) {
        try {
          const value = JSON.parse(storage.getItem(storage.key(i)!) ?? '');
          if (typeof value?.access_token === 'string') return value.access_token as string;
        } catch {
          // Non-JSON application state shares browser storage with the OIDC user.
        }
      }
    }
    return null;
  });
  if (!token) throw new Error('Authenticated page did not contain an OIDC access token');
  return token;
}

// ---------------------------------------------------------------------------
// WCAG contrast
// ---------------------------------------------------------------------------

/** WCAG relative luminance for an `rgb(...)` / `rgba(...)` string. */
export function luminance(rgb: string): number {
  const [r, g, b] = rgb
    .match(/\d+(\.\d+)?/g)!
    .slice(0, 3)
    .map((v) => {
      const channel = Number(v) / 255;
      return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
    });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two `rgb()` colours. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export interface Sample {
  color: string;
  surface: string | null;
  fontSizePx: number;
  fontWeight: number;
}

/**
 * Sample the text colour, the first non-transparent painted background behind the
 * element, and the font metrics (so the caller can apply the large-text threshold).
 *
 * Walking up for a painted background matters: many M3 elements compute to a
 * transparent `background-color` and inherit the surface from an ancestor, so
 * comparing text against the element's own background would divide by the wrong
 * colour and report a bogus ratio.
 */
export async function sample(locator: Locator): Promise<Sample> {
  return locator.evaluate((el) => {
    const paintedBackground = (from: Element) => {
      let node: Element | null = from;
      while (node) {
        const bg = getComputedStyle(node).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
        node = node.parentElement;
      }
      return null;
    };
    const style = getComputedStyle(el);
    return {
      color: style.color,
      surface: paintedBackground(el),
      fontSizePx: parseFloat(style.fontSize),
      fontWeight: Number(style.fontWeight) || 400,
    };
  });
}

/** WCAG large-text bar: >= 24px, or >= 18.66px when bold. */
export function requiredRatio(s: Sample): number {
  const isLarge = s.fontSizePx >= 24 || (s.fontSizePx >= 18.66 && s.fontWeight >= 700);
  return isLarge ? 3 : 4.5;
}

/**
 * Assert the element's text meets WCAG 1.4.3 against its painted background and
 * return the measured ratio. `soft` records a failure without stopping the test.
 */
export async function assertReadable(locator: Locator, label: string, soft = false): Promise<number> {
  const s = await sample(locator);
  expect(s.surface, `${label}: could not find a painted background to measure against`).not.toBeNull();
  const ratio = contrastRatio(s.color, s.surface!);
  const min = requiredRatio(s);
  (soft ? expect.soft : expect)(
    ratio,
    `${label}: contrast ${ratio.toFixed(2)}:1 (${s.color} on ${s.surface}, ` +
      `${s.fontSizePx}px/${s.fontWeight}) must be >= ${min}:1 (WCAG 1.4.3)`
  ).toBeGreaterThanOrEqual(min);
  return ratio;
}

// ---------------------------------------------------------------------------
// Colors design-spec contract
// ---------------------------------------------------------------------------

/** The six color keys defined by the colors design spec (§4). */
export interface ColorSettings {
  AppTopBarHexColor?: string;
  AppTopBarHexTextColor?: string;
  AppLightModePrimaryHexColor?: string;
  AppLightModePrimaryHexTextColor?: string;
  AppDarkModePrimaryHexColor?: string;
  AppDarkModePrimaryHexTextColor?: string;
}

/**
 * The effective settings, layered the way `ComnSettingsService` layers them:
 * `settings.json`, then `settings.shared.json`, then `settings.env.json`, each
 * deep-merged over the last. A missing overlay is skipped. Fetched from the
 * page's current origin so the result reflects what that app actually serves.
 */
export async function effectiveColorSettings(page: Page): Promise<ColorSettings> {
  return page.evaluate(async () => {
    const isObject = (v: unknown): v is Record<string, unknown> =>
      !!v && typeof v === 'object' && !Array.isArray(v);
    const deepMerge = (target: Record<string, unknown>, source: Record<string, unknown>) => {
      const result: Record<string, unknown> = { ...target, ...source };
      for (const key of Object.keys(source)) {
        if (isObject(source[key]) && isObject(target[key])) {
          result[key] = deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
        }
      }
      return result;
    };
    let merged: Record<string, unknown> = {};
    for (const file of ['settings.json', 'settings.shared.json', 'settings.env.json']) {
      const res = await fetch(`/assets/config/${file}`, { cache: 'no-store' });
      if (!res.ok) continue;
      const body = await res.json().catch(() => null);
      if (isObject(body)) merged = deepMerge(merged, body);
    }
    return merged;
  });
}

/** Read a CSS custom property as set on `<body>`, trimmed and uppercased for comparison. */
export async function cssVar(page: Page, name: string): Promise<string> {
  return page.evaluate(
    (n) => getComputedStyle(document.body).getPropertyValue(n).trim().toUpperCase(),
    name
  );
}

/** `#rrggbb` → `rgb(r, g, b)`, matching how computed styles serialize colors. */
export function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}
