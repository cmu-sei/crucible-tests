// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/moodle-test-plan.md

/**
 * `qtype_mojomatch` and `qbehaviour_mojomatch`, driven through the question bank
 * and the question preview.
 *
 * Both plugins have PHPUnit suites covering the matching rules and a behaviour
 * walkthrough, and neither loads a page: they build a question in code and step the
 * question engine directly. What is left untested is everything the browser is
 * needed for — that the type is offered by the question chooser at all, that its
 * extra fields reach the database through the real form, and that a question
 * answered in the preview is graded by the MojoMatch behaviour rather than the
 * usage's preferred one, which is what `qtype_mojomatch_question::make_behaviour()`
 * forces and what `qbehaviour_mojomatch::grades_on_check()` then decides about.
 *
 * The question type is what mod_topomojo's challenges are made of, but nothing here
 * needs TopoMojo: a question with no workspace and transforms off grades entirely
 * inside Moodle.
 *
 * The questions are created in the demo course's question bank through the UI and
 * deleted in teardown.
 */

import { Page } from '@playwright/test';
import { test, expect, Services } from '../fixtures';
import { connectMoodleDatabase } from '../db-helpers';
import { runMoodlePhp } from '../cli-helpers';

/** The course whose question bank the questions are created in. */
const courseName = process.env.MOODLE_DEMO_COURSE || 'Test Course';

/** Strings the two plugins define for the surfaces under test. */
const STRINGS = {
  /** qtype_mojomatch's pluginname. The type is called TopoMojo in the chooser, not MojoMatch. */
  qtypeName: 'TopoMojo',
  qtypeSummary: 'Allows a response of one or a few words that is graded by comparing against various model answers',
  caseNo: 'No, case is unimportant',
  caseYes: 'Yes, case must match',
  matchAlpha: 'MatchAlpha will strip all characters other than alphabetic characters.',
  matchAll: 'MatchAll will require every one of the answers to appear among the words of the response.',
  matchAny: 'MatchAny will accept a response that matches any one of the answers.',
  match: 'Match will perform an exact match of the answer string similar to a short answer.',
  /** core, not the plugin: the plugin's validation() defers to it. */
  noFullMarks: 'One of the answers should have a score of 100%',
};

/**
 * The stored matchtype each label has to carry, which is the plugin's own encoding of
 * TopoMojo's AnswerGrader and what mod_topomojo's questionmanager writes when it imports a
 * challenge. The edit form used to build this list unkeyed, so each label took the value of
 * its position: MatchAny carried 1, which qtype_mojomatch_question grades as matchAll, and
 * MatchAll carried 2, which it grades as matchAny. Picking either one got the other's grader.
 */
const GRADERS: [string, keyof typeof STRINGS][] = [
  ['0', 'matchAlpha'],
  ['1', 'matchAll'],
  ['2', 'matchAny'],
  ['3', 'match'],
];

/**
 * The answer the questions are created with, and responses that have to grade for
 * and against it.
 *
 * MatchAlpha strips everything but letters and digits from both sides before
 * comparing, so the punctuation and spacing of a response are irrelevant and
 * "Case sensitivity: No" makes its case irrelevant too. That is the whole point of
 * the type: a lab answer typed with different bracketing still scores.
 */
const ANSWER = 'flag{s3cr3t-value}';
const MATCHING_RESPONSE = 'FLAG S3CR3T VALUE';
const NONMATCHING_RESPONSE = 'flag{wrong-value}';

type Question = { id: number; name: string };

/**
 * Resolves the qbank module the questions are created in.
 *
 * Moodle 5.0 moved question banks into a module, so a bank is a course module like
 * any other and the course's own bank is whichever qbank instance it holds. Looked
 * up rather than hardcoded: the id differs between the 5.0 and 5.2 containers and
 * changes whenever the demo course is reseeded.
 */
function resolveQuestionBankCmid(): { cmid: number; courseId: number } {
  const output = runMoodlePhp(
    `$course = $DB->get_record('course', ['fullname' => '${courseName}'], 'id', IGNORE_MULTIPLE);`
    + ` if (!$course) { echo 'nocourse'; exit; }`
    + ` $cm = $DB->get_record_sql("SELECT cm.id FROM {course_modules} cm`
    + ` JOIN {modules} m ON m.id = cm.module AND m.name = 'qbank'`
    + ` WHERE cm.course = ? ORDER BY cm.id", [$course->id], IGNORE_MULTIPLE);`
    + ` echo $cm ? $course->id . ':' . $cm->id : 'nobank:' . $course->id;`
  );

  const [courseId, cmid] = output.trim().split(':');
  if (output.startsWith('nocourse')) {
    throw new Error(`No course named '${courseName}'. Set MOODLE_DEMO_COURSE to an existing course.`);
  }
  if (output.startsWith('nobank')) {
    throw new Error(
      `Course '${courseName}' holds no question bank. Moodle 5.0 upgrades create one per course, `
      + 'so add a Question bank activity to the course and re-run.'
    );
  }
  return { courseId: Number(courseId), cmid: Number(cmid) };
}

