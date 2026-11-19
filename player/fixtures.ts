// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test as base, Page, Locator, TestInfo, WorkerInfo } from '@playwright/test';
import {
  Services,
  serviceUrlPattern,
  oidcStorageKey,
  authenticateWithKeycloak,
  waitForFirstVisible,
  ensureAuthenticatedShell,
} from '../shared-fixtures';
import { authStatePath } from '../auth-paths';
import { freshAuthStatePath } from '../auth-state';
import {
  THEMES,
  Theme,
  isDarkTheme,
  expectBodyTheme,
  closeMenuAndWaitForOverlay,
  seededName,
  themedUrl,
} from '../theme-helpers';
import {
  addUserToTeam,
  createTeam,
  createView,
  deleteView,
  getPlayerToken,
  getViewTeams,
  listViews,
  tokenUserId,
} from '../player-helpers';

export async function authenticatePlayerWithKeycloak(
  page: Page,
  username: string = 'admin',
  password: string = 'admin'
): Promise<void> {
  await authenticateWithKeycloak(page, Services.Player.UI, username, password);
}

/** A view seeded through the Player API, as the specs need to find it in the UI. */
export interface SeededPlayerView {
  id: string;
  name: string;
}

/**
 * The views every Player worker shares (see the `seededViews` fixture):
 *
 * - `primary` (`Project Lagoon TTX - Admin [w<n>]`) has the "Admin" team the API
 *   creates plus a second team, "Exercise Control" (`teamId`), with the signed-in
 *   admin in both, so the team selector has something to switch to;
 * - `secondary` (`Steamfitter View [w<n>]`) is a bare view, so list specs have a
 *   second name to search for and sort against.
 *
 * Read-only for every consumer. A test that edits, deletes, posts into, or
 * re-points the user's primary team on a view takes `freshView` instead.
 */
export interface PlayerSeededViews {
  primary: SeededPlayerView;
  secondary: SeededPlayerView;
  teamId: string;
}

/** A per-test copy of the primary view's shape, for tests that change it. */
export interface PlayerFreshView extends SeededPlayerView {
  /** The "Exercise Control" team (the Admin team is the user's primary). */
  teamId: string;
}

export type PlayerFixtures = {
  playerAuthenticatedPage: Page;
  freshView: PlayerFreshView;
};

export type PlayerWorkerFixtures = {
  seededViews: PlayerSeededViews;
};

const primaryViewBaseName = 'Project Lagoon TTX - Admin';
const steamfitterViewBaseName = 'Steamfitter View';

/**
 * Name prefixes of every view the Player suite creates: the fixtures' views
 * (`<base> [<suffix>]`), the admin create/delete specs' `<prefix><timestamp>`, and
 * Steamfitter's shared worker view (also purged by Steamfitter's own teardown).
 * {@link purgeAllPlayerTestData} deletes anything left under them.
 */
const PLAYER_TEST_VIEW_PREFIXES = [
  `${primaryViewBaseName} [`,
  `${steamfitterViewBaseName} [`,
  'Create Test View ',
  'Delete Test View ',
  // Steamfitter's worker-scoped `steamfitterPlayerView` (steamfitter/fixtures.ts).
  'E2E Shared Player View [',
];

/**
 * Global-teardown safety net: delete every view whose name starts with one of
 * {@link PLAYER_TEST_VIEW_PREFIXES}, i.e. whatever a worker or test that died
 * before its own teardown left behind. Runs after the whole run, when no Player
 * worker is alive to still be using one.
 */
export async function purgeAllPlayerTestData(): Promise<void> {
  const token = await getPlayerToken();
  const leftovers = (await listViews(token)).filter((view) =>
    PLAYER_TEST_VIEW_PREFIXES.some((prefix) => view.name.startsWith(prefix))
  );
  for (const view of leftovers) await deleteView(token, view.id);
  if (leftovers.length > 0) {
    console.log(
      `[global-teardown] Player: purged ${leftovers.length} leftover test view(s): ` +
        leftovers.map((view) => view.name).join(', ')
    );
  }
}

