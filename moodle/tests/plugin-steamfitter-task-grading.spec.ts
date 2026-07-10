// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: moodle/TODO-task-testing.md

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';

const modCruciblePath = process.env.MOD_CRUCIBLE_PATH || '/mnt/data/crucible/moodle/mod/crucible';

function readCrucibleFile(relativePath: string): string {
  return readFileSync(join(modCruciblePath, relativePath), 'utf8');
}

test.describe('Moodle Crucible Steamfitter task grading integration', () => {
  test('calculates Moodle attempt grades from Steamfitter scenario scoreEarned', () => {
    const gradePhp = readCrucibleFile('classes/utils/grade.php');

    const systemAuthIndex = gradePhp.indexOf('$system = setup_system();');
    const scenarioIndex = gradePhp.indexOf('get_scenario($system, $attempt->scenarioid)');
    const scoreEarnedIndex = gradePhp.indexOf('$score = $scenario->scoreEarned;');
    const attemptScoreIndex = gradePhp.indexOf('$attempt->score = $score;');
    const attemptSaveIndex = gradePhp.indexOf('$attempt->save();');
    const processAttemptIndex = gradePhp.indexOf('public function process_attempt($attempt)');
    const persistIndex = gradePhp.indexOf('$this->persist_grades($grades, $transaction);');
    const gradebookIndex = gradePhp.indexOf('crucible_update_grades($this->crucible->crucible, $userid, false)');

    expect(systemAuthIndex, 'grading should authenticate to the external service as the system user').toBeGreaterThan(-1);
    expect(scenarioIndex, 'grading should fetch the Steamfitter scenario for the Moodle attempt').toBeGreaterThan(systemAuthIndex);
    expect(scoreEarnedIndex, 'grading should use Steamfitter scenario scoreEarned').toBeGreaterThan(scenarioIndex);
    expect(attemptScoreIndex, 'grading should copy the Steamfitter score into the Moodle attempt').toBeGreaterThan(scoreEarnedIndex);
    expect(attemptSaveIndex, 'grading should persist the attempt score').toBeGreaterThan(attemptScoreIndex);
    expect(processAttemptIndex, 'grade utility should process completed attempts').toBeGreaterThan(-1);
    expect(persistIndex, 'process_attempt should persist Moodle plugin grades').toBeGreaterThan(processAttemptIndex);
    expect(gradebookIndex, 'process_attempt should sync grades to Moodle gradebook').toBeGreaterThan(persistIndex);
  });

  test('uses the configured Steamfitter API for scenario tasks, results, and task execution', () => {
    const locallibPhp = readCrucibleFile('locallib.php');

    const runTaskIndex = locallibPhp.indexOf('function run_task($client, $id)');
    const runTaskUrlIndex = locallibPhp.indexOf('get_config(\'crucible\', \'steamfitterapiurl\') . "/tasks/" . $id . "/execute"', runTaskIndex);
    const runTaskPostIndex = locallibPhp.indexOf('$client->post($url)', runTaskUrlIndex);

    const scenarioTasksIndex = locallibPhp.indexOf('function get_scenariotasks($client, $id)');
    const scenarioTasksUrlIndex = locallibPhp.indexOf('get_config(\'crucible\', \'steamfitterapiurl\') . "/scenarios/" . $id . "/tasks"', scenarioTasksIndex);

    const taskResultsIndex = locallibPhp.indexOf('function get_taskresults($client, $id)');
    const taskResultsUrlIndex = locallibPhp.indexOf('get_config(\'crucible\', \'steamfitterapiurl\') . "/scenarios/" . $id . "/results"', taskResultsIndex);

    expect(runTaskIndex, 'locallib should expose a Steamfitter task execution helper').toBeGreaterThan(-1);
    expect(runTaskUrlIndex, 'run_task should call Steamfitter task execute endpoint from plugin config').toBeGreaterThan(runTaskIndex);
    expect(runTaskPostIndex, 'run_task should POST task execution requests').toBeGreaterThan(runTaskUrlIndex);
    expect(scenarioTasksUrlIndex, 'plugin should fetch Steamfitter scenario tasks for active attempts').toBeGreaterThan(scenarioTasksIndex);
    expect(taskResultsUrlIndex, 'plugin should fetch Steamfitter scenario task results for grading/display').toBeGreaterThan(taskResultsIndex);
  });

  test('renders executable Steamfitter tasks and wires the learner task runner', () => {
    const rendererPhp = readCrucibleFile('renderer.php');
    const resultsTemplate = readCrucibleFile('templates/results.mustache');
    const resultsJs = readCrucibleFile('amd/src/results.js');

    const userExecutableIndex = rendererPhp.indexOf('if ($task->userExecutable)');
    const actionIndex = rendererPhp.indexOf("$rowdata->action = get_string('taskexecute', 'mod_crucible');", userExecutableIndex);
    const noActionIndex = rendererPhp.indexOf("$rowdata->noaction = get_string('tasknoexecute', 'mod_crucible');", userExecutableIndex);

    expect(userExecutableIndex, 'renderer should branch on Steamfitter userExecutable').toBeGreaterThan(-1);
    expect(actionIndex, 'renderer should expose an action for user-executable Steamfitter tasks').toBeGreaterThan(userExecutableIndex);
    expect(noActionIndex, 'renderer should disable non-user-executable Steamfitter tasks').toBeGreaterThan(actionIndex);

    expect(resultsTemplate).toContain('<button id="{{id}}" class="btn btn-primary exec-task">{{action}}</button>');
    expect(resultsTemplate).toContain('<td id="result-{{id}}" class="result">{{result}}</td>');
    expect(resultsTemplate).toContain('<td id="score-{{id}}" class="score">{{score}}</td>');

    expect(resultsJs).toContain("document.getElementsByClassName('exec-task')");
    expect(resultsJs).toContain("url: steamfitter_api_url + '/tasks/' + id + '/execute'");
    expect(resultsJs).toContain("url: steamfitter_api_url + '/scenarios/' + scenario_id + '/results'");
    expect(resultsJs).toContain("xhr.setRequestHeader('Authorization', 'Bearer ' + access_token);");
    expect(resultsJs).toContain("document.getElementById('result-' + value.taskId)");
  });
});
