// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/moodle-test-plan.md
//
// Guards for the aiplacement_competency classification drawer's user-visible text.
//
// The drawer is built entirely in JavaScript: `amd/src/placement.js` renders the
// framework-selection and level-selection steps and fills in every label, placeholder
// and error message itself. Those messages were originally English literals in the
// module ("Loading…", "Select Competency Framework...", "Failed to load frameworks"),
// and one of the language strings the templates referenced did not exist at all, so it
// rendered as a raw `[[levelsselection_empty]]` placeholder. The strings now come from
// the plugin's language pack via `core/str`.
//
// Every assertion below is on text the drawer renders at runtime, so these tests fail
// if a string regresses to a hardcoded literal, if a key is missing from the language
// file (Moodle renders `[[key]]`), or if `amd/build/*.min.js` is not rebuilt after an
// `amd/src` change — the plugin ships prebuilt AMD bundles and its CI has no build
// step, and Moodle serves `amd/build` whenever `$CFG->cachejs` is on.
//
// The two error paths and the transient loading placeholder are only reachable by
// controlling the `core_competency` web-service responses, so those tests intercept
// the specific AJAX call under test. The AI request itself is never issued: these
// tests stop at the level-selection step, which is the last screen before the model
// is called.

import { Page, Locator } from '@playwright/test';
import { test, expect, Services, authenticateMoodleWithKeycloak } from '../fixtures';

/** Moodle pages are server-rendered and can be slow on a cold cache. */
const NAV = { waitUntil: 'domcontentloaded' as const, timeout: 60000 };
const URL_WAIT = { waitUntil: 'commit' as const, timeout: 60000 };
const ACTION_TIMEOUT = 60000;

/** The two `core_competency` calls the drawer makes, one per step. */
const FRAMEWORKS_CALL = /\/lib\/ajax\/service\.php\?[^\s]*info=core_competency_list_competency_frameworks/;
const COMPETENCIES_CALL = /\/lib\/ajax\/service\.php\?[^\s]*info=core_competency_list_competencies/;

/** Expected text, all of which must come from `lang/en/aiplacement_competency.php` (or core). */
const STRINGS = {
  frameworkHeading: 'Competency Framework Selection',
  frameworkPlaceholder: 'Please choose a framework…',
  frameworkNone: 'No competency frameworks found.',
  frameworkError: 'The competency frameworks could not be loaded.',
  levelsHeading: 'Competency Selection',
  levelsEmpty: 'No competency levels are available for the selected framework.',
  levelsError: 'The competency levels could not be loaded.',
  // core/str 'loading', requested by the drawer instead of its own literal.
  loading: 'Loading',
};

/** Suffix that makes every seeded record name unique to one test run. */
function seedSuffix(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`.toUpperCase();
}

/**
 * Call a Moodle web service from the page's own session.
 *
 * The competency framework/competency services are all `ajax => true` in
 * `lib/db/services.php`, so the seeded records can be created and removed through the
 * same endpoint the UI uses — no web-service token, and no direct database access.
 * The page must already be on a logged-in Moodle page so that `M.cfg` is present.
 */
async function callWebService<T>(
  page: Page,
  methodname: string,
  args: Record<string, unknown>
): Promise<T> {
  const outcome = await page.evaluate(
    async ({ methodname, args }) => {
      const cfg = (window as unknown as { M?: { cfg?: { wwwroot: string; sesskey: string } } }).M?.cfg;
      if (!cfg?.sesskey) {
        return { error: 'M.cfg.sesskey is not available on this page' };
      }
      const response = await fetch(
        `${cfg.wwwroot}/lib/ajax/service.php?sesskey=${cfg.sesskey}&info=${methodname}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([{ index: 0, methodname, args }]),
        }
      );
      const payload = await response.json();
      const first = Array.isArray(payload) ? payload[0] : payload;
      if (!first || first.error) {
        return { error: String(first?.error ?? 'unknown web-service error') };
      }
      return { data: first.data };
    },
    { methodname, args }
  );

  expect(outcome.error, `${methodname} should succeed`).toBeUndefined();
  return outcome.data as T;
}

interface SeededCourse {
  id: string;
  shortName: string;
}

async function createCourse(page: Page, fullName: string, shortName: string): Promise<SeededCourse> {
  await page.goto(`${Services.Moodle}/course/edit.php?category=1`, NAV);
  await page.fill('#id_fullname', fullName);
  await page.fill('#id_shortname', shortName);
  await page.locator('#id_saveanddisplay').click();
  await page.waitForURL(/\/course\/view\.php\?id=\d+/, URL_WAIT);
  const id = new URL(page.url()).searchParams.get('id');
  expect(id, 'saving a new course should redirect to its course page').toBeTruthy();
  return { id: id as string, shortName };
}

