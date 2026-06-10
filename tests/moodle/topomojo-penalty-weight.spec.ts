// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { test, expect } from '@playwright/test';
import { Services } from '../../shared-fixtures';

/**
 * TopoMojo penalty / weight / question-behaviour verification.
 *
 * These tests reproduce the manual Playwright verification performed on
 * 2026-06-09 against a live stack. They are kept `.skip()` because they
 * require environment state that this repo does not provision:
 *
 *   1. A LIVE GAMESPACE. mojomatch grades by pulling the correct answer from
 *      the deployed gamespace's cloned challenge (get_rightanswer_topomojo),
 *      so every attempt deploys real VMs on the hypervisor (~1 min, and can
 *      fail for infra reasons unrelated to grading). There is no preview path.
 *
 *   2. SEEDED ACTIVITY STATE. The grading behaviour depends on the activity's
 *      `preferredbehaviour` and `submissions` settings, and a question
 *      `penalty > 0`. The manual run seeded penalty 0.1 (matching the real
 *      challenge) and switched `preferredbehaviour` per test via SQL. A CI
 *      run needs an activity pre-configured per mode, or admin setup steps.
 *
 * To enable: provision a course with one TopoMojo activity per behaviour mode
 * (interactive+submissions>=3, immediatefeedback, deferredfeedback), all on a
 * workspace whose challenge defines penalty 0.1 and STATIC answers (no ##transforms##),
 * then remove `.skip` and set ACTIVITY_IDS / answers below.
 *
 * Reference workspace used for manual verification:
 *   11d9f0cb5ad64e27982a181e116f48b8  "Moodle Test Workspace - Variants"
 *   Variant 2 answers: Q1=cp, Q2=mv, Q3=test ; weight 1, penalty 0.1
 *
 * See /workspaces/crucible-development/TODO/topomojo-penalty-weight-verification.md
 */