/** Deletes a question, its answers and its mojomatch options. */
function deleteQuestion(questionId: number): void {
  runMoodlePhp(
    `require_once($CFG->libdir . '/questionlib.php');`
    + ` question_delete_question(${questionId});`
  );
}

/**
 * Fills a Moodle "rich text" field.
 *
 * TinyMCE takes over the plain textarea some time after the form renders, so typing
 * into either surface too early is lost: the textarea gets hidden, and content
 * written into the editor body before initialisation finishes is discarded. Waiting
 * for the editor instance to report itself initialised and then going through its own
 * API (`setContent` + `save`, which writes back to the textarea the form submits)
 * removes both races. A site serving the plain textarea has no editor instance, and
 * falls through to filling the textarea directly.
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

/** Opens the question bank's "Create a new question" chooser and returns it. */
async function openQuestionTypeChooser(page: Page, cmid: number) {
  await page.goto(`${Services.Moodle}/question/edit.php?cmid=${cmid}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.locator('#region-main').getByRole('button', { name: /Create a new question/i }).click();

  // The chooser markup exists twice in the DOM — the inline template plus the modal
  // built from it — so pin the visible dialog.
  const chooser = page
    .locator('.modal-dialog, [role="dialog"]')
    .filter({ visible: true })
    .filter({ hasText: 'Choose a question type to add' })
    .last();
  await expect(chooser).toBeVisible();
  return chooser;
}

/** Opens a blank MojoMatch question form. */
async function openNewMojomatchForm(page: Page, cmid: number): Promise<void> {
  const chooser = await openQuestionTypeChooser(page, cmid);
  const mojomatch = chooser.locator('input[name="qtype"][value="mojomatch"]');
  // The list is fetched, so it is not in the modal the moment it opens.
  await mojomatch.waitFor({ state: 'visible', timeout: 30000 });
  await mojomatch.check();
  await chooser.getByRole('button', { name: 'Add', exact: true }).click();
  await page.waitForURL(/\/question\/bank\/editquestion\/question\.php/, { timeout: 60000 });
}

/** Reads back the row `qtype_mojomatch` stores alongside a question. */
async function getMojomatchOptions(questionId: number) {
  const client = await connectMoodleDatabase();
  try {
    const result = await client.query<{
      usecase: number;
      matchtype: number;
      variant: number;
      workspaceid: string;
      transforms: number;
    }>(
      `SELECT usecase, matchtype, variant, workspaceid, transforms
         FROM mdl_qtype_mojomatch_options
        WHERE questionid = $1`,
      [questionId]
    );
    expect(result.rowCount, 'the question should have one mojomatch options row').toBe(1);
    const row = result.rows[0];
    return {
      usecase: Number(row.usecase),
      matchtype: Number(row.matchtype),
      variant: Number(row.variant),
      workspaceid: row.workspaceid,
      transforms: Number(row.transforms),
    };
  } finally {
    await client.end();
  }
}

/** The answers stored for a question, in id order, with their fractions. */
async function getQuestionAnswers(questionId: number) {
  const client = await connectMoodleDatabase();
  try {
    const result = await client.query<{ answer: string; fraction: string }>(
      `SELECT answer, fraction FROM mdl_question_answers WHERE question = $1 ORDER BY id`,
      [questionId]
    );
    return result.rows.map(row => ({ answer: row.answer, fraction: Number(row.fraction) }));
  } finally {
    await client.end();
  }
}

/** Looks a created question up by name, so the test never hardcodes an id. */
async function findQuestionByName(name: string): Promise<number> {
  const client = await connectMoodleDatabase();
  try {
    const result = await client.query<{ id: number }>(
      `SELECT id FROM mdl_question WHERE name = $1 ORDER BY id DESC`,
      [name]
    );
    expect(result.rowCount, `a question named '${name}' should have been created`).toBe(1);
    return Number(result.rows[0].id);
  } finally {
    await client.end();
  }
}

/** The behaviour the question engine recorded for a question's attempts. */
async function getAttemptBehaviours(questionId: number): Promise<string[]> {
  const client = await connectMoodleDatabase();
  try {
    const result = await client.query<{ behaviour: string }>(
      `SELECT DISTINCT behaviour FROM mdl_question_attempts WHERE questionid = $1`,
      [questionId]
    );
    return result.rows.map(row => row.behaviour);
  } finally {
    await client.end();
  }
}

/**
 * Creates a MojoMatch question through the form and returns it.
 *
 * Everything the type adds to the question form is set explicitly rather than left
 * at its default, so what is read back afterwards can only have come through the
 * form.
 */
async function createMojomatchQuestion(
  page: Page,
  cmid: number,
  options: {
    name: string;
    transforms: number;
    matchtype?: number;
    variant?: number;
    workspaceid?: string;
    /** A second answer row, for the questions that are not single-answer. */
    partialanswer?: { answer: string; fraction: string };
  }
): Promise<Question> {
  await openNewMojomatchForm(page, cmid);

  await page.locator('#id_name').fill(options.name);
  await fillEditorField(page, 'id_questiontext', `What is the flag? (${options.name})`);
  await page.locator('#id_matchtype').selectOption(String(options.matchtype ?? 0));
  await page.locator('#id_variant').fill(String(options.variant ?? 1));
  await page.locator('#id_transforms').fill(String(options.transforms));
  await page.locator('#id_workspaceid').fill(options.workspaceid ?? '');
  await page.locator('#id_answer_0').fill(ANSWER);
  await page.locator('#id_fraction_0').selectOption('1.0');
  if (options.partialanswer) {
    await page.locator('#id_answer_1').fill(options.partialanswer.answer);
    await page.locator('#id_fraction_1').selectOption(options.partialanswer.fraction);
  }

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
    page.locator('#id_submitbutton').click(),
  ]);
  await expect(page.locator('.is-invalid, [id^="id_error_"]:visible'), 'the form should save without errors')
    .toHaveCount(0);

  return { id: await findQuestionByName(options.name), name: options.name };
}

/**
 * Opens a question's preview under a behaviour that grades on a Check button.
 *
 * The preview defaults to deferred feedback, under which
 * `qbehaviour_mojomatch::grades_on_check()` is false and its renderer deliberately
 * offers no submit button — nothing can be graded until the behaviour is changed,
 * and changing it means restarting the preview through its options form.
 */
async function openPreviewWithImmediateFeedback(page: Page, question: Question, cmid: number): Promise<void> {
  await page.goto(`${Services.Moodle}/question/bank/previewquestion/preview.php?id=${question.id}&cmid=${cmid}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });

  // The options ship collapsed, and a collapsed section's fields are present but not
  // interactable.
  const previewOptions = page.getByRole('button', { name: 'Preview options', exact: true });
  if ((await previewOptions.getAttribute('aria-expanded')) === 'false') {
    await previewOptions.click();
  }

  const behaviour = page.locator('#id_behaviour');
  await expect(behaviour, 'the preview should offer the attempt options').toBeVisible();
  await behaviour.selectOption('immediatefeedback');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
    page.getByRole('button', { name: 'Save preview options and start again' }).click(),
  ]);
}

