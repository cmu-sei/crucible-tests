// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Parse command line arguments
const args = process.argv.slice(2);
let filePath = 'test-results/results.json';
let topN = 25;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--top' && i + 1 < args.length) {
    topN = parseInt(args[i + 1], 10);
    i++;
  } else if (!args[i].startsWith('--')) {
    filePath = args[i];
  }
}

const resolvedPath = resolve(filePath);

// Read and parse JSON
let data;
try {
  const content = readFileSync(resolvedPath, 'utf8');
  data = JSON.parse(content);
} catch (err) {
  console.error(`Error reading ${resolvedPath}: ${err.message}`);
  process.exit(1);
}

// Check for all-skipped run
const { expected = 0, unexpected = 0, flaky = 0 } = data.stats || {};
const executedTests = expected + unexpected + flaky;

if (executedTests === 0) {
  console.error(`${filePath}: 0 executed tests (expected=${expected}, unexpected=${unexpected}, flaky=${flaky})`);
  process.exit(1);
}

// Collect all test results
const allResults = [];
const projectStats = {};
const appStats = {};
const fileStats = {};

function walkSuites(suite, inheritedFile = null) {
  const currentFile = suite.file || inheritedFile;

  // Process specs in this suite
  if (suite.specs) {
    for (const spec of suite.specs) {
      if (spec.tests) {
        for (const test of spec.tests) {
          if (test.results) {
            for (const result of test.results) {
              const projectName = test.projectName || 'unknown';
              const app = currentFile ? currentFile.split('/')[0] : 'unknown';

              allResults.push({
                file: currentFile,
                title: spec.title,
                projectName,
                app,
                duration: result.duration || 0,
                status: result.status,
                retry: result.retry || 0
              });

              // Aggregate by project
              if (!projectStats[projectName]) {
                projectStats[projectName] = { count: 0, duration: 0, retryDuration: 0 };
              }
              projectStats[projectName].count++;
              projectStats[projectName].duration += result.duration || 0;
              if (result.retry > 0) {
                projectStats[projectName].retryDuration += result.duration || 0;
              }

              // Aggregate by app
              if (!appStats[app]) {
                appStats[app] = { count: 0, duration: 0 };
              }
              appStats[app].count++;
              appStats[app].duration += result.duration || 0;

              // Aggregate by file
              const fileKey = `${projectName}:${currentFile}`;
              if (!fileStats[fileKey]) {
                fileStats[fileKey] = { projectName, file: currentFile, count: 0, duration: 0 };
              }
              fileStats[fileKey].count++;
              fileStats[fileKey].duration += result.duration || 0;
            }
          }
        }
      }
    }
  }

  // Recurse into child suites
  if (suite.suites) {
    for (const childSuite of suite.suites) {
      walkSuites(childSuite, currentFile);
    }
  }
}

// Walk all suites
if (data.suites) {
  for (const suite of data.suites) {
    walkSuites(suite);
  }
}

// Calculate total wall-clock time
const totalDuration = data.stats?.duration || 0;
const totalWallClockMin = totalDuration / 1000 / 60;

// Calculate total summed time and retry time
const totalSummedMs = allResults.reduce((sum, r) => sum + r.duration, 0);
const totalSummedMin = totalSummedMs / 1000 / 60;
const totalRetryMs = allResults.filter(r => r.retry > 0).reduce((sum, r) => sum + r.duration, 0);
const totalRetryMin = totalRetryMs / 1000 / 60;

// Output report
console.log(`Total results: ${allResults.length}`);
console.log(`Wall-clock time: ${totalWallClockMin.toFixed(1)} min`);
console.log(`Summed test time: ${totalSummedMin.toFixed(1)} min`);
console.log(`Retry time: ${totalRetryMin.toFixed(1)} min`);
console.log();

// Output per-project stats
console.log('By project (summed test time):');
const sortedProjects = Object.entries(projectStats).sort((a, b) => b[1].duration - a[1].duration);
for (const [project, stats] of sortedProjects) {
  const minutes = stats.duration / 1000 / 60;
  const avgSeconds = (stats.duration / 1000) / stats.count;
  const retryMin = stats.retryDuration / 1000 / 60;
  console.log(`  ${project.padEnd(12)} n=${stats.count.toString().padStart(4)}  ${minutes.toFixed(1).padStart(6)} min  avg ${avgSeconds.toFixed(1)} s  (retry ${retryMin.toFixed(1)} min)`);
}
console.log();

// Output per-app stats
console.log('By app (summed test time):');
const sortedApps = Object.entries(appStats).sort((a, b) => b[1].duration - a[1].duration);
for (const [app, stats] of sortedApps) {
  const minutes = stats.duration / 1000 / 60;
  const avgSeconds = (stats.duration / 1000) / stats.count;
  console.log(`  ${app.padEnd(12)} n=${stats.count.toString().padStart(4)}  ${minutes.toFixed(1).padStart(6)} min  avg ${avgSeconds.toFixed(1)} s`);
}
console.log();

// Output slowest files
console.log(`Top ${topN} slowest files (summed duration):`);
const sortedFiles = Object.values(fileStats).sort((a, b) => b.duration - a.duration);
for (let i = 0; i < Math.min(topN, sortedFiles.length); i++) {
  const file = sortedFiles[i];
  const minutes = file.duration / 1000 / 60;
  console.log(`  ${minutes.toFixed(1).padStart(6)} min  n=${file.count.toString().padStart(2)}  [${file.projectName}] ${file.file}`);
}
console.log();

// Output slowest individual tests
console.log(`Top ${topN} slowest tests:`);
const sortedTests = allResults.sort((a, b) => b.duration - a.duration);
for (let i = 0; i < Math.min(topN, sortedTests.length); i++) {
  const test = sortedTests[i];
  const seconds = test.duration / 1000;
  const retryTag = test.retry > 0 ? ` [retry ${test.retry}]` : '';
  console.log(`  ${seconds.toFixed(1).padStart(6)} s  [${test.projectName}] [${test.status}]${retryTag} ${test.file} > ${test.title}`);
}