export async function typeIntoSearch(searchField: Locator, value: string): Promise<void> {
  await searchField.click();
  await searchField.press('Control+A');
  await searchField.press('Delete');
  if (value.length > 0) {
    await searchField.pressSequentially(value);
  }
}

export async function dismissTransientOverlays(page: Page): Promise<void> {
  await page.mouse.move(0, 0).catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});

  const backdrop = page.locator('.cdk-overlay-backdrop');
  await backdrop.first().waitFor({ state: 'hidden', timeout: 1000 }).catch(() => {});

  const tooltip = page.locator('mat-tooltip-component');
  await tooltip.first().waitFor({ state: 'hidden', timeout: 1000 }).catch(() => {});
}

export async function clickWithoutOverlayInterference(page: Page, locator: Locator): Promise<void> {
  await dismissTransientOverlays(page);
  try {
    await locator.click({ timeout: 1500 });
  } catch {
    await dismissTransientOverlays(page);
    await locator.click({ force: true });
  }
}

export async function findPlayerHomeViewLink(page: Page, viewName: string): Promise<Locator> {
  const searchField = page.getByRole('textbox', { name: 'Search' });
  await typeIntoSearch(searchField, viewName);

  const viewLink = page.getByRole('link', { name: viewName, exact: true });
  await viewLink.waitFor({ state: 'visible', timeout: 10000 });
  return viewLink;
}

export async function findAdminViewButton(page: Page, viewName: string): Promise<Locator> {
  const searchField = page.getByRole('textbox', { name: 'Search' });
  const searchableName = viewName.replace(/ \[[^\]]+\]$/, '');
  await typeIntoSearch(searchField, searchableName);

  const viewButton = page.getByRole('button', { name: viewName, exact: true });
  await viewButton.waitFor({ state: 'visible', timeout: 10000 });
  return viewButton;
}

/**
 * Create a view shaped like the primary seeded view: the "Admin" team the API
 * creates (the caller's primary team) plus an "Exercise Control" team with the
 * caller in it. The token is the seeding token from `getPlayerToken()`, issued to
 * the same `admin` Keycloak user the browser signs in as, so the view is on that
 * user's "My Views" list; `tokenUserId` names that user without a `GET /api/users`
 * scan. Deletes the view again if any later step fails, so a broken seed leaks
 * nothing.
 */
async function createPrimaryShapedView(token: string, name: string): Promise<PlayerFreshView> {
  const view = await createView(token, name, `E2E fixture data for ${name}`);
  try {
    if (!(await getViewTeams(token, view.id))[0]) {
      throw new Error(`Player fixture view ${view.id} did not create an Admin team`);
    }
    const extraTeam = await createTeam(token, view.id, 'Exercise Control');
    await addUserToTeam(token, extraTeam.id, tokenUserId(token));
    return { id: view.id, name: view.name, teamId: extraTeam.id };
  } catch (error) {
    await deleteView(token, view.id);
    throw error;
  }
}

/**
 * Delete views left under exactly `name` by an earlier run that died before its
 * teardown. Names are not unique in Player, and a second row with the same name
 * would make every exact-name lookup in the specs ambiguous.
 */
async function deleteLeftoverViews(token: string, names: string[]): Promise<void> {
  for (const view of await listViews(token)) {
    if (names.includes(view.name)) await deleteView(token, view.id);
  }
}

async function seedWorkerViews(token: string, workerInfo: WorkerInfo): Promise<{
  views: PlayerSeededViews;
  cleanup: (token: string) => Promise<void>;
}> {
  const primaryName = seededName(primaryViewBaseName, workerInfo);
  const secondaryName = seededName(steamfitterViewBaseName, workerInfo);
  await deleteLeftoverViews(token, [primaryName, secondaryName]);

  const primary = await createPrimaryShapedView(token, primaryName);
  try {
    const secondary = await createView(token, secondaryName, `E2E fixture data for ${secondaryName}`);
    return {
      views: {
        primary: { id: primary.id, name: primary.name },
        secondary: { id: secondary.id, name: secondary.name },
        teamId: primary.teamId,
      },
      cleanup: async (teardownToken: string) => {
        await deleteView(teardownToken, secondary.id);
        await deleteView(teardownToken, primary.id);
      },
    };
  } catch (error) {
    await deleteView(token, primary.id);
    throw error;
  }
}