/**
 * Asserts how the previewed question was graded.
 *
 * Read off the question's info block rather than its feedback: the feedback names the
 * right answer either way, and "Correct" is a substring of "Incorrect", so the state
 * is matched exactly.
 */
async function expectGraded(
  page: Page,
  state: 'Correct' | 'Incorrect' | 'Partially correct',
  mark: string,
  because: string
) {
  const info = page.locator('.que.mojomatch .info');
  await expect(info.locator('.state'), because).toHaveText(state);
  await expect(info.locator('.grade')).toHaveText(`Mark ${mark} out of 1.00`);
}

/** Answers the previewed question and submits it for immediate grading. */
async function answerPreview(page: Page, response: string): Promise<void> {
  const answer = page.locator('.que.mojomatch input[type="text"]').first();
  await expect(answer, 'the question should render an answer box').toBeVisible();
  await answer.fill(response);

  // qbehaviour_mojomatch's renderer is what puts this button there, and only for a
  // behaviour that grades on check.
  const check = page.locator('.que.mojomatch').getByRole('button', { name: /^Check/ });
  await expect(check, 'the MojoMatch behaviour should offer a Check button').toHaveCount(1);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
    check.click(),
  ]);
}

test.describe('qtype_mojomatch and qbehaviour_mojomatch', () => {
  test.describe.configure({ mode: 'serial' });

  const suffix = `${Date.now()}`;
  let cmid: number;
  const created: number[] = [];

  test.beforeAll(async () => {
    ({ cmid } = resolveQuestionBankCmid());
  });

  test.afterAll(async () => {
    for (const questionId of created) {
      deleteQuestion(questionId);
    }
    created.length = 0;
  });

  test('the question chooser offers the type and its form carries the plugin\'s own settings', async ({
    moodleAdminPage: page,
  }) => {
    const chooser = await openQuestionTypeChooser(page, cmid);

    const option = chooser.locator('input[name="qtype"][value="mojomatch"]');
    await option.waitFor({ state: 'visible', timeout: 30000 });

    // Named after the product, not the plugin: qtype_mojomatch's pluginname is
    // "TopoMojo", so that is what an author picks from this list. The summary is in
    // the DOM but only shown for the selected type, so it is asserted on text rather
    // than visibility.
    const row = chooser.locator('.option:has(input[name="qtype"][value="mojomatch"])').first();
    await expect(row.locator('.typename'), 'the chooser should name the type').toHaveText(STRINGS.qtypeName);
    await expect(row.locator('.typesummary'), 'the chooser should summarise the type').toContainText(
      STRINGS.qtypeSummary
    );

    await option.check();
    await chooser.getByRole('button', { name: 'Add', exact: true }).click();
    await page.waitForURL(/\/question\/bank\/editquestion\/question\.php/, { timeout: 60000 });

    // The fields the type adds to the standard question form, with the defaults its
    // edit form sets. A missing one means an author cannot describe the lab answer
    // at all; a wrong default silently changes how every new question grades.
    const usecase = page.locator('#id_usecase');
    await expect(usecase, 'case sensitivity should default to insensitive').toHaveValue('0');
    await expect(usecase.locator('option')).toHaveText([STRINGS.caseNo, STRINGS.caseYes]);

    const matchtype = page.locator('#id_matchtype');
    await expect(matchtype, 'match type should default to MatchAlpha').toHaveValue('0');
    await expect(matchtype.locator('option')).toHaveCount(GRADERS.length);
    for (const [value, string] of GRADERS) {
      await expect(
        matchtype.locator(`option[value="${value}"]`),
        `the option stored as matchtype ${value} should be the one that names that grader`
      ).toHaveText(STRINGS[string]);
    }

    await expect(page.locator('#id_variant'), 'a question belongs to variant 1 unless told otherwise')
      .toHaveValue('1');
    await expect(page.locator('#id_transforms')).toHaveValue('1');
    await expect(page.locator('#id_workspaceid'), 'the workspace is only known once the lab is').toHaveValue('');
  });

  test('a question with no answer worth full marks is refused', async ({ moodleAdminPage: page }) => {
    await openNewMojomatchForm(page, cmid);

    const name = `E2E MojoMatch invalid ${suffix}`;
    await page.locator('#id_name').fill(name);
    await fillEditorField(page, 'id_questiontext', 'What is the flag?');
    await page.locator('#id_answer_0').fill(ANSWER);
    // Grade "None". An answer nobody can score full marks for makes the question
    // ungradable, so the form has to say so rather than store it.
    await page.locator('#id_fraction_0').selectOption('0.0');

    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
      page.locator('#id_submitbutton').click(),
    ]);

    // Reported against the answer block. Matched on the message rather than on the
    // error element's id, which differs between the group and its members.
    await expect(
      page.locator('#region-main').getByText(STRINGS.noFullMarks).first(),
      'the form should come back with the answer block in error'
    ).toBeVisible();

    const client = await connectMoodleDatabase();
    try {
      const result = await client.query(`SELECT id FROM mdl_question WHERE name = $1`, [name]);
      expect(result.rowCount, 'the refused question should not have been stored').toBe(0);
    } finally {
      await client.end();
    }
  });

  test('saving a question stores its matching options and answer', async ({ moodleAdminPage: page }) => {
    const question = await createMojomatchQuestion(page, cmid, {
      name: `E2E MojoMatch stored ${suffix}`,
      transforms: 0,
      matchtype: 0,
      variant: 2,
      workspaceid: 'e2e-workspace',
    });
    created.push(question.id);

    const options = await getMojomatchOptions(question.id);
    expect(options.matchtype, 'MatchAlpha').toBe(0);
    expect(options.usecase, 'case insensitive, the form default').toBe(0);
    // The variant is how mod_topomojo picks the questions belonging to the gamespace
    // it deployed, so a value that does not survive the form grades the wrong lab.
    expect(options.variant).toBe(2);
    expect(options.workspaceid).toBe('e2e-workspace');
    expect(options.transforms).toBe(0);

    expect(await getQuestionAnswers(question.id)).toEqual([{ answer: ANSWER, fraction: 1 }]);
  });

  test('MatchAlpha grades a preview response ignoring its case and punctuation', async ({
    moodleAdminPage: page,
  }) => {
    const question = await createMojomatchQuestion(page, cmid, {
      name: `E2E MojoMatch graded ${suffix}`,
      // Off: with transforms on, the preview accepts any response containing the
      // answer, which is the next test rather than this one.
      transforms: 0,
    });
    created.push(question.id);

    await openPreviewWithImmediateFeedback(page, question, cmid);

    await answerPreview(page, NONMATCHING_RESPONSE);
    await expectGraded(page, 'Incorrect', '0.00', 'a different flag should not score');

    // Immediate feedback grades once, so a second response needs a fresh attempt.
    await openPreviewWithImmediateFeedback(page, question, cmid);
    await answerPreview(page, MATCHING_RESPONSE);
    await expectGraded(
      page,
      'Correct',
      '1.00',
      'the same flag in different case and punctuation should score'
    );

    // The usage asked for immediate feedback; make_behaviour() substitutes
    // qbehaviour_mojomatch regardless, and that substitution is what decides
    // whether the question can be checked at all.
    expect(await getAttemptBehaviours(question.id), 'the attempt should be graded by the MojoMatch behaviour')
      .toEqual(['mojomatch']);
  });

  test('a question using transforms accepts a preview response that contains the answer', async ({
    moodleAdminPage: page,
  }) => {
    const question = await createMojomatchQuestion(page, cmid, {
      name: `E2E MojoMatch transforms ${suffix}`,
      transforms: 1,
    });
    created.push(question.id);

    await openPreviewWithImmediateFeedback(page, question, cmid);

    // A transformed lab generates its answer when the gamespace is deployed, so the
    // stored answer is a template and the preview has no gamespace to resolve it
    // against. Rather than fail every preview of such a question, the comparison
    // accepts a response the stored answer appears in.
    await answerPreview(page, `the flag is ${ANSWER} on the desktop`);
    await expectGraded(page, 'Correct', '1.00', 'a response carrying the stored answer should score');
  });

  test('a question with more than one answer is graded rather than fatal', async ({ moodleAdminPage: page }) => {
    // The edit form offers more answer rows, so a question with two of them is ordinary
    // authoring. Both the question and its renderer used to read the single answer out of
    // get_answers() without checking there was one: with any other number $rightanswer was
    // never assigned, and grade_attempt()'s typed parameter then threw a TypeError. That
    // took out the whole page - the attempt could not be graded and the preview could not
    // be rendered - so this is a smoke test as much as a grading one.
    const question = await createMojomatchQuestion(page, cmid, {
      name: `E2E MojoMatch two answers ${suffix}`,
      transforms: 0,
      // Match, so the partial answer scores only when it is typed exactly and the three
      // responses below land on three different marks.
      matchtype: 3,
      partialanswer: { answer: 'flag{s3cr3t}', fraction: '0.5' },
    });
    created.push(question.id);

    expect(await getQuestionAnswers(question.id), 'both answers should have been stored').toEqual([
      { answer: ANSWER, fraction: 1 },
      { answer: 'flag{s3cr3t}', fraction: 0.5 },
    ]);

    // Immediate feedback grades once, so each response needs a fresh attempt.
    await openPreviewWithImmediateFeedback(page, question, cmid);
    await answerPreview(page, ANSWER);
    await expectGraded(page, 'Correct', '1.00', 'the answer worth full marks should score in full');

    await openPreviewWithImmediateFeedback(page, question, cmid);
    await answerPreview(page, 'flag{s3cr3t}');
    await expectGraded(page, 'Partially correct', '0.50', 'the second answer should score what it is worth');

    await openPreviewWithImmediateFeedback(page, question, cmid);
    await answerPreview(page, NONMATCHING_RESPONSE);
    await expectGraded(page, 'Incorrect', '0.00', 'a response matching neither answer should not score');
  });
});
