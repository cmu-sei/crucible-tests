// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/moodle-test-plan.md

import { Page } from '@playwright/test';
import { test, expect, Services } from '../fixtures';
import { MoodleLabModule, resolveMoodleLabActivityCmid } from '../db-helpers';
import {
  DemoUserEnrolment,
  enrolMoodleDemoUser,
  resolveMoodleDemoUserId,
  unenrolMoodleDemoUser,
} from '../demo-user-helpers';

type Plugin = {
  name: 'Crucible' | 'TopoMojo';
  bodyId: RegExp;
  prefix: MoodleLabModule;
  manageUrlPattern: RegExp;
};

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
  const enrolments: DemoUserEnrolment[] = [];

  test.beforeAll(async () => {
    demoUserId = resolveMoodleDemoUserId();
    for (const plugin of plugins) {
      const cmid = await resolveMoodleLabActivityCmid(plugin.prefix);
      enrolments.push(enrolMoodleDemoUser(plugin.prefix, cmid, demoUserId));
    }
  });

  test.afterAll(async () => {
    // Only the enrolments this run created, and only once per course: both
    // activities normally live in the same demo course.
    const undone = new Set<number>();
    for (const enrolment of enrolments) {
      if (enrolment.created && !undone.has(enrolment.courseId)) {
        undone.add(enrolment.courseId);
        unenrolMoodleDemoUser(enrolment, demoUserId);
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