async function deleteCourse(page: Page, courseId: string): Promise<void> {
  await page.goto(`${Services.Moodle}/course/delete.php?id=${courseId}`, NAV);
  // Scope to #region-main: the message drawer also renders "Delete" controls.
  const main = page.locator('#region-main');
  await main.getByRole('button', { name: 'Delete', exact: true }).click();
  const proceed = main.getByRole('button', { name: 'Continue', exact: true });
  await proceed.waitFor({ state: 'visible', timeout: 120000 });
  await proceed.click();
  await page.waitForURL(/\/course\/management\.php/, URL_WAIT);
}

/**
 * Fill a Moodle "rich text" field.
 *
 * TinyMCE takes over the plain textarea some time after the form renders, so typing
 * into either surface too early is lost: the textarea gets hidden, and content written
 * into the editor body before initialisation finishes is discarded. Waiting for the
 * editor instance to report itself initialised and then going through its own API
 * (`setContent` + `save`, which writes back to the textarea the form submits) removes
 * both races. A site serving the plain textarea has no editor instance, and falls
 * through to filling the textarea directly.
 */
async function fillEditorField(page: Page, fieldId: string, text: string): Promise<void> {
  type TinyWindow = Window & {
    tinyMCE?: { get(id: string): { initialized?: boolean; setContent(html: string): void; save(): void } | null };
  };

  const editorReady = await page
    .waitForFunction(
      (id) => {
        const editor = (window as TinyWindow).tinyMCE?.get(id);
        return !!(editor && editor.initialized);
      },
      fieldId,
      { timeout: 20000 }
    )
    .then(() => true)
    .catch(() => false);

  if (editorReady) {
    await page.evaluate(
      ({ id, html }) => {
        const editor = (window as TinyWindow).tinyMCE?.get(id);
        editor?.setContent(html);
        editor?.save();
      },
      { id: fieldId, html: `<p>${text}</p>` }
    );
    return;
  }

  await page.locator(`#${fieldId}`).fill(text);
}

/**
 * Add a Page activity carrying a description and body text, and return its cmid.
 *
 * The plugin only injects the Classify button once the activity has content
 * (`utils::has_module_content`), and the drawer reads the description out of the
 * open settings form, so an activity with text in both fields is the cheapest
 * scaffolding that reaches the framework-selection step.
 */
async function addPageActivity(page: Page, courseId: string, name: string): Promise<string> {
  await page.goto(`${Services.Moodle}/course/modedit.php?add=page&course=${courseId}&section=1`, NAV);
  await expect(page.locator('#id_name')).toBeVisible();
  await page.fill('#id_name', name);
  await fillEditorField(page, 'id_introeditor', 'Learners identify phishing emails and review command-line activity.');
  await fillEditorField(page, 'id_page', 'Phishing indicators, log review and basic host triage.');
  await page.locator('#id_submitbutton').click();
  await page.waitForURL(/\/mod\/page\/view\.php\?id=\d+/, URL_WAIT);
  const cmid = new URL(page.url()).searchParams.get('id');
  expect(cmid, 'saving the activity should redirect to its view page').toBeTruthy();
  return cmid as string;
}

interface SeededFramework {
  id: number;
  shortname: string;
}

/**
 * Create a system-context competency framework on the default competence scale.
 *
 * `scaleconfiguration` is required and has to name the scale plus its default and
 * proficient items, which is what the framework editing form builds behind its
 * "Configure scales" control.
 */
async function createFramework(page: Page, shortname: string, idnumber: string): Promise<SeededFramework> {
  const framework = await callWebService<{ id: number }>(page, 'core_competency_create_competency_framework', {
    competencyframework: {
      shortname,
      idnumber,
      description: '',
      descriptionformat: 1,
      visible: true,
      scaleid: 2,
      scaleconfiguration:
        '[{"scaleid":"2"},{"id":1,"scaledefault":1,"proficient":0},{"id":2,"scaledefault":0,"proficient":1}]',
      contextid: 1,
      taxonomies: 'competency',
    },
  });
  return { id: framework.id, shortname };
}

/** Deleting the framework removes its competencies too. */
async function deleteFramework(page: Page, frameworkId: number): Promise<void> {
  await callWebService(page, 'core_competency_delete_competency_framework', { id: frameworkId });
}

async function createTopLevelCompetency(
  page: Page,
  frameworkId: number,
  shortname: string,
  idnumber: string
): Promise<void> {
  await callWebService(page, 'core_competency_create_competency', {
    competency: {
      shortname,
      idnumber,
      description: '',
      descriptionformat: 1,
      competencyframeworkid: frameworkId,
      parentid: 0,
    },
  });
}

