// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/moodle-test-plan.md

import { Page } from '@playwright/test';
import { test, expect, Services } from '../fixtures';
import { MoodleLabModule, resolveMoodleLabActivityCmid } from '../db-helpers';
import { runMoodlePhp } from '../cli-helpers';

type Plugin = {
  name: 'Crucible' | 'TopoMojo';
  bodyId: RegExp;
  prefix: MoodleLabModule;
  manageUrlPattern: RegExp;
};

/** The learner account, borrowed from Keycloak by the moodleDemoUserPage fixture. */
const demoUsername = process.env.MOODLE_DEMO_USERNAME || 'demo-user';

/** A course the demo user was enrolled in here, so teardown can put it back. */
type Enrolment = { courseId: number; created: boolean };

/**
 * Resolves the Moodle account the demo Keycloak user maps to.
 *
 * The account is created by the identity provider on first login, so it only
 * exists once something has logged in as it. Every environment this suite runs
 * against has, and seeding one here would produce a second account with no
 * Keycloak credentials behind it.
 */
function resolveDemoUserId(): number {
  const output = runMoodlePhp(
    `$user = $DB->get_record_select('user', 'deleted = 0 AND (username = ? OR username LIKE ?)',`
    + ` ['${demoUsername}', '${demoUsername}@%'], 'id', IGNORE_MULTIPLE);`
    + ` echo $user ? $user->id : '';`
  );
  const userId = Number(output);
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error(
      `No Moodle account for the demo Keycloak user "${demoUsername}". `
      + 'It is created on first login, so log in as it once and re-run.'
    );
  }
  return userId;
}

/**
 * Enrols the demo user as a student in the course an activity belongs to.
 *
 * The view page is what is under test, and an unenrolled user never reaches it —
 * Moodle sends them to the enrolment page instead. Enrolment goes through
 * `enrol_try_internal_enrol()` rather than an INSERT so the role assignment that
 * carries the learner capabilities comes with it.
 *
 * Reports whether the enrolment was created here: the demo account is shared, so
 * an enrolment it already had is left alone.
 */
function enrolDemoUser(plugin: Plugin, cmid: number, userId: number): Enrolment {
  const output = runMoodlePhp(
    `require_once($CFG->libdir . '/enrollib.php');`
    + ` $cm = get_coursemodule_from_id('${plugin.prefix}', ${cmid}, 0, false, MUST_EXIST);`
    + ` $context = context_course::instance($cm->course);`
    + ` if (is_enrolled($context, ${userId})) { echo 'already:' . $cm->course; exit; }`
    + ` $role = $DB->get_record('role', ['shortname' => 'student'], '*', MUST_EXIST);`
    + ` enrol_try_internal_enrol($cm->course, ${userId}, $role->id);`
    + ` echo (is_enrolled($context, ${userId}) ? 'enrolled' : 'failed') . ':' . $cm->course;`
  );

  const [state, courseId] = output.trim().split(':');
  if (state === 'failed') {
    throw new Error(`Could not enrol ${demoUsername} in the course holding ${plugin.name} activity ${cmid}.`);
  }
  return { courseId: Number(courseId), created: state === 'enrolled' };
}

/** Reverses `enrolDemoUser`, including the role assignment it made. */
function unenrolDemoUser(enrolment: Enrolment, userId: number): void {
  runMoodlePhp(
    `require_once($CFG->libdir . '/enrollib.php');`
    + ` $manual = enrol_get_plugin('manual');`
    + ` foreach (enrol_get_instances(${enrolment.courseId}, true) as $instance) {`
    + ` if ($instance->enrol === 'manual') { $manual->unenrol_user($instance, ${userId}); } }`
  );
}

const plugins: Plugin[] = [
  {
    name: 'Crucible',
    bodyId: /page-mod-crucible-view/,
    prefix: 'crucible',
    manageUrlPattern: /\/mod\/crucible\/manage_deployments\.php/,
  },
  {
    name: 'TopoMojo',
    bodyId: /page-mod-topomojo-view/,
    prefix: 'topomojo',
    manageUrlPattern: /\/mod\/topomojo\/manage\.php/,
  },
];