/** `Project Lagoon TTX - Admin [w<n>-<test>]`: unique per test, repeat and retry. */
function freshViewName(testInfo: TestInfo): string {
  return `${primaryViewBaseName} [w${testInfo.workerIndex}-${testInfo.testId.slice(0, 8)}` +
    `-e${testInfo.repeatEachIndex}-r${testInfo.retry}]`;
}

const appShellLocator = (page: Page) => page.getByRole('button', { name: 'Menu' });

export const test = base.extend<PlayerFixtures, PlayerWorkerFixtures>({
  // Reuse the authenticated state captured by global-setup, refreshed when its token
  // is near expiry. Authentication specs opt out with an empty storageState and
  // retain the interactive login flow.
  storageState: async ({ browser }, use) => use(await freshAuthStatePath('player', browser)),

  // Seeded once per worker and shared by every test it runs (read-only; mutators
  // take `freshView`). The worker's own teardown deletes them; global-teardown
  // purges the prefixes if a worker died first.
  seededViews: [
    async ({}, use, workerInfo) => {
      const { views, cleanup } = await seedWorkerViews(await getPlayerToken(), workerInfo);
      try {
        await use(views);
      } finally {
        // The worker may outlive the seeding token; getPlayerToken re-issues a stale one.
        await cleanup(await getPlayerToken());
      }
    },
    { scope: 'worker' },
  ],

  // A view of the primary's shape owned by this one test. List it before
  // `playerAuthenticatedPage` in the test's parameters so it exists before the
  // page loads its view list; if it ends up created after the page loaded anyway,
  // the page is reloaded so the list includes it.
  freshView: async ({ page }, use, testInfo) => {
    const token = await getPlayerToken();
    const view = await createPrimaryShapedView(token, freshViewName(testInfo));
    try {
      if (page.url() !== 'about:blank') {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await appShellLocator(page).waitFor({ state: 'visible', timeout: 30000 });
      }
      await use(view);
    } finally {
      await deleteView(await getPlayerToken(), view.id);
    }
  },

  // Depends on `seededViews` so the worker's views exist before the first page load
  // in the worker: Playwright sets fixtures up in parameter order, not worker-first,
  // so a spec taking `{ playerAuthenticatedPage, seededViews }` would otherwise load
  // a "My Views" list that predates them. After the first test in a worker this
  // costs nothing, and specs that never mention the views (admin lists that pick
  // "the first row") still have rows to read.
  playerAuthenticatedPage: async ({ page, storageState, seededViews }, use) => {
    void seededViews;
    // Player's OIDC client keeps its token in sessionStorage, which storageState
    // does not carry, so replay the saved sessionStorage too.
    await ensureAuthenticatedShell(page, {
      app: 'player',
      url: Services.Player.UI,
      shell: appShellLocator(page),
      login: authenticatePlayerWithKeycloak,
      restoreSession: storageState === authStatePath('player'),
      fromSavedState: storageState === authStatePath('player'),
    });
    await use(page);
  },
});

/**
 * Themes every authenticated Player functional spec is parameterized over. Each
 * spec runs once per entry so every screen is exercised in both light and dark mode.
 */
export const PLAYER_THEMES = THEMES;
export type PlayerTheme = Theme;

/** Whether Player is currently rendering the dark theme. */
export async function playerIsDarkTheme(page: Page): Promise<boolean> {
  return isDarkTheme(page);
}

/** Player's Akita persistence key (`persistState({ key: 'akita-player-ui', include: ['auth.ui'] })` in player.ui `src/main.ts`). */
const PLAYER_UI_STORAGE_KEY = 'akita-player-ui';

/** `?theme=` / Akita values for each theme (`Theme` in @cmusei/crucible-common). */
const PLAYER_THEME_VALUE: Record<PlayerTheme, string> = { light: 'light-theme', dark: 'dark-theme' };