test.describe('TopoMojo penalty / weight / behaviour', () => {

  // Course-module IDs of activities pre-configured per behaviour mode.
  // Fill these in once the seeded activities exist.
  const ACTIVITY_IDS = {
    interactive: 0,        // preferredbehaviour=interactive, submissions>=3
    immediatefeedback: 0,  // preferredbehaviour=immediatefeedback
    deferredfeedback: 0,   // preferredbehaviour=deferredfeedback
  };

  // Variant-2 answers for the reference workspace.
  const ANSWERS = { q1: 'cp', q2: 'mv', q3: 'test' };
  const WRONG = 'zz';

  /**
   * Moodle login via the Keycloak OAuth button on Moodle's own login page.
   * Moodle home → "Log in" link → "Crucible Keycloak" image → Keycloak form
   * → redirect back to /my/. Verified working during manual testing.
   */
  async function loginToMoodle(page) {
    await page.goto(Services.Moodle);
    await page.getByRole('link', { name: 'Log in' }).click();
    await page.click('img[alt="Crucible Keycloak"]');
    await page.waitForSelector('input[name="username"]', { timeout: 30000 });
    await page.fill('input[name="username"]', 'admin');
    await page.fill('input[name="password"]', 'admin');
    await page.click('button:has-text("Sign In"), input[type="submit"]');
    await expect(page).toHaveURL(/\/my\//, { timeout: 30000 });
  }

  /**
   * Launch the lab for an activity and open its challenge page.
   * Deploys a gamespace - slow. Returns once the first question is visible.
   */
  async function launchAndOpenChallenge(page, cmid: number) {
    await page.goto(`${Services.Moodle}/mod/topomojo/view.php?id=${cmid}`);
    await page.getByRole('button', { name: 'Launch Lab' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    // Gamespace deployment - wait for the lab timer / End Lab to appear.
    await expect(page.getByRole('button', { name: 'End Lab' })).toBeVisible({ timeout: 180000 });
    await page.goto(`${Services.Moodle}/mod/topomojo/challenge.php?id=${cmid}`);
    await expect(page.getByRole('heading', { name: 'Question 1' })).toBeVisible({ timeout: 30000 });
  }

  // A question block, located by its "Question N" heading's container.
  function question(page, n: number) {
    return page.locator('.que', { has: page.getByRole('heading', { name: `Question ${n}`, exact: true }) });
  }

  test.skip('interactive: cumulative penalty, correct-after-wrong scores 1 - penalty*tries', async ({ page }) => {
    await loginToMoodle(page);
    await launchAndOpenChallenge(page, ACTIVITY_IDS.interactive);

    const q1 = question(page, 1);
    const answer = q1.getByRole('textbox', { name: /Answer/ });
    const check = q1.getByRole('button', { name: /Check Question 1/ });

    // Try 1: wrong -> 0.00, one try consumed, still active.
    await answer.fill(WRONG);
    await check.click();
    await expect(q1).toContainText('Mark 0.00 out of 1.00');
    await expect(q1).toContainText('Tries remaining: 2');

    // Try 2: wrong again -> still 0.00, another try consumed.
    await answer.fill(WRONG + 'z');
    await check.click();
    await expect(q1).toContainText('Mark 0.00 out of 1.00');
    await expect(q1).toContainText('Tries remaining: 1');

    // Try 3: correct after 2 wrong -> 1 - 0.1*2 = 0.80, marked Correct.
    await answer.fill(ANSWERS.q1);
    await check.click();
    await expect(q1).toContainText('Mark 0.80 out of 1.00');
    await expect(q1).toContainText('Correct');

    // Cumulative live score box reflects the penalized total.
    await expect(page.getByRole('heading', { name: 'Current Score' })).toBeVisible();
    await expect(page.locator('body')).toContainText('0.8 out of 3');
  });

  test.skip('interactive: correct on first try scores full marks (no spurious penalty)', async ({ page }) => {
    await loginToMoodle(page);
    await launchAndOpenChallenge(page, ACTIVITY_IDS.interactive);

    const q2 = question(page, 2);
    await q2.getByRole('textbox', { name: /Answer/ }).fill(ANSWERS.q2);
    await q2.getByRole('button', { name: /Check Question 2/ }).click();
    await expect(q2).toContainText('Mark 1.00 out of 1.00');
    await expect(q2).toContainText('Correct');
  });

  test.skip('immediate feedback: single try, wrong answer finishes with no penalty/retry', async ({ page }) => {
    await loginToMoodle(page);
    await launchAndOpenChallenge(page, ACTIVITY_IDS.immediatefeedback);

    const q1 = question(page, 1);
    await q1.getByRole('textbox', { name: /Answer/ }).fill(WRONG);
    await q1.getByRole('button', { name: /Check Question 1/ }).click();

    // Graded once, marked Incorrect, no retry: the Check button is gone and
    // there is no "Tries remaining" counter.
    await expect(q1).toContainText('Mark 0.00 out of 1.00');
    await expect(q1).toContainText('Incorrect');
    await expect(q1).not.toContainText('Tries remaining');
    await expect(q1.getByRole('button', { name: /Check Question 1/ })).toHaveCount(0);
  });

  test.skip('deferred feedback: no Check buttons; answers saved on Submit Quiz, graded at finish', async ({ page }) => {
    await loginToMoodle(page);
    await launchAndOpenChallenge(page, ACTIVITY_IDS.deferredfeedback);

    // No per-question Check button in deferred mode.
    await expect(page.getByRole('button', { name: /Check Question/ })).toHaveCount(0);

    // Answer all questions, then Submit Quiz (the only save point in deferred mode).
    await question(page, 1).getByRole('textbox', { name: /Answer/ }).fill(ANSWERS.q1);
    await question(page, 2).getByRole('textbox', { name: /Answer/ }).fill(ANSWERS.q2);
    await question(page, 3).getByRole('textbox', { name: /Answer/ }).fill(ANSWERS.q3);
    await page.getByRole('button', { name: 'Submit Quiz' }).click();

    // Review page: each question saved and graded correct, no penalty.
    await expect(page).toHaveURL(/viewattempt\.php/);
    await expect(question(page, 1)).toContainText('Mark 1.00 out of 1.00');
    await expect(question(page, 2)).toContainText('Mark 1.00 out of 1.00');
    await expect(question(page, 3)).toContainText('Mark 1.00 out of 1.00');
  });
});