async function openActivity(page: Page, plugin: Plugin): Promise<void> {
  const cmid = await resolveMoodleLabActivityCmid(plugin.prefix);
  await page.goto(`${Services.Moodle}/mod/${plugin.prefix}/view.php?id=${cmid}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await expect(page.locator('body')).toHaveAttribute('id', plugin.bodyId);
  await expect(page.locator('.page-header-headings h1').first()).toBeVisible();
}

function activitySection(page: Page, plugin: Plugin, modifier: string) {
  return page.locator(`.${plugin.prefix}-activity-section--${modifier}`);
}

async function expectSharedViewLayout(page: Page, plugin: Plugin): Promise<void> {
  const details = activitySection(page, plugin, 'details');
  await expect(details, `${plugin.name} should render a Lab Details section`).toBeVisible();
  await expect(details.locator(`.${plugin.prefix}-activity-section__header`)).toHaveText('Lab Details');
  await expect(details).toContainText('Scheduled Duration');

  const actions = activitySection(page, plugin, 'actions');
  await expect(actions, `${plugin.name} should render a Lab Actions section`).toBeVisible();
  await expect(actions.locator(`.${plugin.prefix}-activity-section__header`)).toHaveText('Lab Actions');
  await expect(actions.locator('button:visible, input[type="submit"]:visible, a.btn:visible').first()).toBeVisible();

  const openChallenge = page.getByRole('link', { name: /Open Challenge/i });
  if (await openChallenge.count()) {
    await expect(details.getByRole('link', { name: /Open Challenge/i })).toBeVisible();
  }
}

async function expectNoEmptyTopoMojoLabContent(page: Page): Promise<void> {
  const contentSections = page.locator('.topomojo-activity-section--content');
  for (let index = 0; index < await contentSections.count(); index++) {
    const section = contentSections.nth(index);
    const bodyText = (await section.locator('.topomojo-activity-section__body').innerText()).trim();
    expect(bodyText, 'TopoMojo Lab Content sections should not render when empty').not.toBe('');
  }
}

test.describe('Moodle plugin view pages', () => {
  let demoUserId: number;
  const enrolments: Enrolment[] = [];

  test.beforeAll(async () => {
    demoUserId = resolveDemoUserId();
    for (const plugin of plugins) {
      const cmid = await resolveMoodleLabActivityCmid(plugin.prefix);
      enrolments.push(enrolDemoUser(plugin, cmid, demoUserId));
    }
  });

  test.afterAll(async () => {
    // Only the enrolments this run created, and only once per course: both
    // activities normally live in the same demo course.
    const undone = new Set<number>();
    for (const enrolment of enrolments) {
      if (enrolment.created && !undone.has(enrolment.courseId)) {
        undone.add(enrolment.courseId);
        unenrolDemoUser(enrolment, demoUserId);
      }
    }
  });

  test('admin sees standardized lab sections and instructor controls', async ({ moodleAdminPage: page }) => {
    for (const plugin of plugins) {
      await openActivity(page, plugin);
      await expectSharedViewLayout(page, plugin);

      const actions = activitySection(page, plugin, 'actions');
      await expect(actions.locator('a.btn', { hasText: 'Manage Deployments' })).toHaveAttribute(
        'href',
        plugin.manageUrlPattern
      );

      if (plugin.name === 'TopoMojo') {
        await expect(page.getByText('No VMs available for this event. Please contact support.')).toBeHidden();
        await expectNoEmptyTopoMojoLabContent(page);
      }
    }
  });

  test('demo user sees learner controls without instructor-only deployment management', async ({ moodleDemoUserPage: page }) => {
    for (const plugin of plugins) {
      await openActivity(page, plugin);
      await expectSharedViewLayout(page, plugin);

      await expect(activitySection(page, plugin, 'actions').getByRole('link', { name: /Manage Deployments/i })).toHaveCount(0);
      await expect(activitySection(page, plugin, 'actions').getByRole('button', { name: /Manage Deployments/i })).toHaveCount(0);

      if (plugin.name === 'TopoMojo') {
        await expect(page.getByText('No VMs available for this event. Please contact support.')).toBeHidden();
        await expectNoEmptyTopoMojoLabContent(page);
      }
    }
  });
});
