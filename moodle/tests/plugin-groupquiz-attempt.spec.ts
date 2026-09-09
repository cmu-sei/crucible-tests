// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/moodle-test-plan.md

import { Browser, Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import {
  addGroupQuiz,
  addQuestionToQuiz,
  addUserToGroup,
  createLocalUser,
  createTrueFalseQuestion,
  deleteCourse,
  deleteLocalUser,
  enrolAsStudent,
  gotoMoodle,
  loginWithLocalAccount,
  seedCourseWithGrouping,
  seedSuffix,
  selectOptionContaining,
  SeededGrouping,
  URL_WAIT,
} from '../groupquiz-helpers';

// Student-side mod_groupquiz: group gating, and the collaborative attempt
// (start -> answer -> save -> resume -> submit -> review).
//
// The attempt has to run as a real enrolled student in a real group, so each test
// seeds a course with a group and grouping, a Group Quiz with one True/False
// question, and a manual-auth student account. The student drives a separate browser
// context so the admin session stays intact for teardown.
test.describe('mod_groupquiz group attempt', () => {
  const password = 'Cruc1ble!Test';
  let seed: SeededGrouping | null = null;
  let cmid = '';
  let studentId = '';
  let studentUsername = '';
  let studentFullName = '';

  test.beforeEach(async ({ moodleAdminPage: page }) => {
    const suffix = seedSuffix();
    seed = await seedCourseWithGrouping(page, suffix);
    cmid = await addGroupQuiz(page, {
      courseId: seed.course.id,
      name: `GQ Quiz ${suffix}`,
      groupingName: seed.groupingName,
    });
    const questionName = `GQ TF ${suffix}`;
    await createTrueFalseQuestion(page, cmid, questionName, 'The sky is blue.');
    await addQuestionToQuiz(page, cmid, questionName, '1.00');

    studentUsername = `gqstudent${suffix.toLowerCase()}`;
    studentFullName = `GQ Student ${suffix}`;
    await createLocalUser(page, {
      username: studentUsername,
      password,
      firstName: 'GQ',
      lastName: `Student ${suffix}`,
    });
    // The enrolment and group selectors label options by full name, so that is the
    // fragment every membership lookup matches on.
    studentId = await enrolAsStudent(page, seed.course.id, studentFullName);
  });

  test.afterEach(async ({ moodleAdminPage: page }) => {
    if (seed) {
      await deleteCourse(page, seed.course.id);
      seed = null;
    }
    if (studentId) {
      await deleteLocalUser(page, studentId);
      studentId = '';
    }
  });

  /** Log the seeded student in inside their own context and return their page. */
  async function openStudentPage(browser: Browser): Promise<Page> {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    await loginWithLocalAccount(page, studentUsername, password);
    return page;
  }

  test('a student who is not in the grouping cannot attempt the quiz', async ({ browser }) => {
    const studentPage = await openStudentPage(browser);
    try {
      await gotoMoodle(studentPage, `/mod/groupquiz/view.php?id=${cmid}`);
      await expect(studentPage.locator('#region-main')).toContainText(
        'You must be assigned to a group to access this quiz.'
      );
      await expect(
        studentPage.locator('#region-main').getByRole('button', { name: 'Start', exact: true })
      ).toHaveCount(0);
    } finally {
      await studentPage.context().close();
    }
  });

  test('a student in the grouping starts, saves, resumes and submits the attempt', async ({
    moodleAdminPage: adminPage,
    browser,
  }) => {
    const seeded = seed as SeededGrouping;
    await addUserToGroup(adminPage, seeded.groupId, studentFullName);

    const studentPage = await openStudentPage(browser);
    try {
      const main = studentPage.locator('#region-main');

      // Group membership replaces the block with the invitation to start.
      await gotoMoodle(studentPage, `/mod/groupquiz/view.php?id=${cmid}`);
      await expect(studentPage.locator('#quizstartinst')).toContainText(
        "Press Start to begin your group's quiz attempt."
      );
      // Students hold only mod/groupquiz:attempt, so the activity renders no tab bar
      // (Moodle's own secondary navigation is a separate .nav-tabs list outside it).
      await expect(studentPage.locator('#region-main ul.nav-tabs a.nav-link')).toHaveCount(0);

      await main.getByRole('button', { name: 'Start', exact: true }).click();
      await studentPage.waitForURL(/action=startquiz/, URL_WAIT);

      // The attempt UI is built by JS from quizdata.php.
      const question = studentPage.locator('#q1_container');
      await question.waitFor({ state: 'visible', timeout: 60000 });
      await expect(question).toContainText('The sky is blue.');
      await expect(studentPage.locator('#q1_usertitle')).toContainText('Last Response:');

      // Answering and saving records the response against the group, attributed to
      // whichever member saved it.
      await question.locator('input[type="radio"]').first().check();
      await studentPage.locator('#q1_save').click();
      await expect(studentPage.locator('#q1_username')).toContainText(studentFullName);

      // Leaving mid-attempt offers to rejoin the group's open attempt.
      await gotoMoodle(studentPage, `/mod/groupquiz/view.php?id=${cmid}`);
      await expect(studentPage.locator('#quizstartinst')).toContainText(
        "Press Continue to join your group's active quiz attempt."
      );
      await main.getByRole('button', { name: 'Continue', exact: true }).click();
      await studentPage.waitForURL(/action=continuequiz/, URL_WAIT);
      await studentPage.locator('#q1_container').waitFor({ state: 'visible', timeout: 60000 });
      await expect(studentPage.locator('#q1_username')).toContainText(studentFullName);

      // Submitting closes the attempt and shows the graded review.
      await main.getByRole('button', { name: 'Submit Quiz' }).click();
      await studentPage.waitForURL(/\/mod\/groupquiz\/viewquizattempt\.php/, URL_WAIT);
      await expect(studentPage.locator('body')).toHaveAttribute(
        'id',
        /page-mod-groupquiz-viewquizattempt/
      );
      await expect(main).toContainText('Overall Grade: 100.00');
      await expect(main).toContainText('Correct');
      await expect(main).toContainText('Mark 1.00 out of 1.00');
      await expect(main).toContainText("The correct answer is 'True'.");
    } finally {
      await studentPage.context().close();
    }

    // The instructor's overview report now lists the group's submitted attempt.
    await gotoMoodle(adminPage, `/mod/groupquiz/reports.php?id=${cmid}`);
    await selectOptionContaining(adminPage.locator('#region-main select').first(), 'Overview Report');
    await expect(adminPage.locator('#region-main')).toContainText(seeded.groupName);
  });
});