/**
 * Put Player in `theme` by writing its persisted preference and reloading, and wait
 * for the shell and `document.body` to show it.
 *
 * Player persists the theme in the `auth.ui` slice of its Akita store, saved to
 * localStorage under 'akita-player-ui'. Captured from player.ui at f3a426f
 * (@cmusei/crucible-common 0.8.0) by toggling the menu switch and reading the key:
 * `{"$cache":{"auth":false},"auth":{"theme":"dark-theme"}}` — the `auth.ui` path is
 * stored flattened as `auth`. The preference never reaches the server, and the saved
 * auth state carries no Akita store, so every test's fresh browser context starts
 * light. A theme set here survives the reloads and `page.goto` calls a test makes
 * afterward, so it only needs applying once, right after authentication.
 *
 * Use this rather than the `?theme=dark-theme` query param: once the param has been
 * seen, `AppComponent` writes it back onto the URL on every later theme change,
 * which would leak it into the URL assertions several specs make. Specs whose
 * subject is the menu switch itself use {@link togglePlayerThemeViaMenu}.
 *
 * No-ops when the requested theme is already active, so callers can use it to
 * restore state unconditionally.
 */
export async function setPlayerTheme(page: Page, theme: PlayerTheme): Promise<void> {
  if ((await playerIsDarkTheme(page)) === (theme === 'dark')) return;

  await page.evaluate(
    ([key, value]) => {
      let stored: Record<string, unknown> = {};
      try {
        stored = JSON.parse(localStorage.getItem(key) ?? '{}') ?? {};
      } catch {
        // An unreadable value is replaced; Akita would discard it too.
      }
      const auth = (stored.auth && typeof stored.auth === 'object' ? stored.auth : {}) as Record<string, unknown>;
      localStorage.setItem(key, JSON.stringify({ ...stored, auth: { ...auth, theme: value } }));
    },
    [PLAYER_UI_STORAGE_KEY, PLAYER_THEME_VALUE[theme]] as const
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await appShellLocator(page).waitFor({ state: 'visible', timeout: 30000 });
  await expectBodyTheme(page, theme);
}

/**
 * Switch Player's theme through the top bar user menu's "Dark Theme" switch and
 * wait for the change to land on `document.body` — for specs whose subject is that
 * switch. With `theme`, no-ops when it is already active; without, flips to the
 * other theme. Everything else uses {@link setPlayerTheme}.
 */
export async function togglePlayerThemeViaMenu(page: Page, theme?: PlayerTheme): Promise<void> {
  const wasDark = await playerIsDarkTheme(page);
  const target: PlayerTheme = theme ?? (wasDark ? 'light' : 'dark');
  if (wasDark === (target === 'dark')) return;

  // The user menu is the top bar's name button, labelled "Menu".
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const toggle = page.getByRole('switch', { name: 'Dark Theme' });
  await toggle.waitFor({ state: 'visible', timeout: 10000 });
  await toggle.click();
  await closeMenuAndWaitForOverlay(page);

  await expectBodyTheme(page, target);
}

/**
 * A Player URL for `path` that requests `theme` through the `?theme=` boot param.
 *
 * Only for a spec that starts *unauthenticated* (the authentication specs, and
 * the deep-link spec): there is no user menu before login, so the entry URL is
 * the only theme input such a visitor has. Whether the request survives the
 * Keycloak round trip is up to the auth guard, so a spec that gets back into
 * Player still calls {@link setPlayerTheme} afterwards (a no-op when the param
 * already took). A spec that never leaves Keycloak's own screens is carrying the
 * param only to show the redirect and the login page behave the same either way.
 *
 * Authenticated specs use {@link setPlayerTheme} instead, for the reason given
 * there.
 */
export function playerUrl(path: string, theme: PlayerTheme): string {
  return themedUrl(Services.Player.UI, path, theme);
}

export { expect } from '@playwright/test';
export { Services, serviceUrlPattern, oidcStorageKey, waitForFirstVisible, expectBodyTheme };
