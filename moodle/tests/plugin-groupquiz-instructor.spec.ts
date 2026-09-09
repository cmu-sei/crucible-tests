// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/moodle-test-plan.md

import { test, expect } from '../fixtures';
import {
  addGroupQuiz,
  addQuestionToQuiz,
  createCourse,
  createTrueFalseQuestion,
  deleteCourse,
  gotoMoodle,
  openAddGroupQuizForm,
  seedCourseWithGrouping,
  seedSuffix,
  URL_WAIT,
} from '../groupquiz-helpers';

// Instructor-side mod_groupquiz: the add-activity form, the empty-quiz view, the
// question list built from the embedded question bank, the instructor preview and
// the responses report.
//
// Each test seeds its own course (plus group and grouping, which the activity
// requires) and the afterEach hook deletes every course the test created; deleting
// the course removes its groups, groupings, activity, questions and attempts.
test.describe('mod_groupquiz instructor workflow', () => {
  let seededCourseIds: string[] = [];

  test.beforeEach(() => {
    seededCourseIds = [];
  });

  test.afterEach(async ({ moodleAdminPage: page }) => {
    for (const courseId of seededCourseIds.reverse()) {
      await deleteCourse(page, courseId);
    }
    seededCourseIds = [];
  });

  test('add-activity form asks for a grouping and defaults to a one-hour limit', async ({
    moodleAdminPage: page,
  }) => {
    const seed = await seedCourseWithGrouping(page, seedSuffix());
    seededCourseIds.push(seed.course.id);

    await openAddGroupQuizForm(page, seed.course.id);

    // Section layout of the form.
    const legends = page.locator('#region-main fieldset legend');
    await expect(legends).toContainText([
      'General',
      'Timing',
      'Grade',
      'Group submission settings',
      'Question behaviour',
      'Review options',
    ]);

    // Timing: an enabled one-hour limit, expressed as 1 x 3600 seconds.
    await expect(page.locator('#id_timelimit_enabled')).toBeChecked();
    await expect(page.locator('#id_timelimit_number')).toHaveValue('1');
    await expect(page.locator('#id_timelimit_timeunit')).toHaveValue('3600');

    // Grading: the four attempt-aggregation methods, defaulting to the first attempt.
    const gradeMethod = page.locator('#id_grademethod');
    await expect(gradeMethod).toHaveValue('1');
    await expect(gradeMethod.locator('option')).toHaveText([
      'First attempt',
      'Last completed attempt',
      'Average of all attempts',
      'Highest attempt',
    ]);
    // The activity fixes the maximum grade at 100 rather than exposing a field for it.
    await expect(page.locator('input[name="grade"][type="hidden"]')).toHaveValue('100');

    // Group submission: the grouping list offers the course's groupings only, with
    // no blank entry, so the first grouping is preselected.
    const grouping = page.locator('#id_grouping');
    await expect(grouping.locator('option')).toHaveText([seed.groupingName]);

    // Question behaviour and the review windows this activity supports: group
    // responses are only reviewable while the quiz is open or after it closes.
    // Shuffling is an advanced Yes/No field, so it is collapsed behind "Show more"
    // but still carries its default of No.
    await expect(page.locator('#id_shuffleanswers')).toHaveValue('0');
    await expect(legends).toContainText(['While the quiz is open', 'After the quiz is closed']);
    // The review section is collapsed by default, so assert the state of its
    // checkboxes rather than their visibility: both windows start fully on.
    await expect(page.locator('#id_attemptopen')).toBeChecked();
    await expect(page.locator('#id_attemptclosed')).toBeChecked();
    await expect(page.locator('#id_rightansweropen')).toBeChecked();
    await expect(page.locator('#id_rightanswerclosed')).toBeChecked();
    // The during-attempt and immediately-after windows are not offered by this activity.
    await expect(page.locator('#id_attemptduring')).toHaveCount(0);
    await expect(page.locator('#id_attemptimmediately')).toHaveCount(0);
  });

  test('a course with no grouping cannot save a group quiz', async ({
    moodleAdminPage: page,
  }) => {
    const suffix = seedSuffix();
    const course = await createCourse(page, `GQ No Grouping ${suffix}`, `GQNOGRP${suffix}`);
    seededCourseIds.push(course.id);

    await openAddGroupQuizForm(page, course.id);
    await expect(page.locator('#id_grouping option')).toHaveCount(0);

    await page.fill('#id_name', `GQ Should Not Save ${suffix}`);
    await page.locator('#id_submitbutton').click();

    // The form blocks client-side, so the browser stays on modedit.php. Matched as a
    // substring because the theme's error marker is generated content, which only some
    // browsers report as text.
    await expect(page.locator('#id_error_grouping')).toContainText(
      'You must supply a value here.'
    );
    expect(page.url()).toContain('/course/modedit.php');
  });

  test('a new group quiz reports that it has no questions', async ({
    moodleAdminPage: page,
  }) => {
    const suffix = seedSuffix();
    const seed = await seedCourseWithGrouping(page, suffix);
    seededCourseIds.push(seed.course.id);
    const quizName = `GQ Quiz ${suffix}`;
    const cmid = await addGroupQuiz(page, {
      courseId: seed.course.id,
      name: quizName,
      groupingName: seed.groupingName,
    });

    // Saving the activity lands on its view page.
    await expect(page.locator('body')).toHaveAttribute('id', /page-mod-groupquiz-view/);
    const main = page.locator('#region-main');
    await expect(main).toContainText('There are no questions added to this quiz.');
    await expect(main.getByRole('button', { name: 'Edit quiz', exact: true })).toBeVisible();

    // Instructor navigation: three tabs, one per capability. Scoped to the activity
    // content because Moodle's own secondary navigation is also a .nav-tabs list.
    const tabs = page.locator('#region-main ul.nav-tabs a.nav-link');
    await expect(tabs).toHaveText(['View quiz', 'Edit quiz', 'View responses']);

    // Edit tab: empty question list beside the embedded question bank.
    await gotoMoodle(page, `/mod/groupquiz/edit.php?cmid=${cmid}`);
    await expect(page.locator('body')).toHaveAttribute('id', /page-mod-groupquiz-edit/);
    const questionRow = page.locator('#questionrow');
    await expect(questionRow.getByRole('heading', { name: 'Question List' })).toBeVisible();
    await expect(questionRow).toContainText('No questions have been added yet');
    // The embedded question bank sits beside the list. An empty category renders no
    // question table, so the bank is identified by its own create control.
    await expect(
      questionRow.getByRole('button', { name: /Create a new question/i })
    ).toBeVisible();

    // Responses tab: report chooser with nothing recorded yet.
    await gotoMoodle(page, `/mod/groupquiz/reports.php?id=${cmid}`);
    await expect(page.locator('body')).toHaveAttribute('id', /page-mod-groupquiz-reports/);
    const reportSelect = page.locator('#region-main select').first();
    await expect(reportSelect).toContainText('Overview Report');
    await expect(reportSelect).toContainText('Open Attempts');
    await expect(reportSelect).toContainText('Closed Attempts');
    await expect(page.locator('#region-main')).toContainText('Nothing to display');
  });

  test('instructor adds a bank question and previews the attempt', async ({
    moodleAdminPage: page,
  }) => {
    const suffix = seedSuffix();
    const seed = await seedCourseWithGrouping(page, suffix);
    seededCourseIds.push(seed.course.id);
    const cmid = await addGroupQuiz(page, {
      courseId: seed.course.id,
      name: `GQ Quiz ${suffix}`,
      groupingName: seed.groupingName,
    });

    const questionName = `GQ TF ${suffix}`;
    await createTrueFalseQuestion(page, cmid, questionName, 'The sky is blue.');

    // The new question is available in the activity's bank but not yet in the quiz.
    await expect(page.locator('#categoryquestions')).toContainText(questionName);
    await expect(page.locator('#questionrow')).toContainText('No questions have been added yet');

    await addQuestionToQuiz(page, cmid, questionName, '1.00');

    // The question list shows the question, its point value and its controls.
    const listItem = page.locator('#questionrow ol.questionlist li[data-questionid]');
    await expect(listItem).toHaveCount(1);
    await expect(listItem.locator('.name')).toContainText(questionName);
    await expect(listItem.locator('.name')).toContainText('Question Points: 1.0000000');
    await expect(listItem.getByRole('link', { name: 'Delete question 1' })).toBeVisible();

    // With a question in place the instructor can run a preview attempt.
    await gotoMoodle(page, `/mod/groupquiz/view.php?id=${cmid}`);
    await page.locator('#region-main').getByRole('button', { name: 'Preview quiz' }).click();
    await page.waitForURL(/action=previewquiz/, URL_WAIT);

    // The attempt UI is assembled by JS from quizdata.php, so wait for the question
    // container rather than for a page load.
    const question = page.locator('#q1_container');
    await question.waitFor({ state: 'visible', timeout: 60000 });
    await expect(page.locator('#region-main')).toContainText(
      'Ensure that each question has been saved before submitting the quiz.'
    );
    await expect(page.locator('#instructionsbox')).toContainText(
      'Click Save Question on each question to record or update your group'
    );
    await expect(page.locator('#timertext')).toContainText('Time Left:');
    await expect(question).toContainText('The sky is blue.');
    await expect(question.getByText('True', { exact: true })).toBeVisible();
    await expect(question.getByText('False', { exact: true })).toBeVisible();
    await expect(page.locator('#q1_save')).toHaveText('Save question');
    await expect(
      page.locator('#region-main').getByRole('button', { name: 'Submit Quiz' })
    ).toBeVisible();

    // Leaving the preview open offers to resume it instead of starting over.
    await gotoMoodle(page, `/mod/groupquiz/view.php?id=${cmid}`);
    await expect(
      page.locator('#region-main').getByRole('button', { name: 'Continue last preview' })
    ).toBeVisible();
  });

  test('instructor removes a question from the quiz', async ({ moodleAdminPage: page }) => {
    const suffix = seedSuffix();
    const seed = await seedCourseWithGrouping(page, suffix);
    seededCourseIds.push(seed.course.id);
    const cmid = await addGroupQuiz(page, {
      courseId: seed.course.id,
      name: `GQ Quiz ${suffix}`,
      groupingName: seed.groupingName,
    });
    const questionName = `GQ TF ${suffix}`;
    await createTrueFalseQuestion(page, cmid, questionName, 'The sky is blue.');
    await addQuestionToQuiz(page, cmid, questionName, '1.00');

    await page
      .locator('#questionrow')
      .getByRole('link', { name: 'Delete question 1' })
      .click();

    const main = page.locator('#region-main');
    await expect(main).toContainText('Successfully deleted question');
    await expect(page.locator('#questionrow')).toContainText('No questions have been added yet');

    // Removing it from the quiz leaves the question in the course bank.
    await expect(page.locator('#categoryquestions')).toContainText(questionName);

    // ...and the activity goes back to reporting that it has nothing to attempt.
    await gotoMoodle(page, `/mod/groupquiz/view.php?id=${cmid}`);
    await expect(page.locator('#region-main')).toContainText(
      'There are no questions added to this quiz.'
    );
  });
});