/**
 * Open the activity settings form and click Classify, returning the drawer body.
 *
 * `classify_button.js` injects the button into `#id_competenciessectioncontainer`,
 * which the settings form renders collapsed, so the section has to be expanded before
 * the button can be clicked.
 */
async function openClassifyDrawer(page: Page, cmid: string): Promise<Locator> {
  await page.goto(`${Services.Moodle}/course/modedit.php?update=${cmid}`, NAV);

  // The button existing proves the plugin's AMD module has run, which also means the
  // theme's collapse handler is loaded — clicking the section header before that is
  // bound silently does nothing.
  const classify = page.locator('[data-action="classify"]');
  await classify.waitFor({ state: 'attached', timeout: ACTION_TIMEOUT });

  const container = page.locator('#id_competenciessectioncontainer');
  const expandCompetencies = page.locator('a[href="#id_competenciessectioncontainer"]');
  if (!(await container.isVisible())) {
    await expandCompetencies.click();
  }
  await expect(container, 'the Competencies section should expand').toBeVisible({ timeout: 30000 });

  await classify.click();

  return page.locator('#ai-classify-drawer .ai-drawer-body');
}

/** A Moodle AJAX response body carrying a server-side exception for one call. */
function webServiceFailure(message: string): { status: number; contentType: string; body: string } {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([
      { error: message, exception: { message, errorcode: 'servererror' } },
    ]),
  };
}

/** A successful Moodle AJAX response body for one call. */
function webServiceSuccess(data: unknown): { status: number; contentType: string; body: string } {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ error: false, data }]),
  };
}

test.describe('aiplacement_competency classification drawer text', () => {
  // The course and activity are read-only scaffolding for every test here, so they are
  // seeded once and removed in afterAll. Frameworks are per-test, because what the
  // level step shows depends on the framework's own competencies.
  let scaffoldPage: Page | undefined;
  let course: SeededCourse | undefined;
  let cmid: string;
  const suffix = seedSuffix();

  test.beforeAll(async ({ browser }) => {
    scaffoldPage = await browser.newPage();
    await authenticateMoodleWithKeycloak(scaffoldPage);
    course = await createCourse(scaffoldPage, `AIP Competency E2E ${suffix}`, `AIPCMP${suffix}`);
    cmid = await addPageActivity(scaffoldPage, course.id, `AIP Competency Page ${suffix}`);
  });

  test.afterAll(async () => {
    if (scaffoldPage && course) {
      await deleteCourse(scaffoldPage, course.id);
    }
    await scaffoldPage?.close();
  });

  test('framework step renders language-pack text and lists the seeded framework', async ({
    moodleAdminPage: page,
  }) => {
    await page.goto(`${Services.Moodle}/my/`, NAV);
    const framework = await createFramework(page, `AIP FW ${suffix}`, `AIPFW${suffix}`);

    try {
      const drawer = await openClassifyDrawer(page, cmid);

      await expect(drawer.getByRole('heading', { name: STRINGS.frameworkHeading })).toBeVisible();

      const select = drawer.locator('#classify-preselect');
      // The template renders this placeholder and the module used to overwrite it with
      // its own English literal while repopulating the select.
      await expect(select.locator('option[value=""]')).toHaveText(STRINGS.frameworkPlaceholder);
      await expect(select.locator('option').filter({ hasText: framework.shortname })).toHaveCount(1);

      // A key that is missing from the language file renders as [[key]]; nothing the
      // drawer shows may look like that.
      await expect(drawer).not.toContainText('[[');
    } finally {
      await deleteFramework(page, framework.id);
    }
  });

  test('framework select shows the core "Loading" string while frameworks are fetched', async ({
    moodleAdminPage: page,
  }) => {
    // Holding the response open is what makes the placeholder observable at all; racing
    // a real fetch would be flaky in both directions.
    let releaseFrameworks: () => void = () => undefined;
    const frameworksHeld = new Promise<void>((resolve) => {
      releaseFrameworks = resolve;
    });
    await page.route(FRAMEWORKS_CALL, async (route) => {
      await frameworksHeld;
      await route.continue();
    });

    const drawer = await openClassifyDrawer(page, cmid);
    const select = drawer.locator('#classify-preselect');
    await expect(select.locator('option')).toHaveText([STRINGS.loading]);

    releaseFrameworks();
    // The held call completing must replace the loading placeholder, otherwise the
    // assertion above could be satisfied by a select that never finished loading.
    await expect(select.locator('option[value=""]')).toHaveText(STRINGS.frameworkPlaceholder);
    await page.unroute(FRAMEWORKS_CALL);
  });

  test('framework select shows the localized empty state when the site has no frameworks', async ({
    moodleAdminPage: page,
  }) => {
    // An empty framework list is faked rather than seeded: emptying the site's real
    // frameworks would destroy data these tests do not own.
    await page.route(FRAMEWORKS_CALL, (route) => route.fulfill(webServiceSuccess([])));

    const drawer = await openClassifyDrawer(page, cmid);
    await expect(drawer.locator('#classify-preselect option')).toHaveText([STRINGS.frameworkNone]);
    await expect(drawer).not.toContainText('[[');
    await page.unroute(FRAMEWORKS_CALL);
  });

  test('framework select shows the localized error when the framework list fails', async ({
    moodleAdminPage: page,
  }) => {
    await page.route(FRAMEWORKS_CALL, (route) =>
      route.fulfill(webServiceFailure('Simulated framework list failure'))
    );

    const drawer = await openClassifyDrawer(page, cmid);
    await expect(drawer.locator('#classify-preselect option')).toHaveText([STRINGS.frameworkError]);
    await page.unroute(FRAMEWORKS_CALL);
  });

  test('level step shows the localized empty state for a framework with no competencies', async ({
    moodleAdminPage: page,
  }) => {
    await page.goto(`${Services.Moodle}/my/`, NAV);
    const framework = await createFramework(page, `AIP FW EMPTY ${suffix}`, `AIPFWE${suffix}`);

    try {
      const drawer = await openClassifyDrawer(page, cmid);
      const select = drawer.locator('#classify-preselect');
      await expect(select.locator('option').filter({ hasText: framework.shortname })).toHaveCount(1);
      await select.selectOption(String(framework.id));

      const continueButton = drawer.getByRole('button', { name: 'Continue' });
      await expect(continueButton).toBeEnabled();
      await continueButton.click();

      await expect(drawer.getByRole('heading', { name: STRINGS.levelsHeading })).toBeVisible();
      // This is the string that was missing from the language file: the level list
      // rendered "[[levelsselection_empty]]" for any framework with no top-level
      // competencies.
      await expect(drawer.getByText(STRINGS.levelsEmpty)).toBeVisible();
      await expect(drawer).not.toContainText('[[');
    } finally {
      await deleteFramework(page, framework.id);
    }
  });

  test('level step lists the framework top-level competencies as selectable levels', async ({
    moodleAdminPage: page,
  }) => {
    await page.goto(`${Services.Moodle}/my/`, NAV);
    const framework = await createFramework(page, `AIP FW LEVELS ${suffix}`, `AIPFWL${suffix}`);

    try {
      await createTopLevelCompetency(page, framework.id, `AIP Level One ${suffix}`, `AIPL1${suffix}`);

      const drawer = await openClassifyDrawer(page, cmid);
      await drawer.locator('#classify-preselect').selectOption(String(framework.id));
      await drawer.getByRole('button', { name: 'Continue' }).click();

      await expect(drawer.getByRole('heading', { name: STRINGS.levelsHeading })).toBeVisible();
      const levels = drawer.locator('input[name="classify-levels"]');
      await expect(levels).toHaveCount(1);
      await expect(drawer.locator('.form-check-label')).toContainText(`AIP Level One ${suffix}`);
      await expect(drawer.getByText(STRINGS.levelsEmpty)).toHaveCount(0);
      await expect(drawer).not.toContainText('[[');

      // Selecting a level is what releases the step; stopping here keeps the test off
      // the AI request that the next Continue would issue.
      await levels.first().check();
      await expect(drawer.getByRole('button', { name: 'Continue' })).toBeEnabled();
    } finally {
      await deleteFramework(page, framework.id);
    }
  });

  test('level step keeps its localized error visible after the list fails to load', async ({
    moodleAdminPage: page,
  }) => {
    await page.goto(`${Services.Moodle}/my/`, NAV);
    const framework = await createFramework(page, `AIP FW ERR ${suffix}`, `AIPFWX${suffix}`);

    try {
      // Only the level list is intercepted, so the framework step still works and the
      // failure happens on the step under test.
      await page.route(COMPETENCIES_CALL, (route) =>
        route.fulfill(webServiceFailure('Simulated competency list failure'))
      );

      const drawer = await openClassifyDrawer(page, cmid);
      await drawer.locator('#classify-preselect').selectOption(String(framework.id));
      await drawer.getByRole('button', { name: 'Continue' }).click();

      // showLevels renders the level template twice; the failure message has to survive
      // the second render, which previously discarded it before it could be seen.
      await expect(drawer.locator('.alert-danger')).toHaveText(STRINGS.levelsError);
      await page.unroute(COMPETENCIES_CALL);
    } finally {
      await deleteFramework(page, framework.id);
    }
  });
});
