// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: playerVm/playerVm-test-plan.md

import { test, expect } from '@playwright/test';
import { hubCalls } from '../../contract-sources';

/**
 * `hubCalls` reading source it was not given by the app repos.
 *
 * The rest of this directory asserts the app clients against the contract files, and every one of those
 * assertions is only as good as the reader underneath it. That reader is a hand-rolled scanner over
 * TypeScript — no parser, because the suite has no TypeScript AST to hand — and its failure mode is not
 * a broken test, it is a *passing* one: a call it does not recognise is a call it does not check, and
 * `signalr-contract.spec.ts` compares the calls it found against the API's declarations and finds
 * nothing wrong with a set it never read.
 *
 * So the shapes below are fixtures, not app source. Each is a case that produced a wrong answer at some
 * point: read them as the reader's own contract.
 */
test.describe('Player VM contract reader', () => {
  test('a generic invoke is read, not skipped', () => {
    // `.invoke<Vm>('GetVm', id)` is how a typed call is spelled. A matcher that only allowed
    // `.invoke(` skipped it silently, so a client calling a hub method the API does not declare
    // passed the contract test.
    const source = `class S { f() { this.hub.invoke<Vm>('GetVm', id); this.hub.invoke('Plain', a, b); } }`;

    expect(hubCalls(source)).toEqual([
      { kind: 'invoke', name: 'GetVm', count: 1 },
      { kind: 'invoke', name: 'Plain', count: 2 },
    ]);
  });

  test('a regex literal does not corrupt the call after it', () => {
    // The quotes inside `/'/g` used to open a string that ran to the next quote in the file — which
    // was the one opening `'VmCreated'`. The call then appeared not to name a string literal at all
    // and the reader threw, blaming the app for what the reader had done to it.
    const source = `class S {
      f(u: string) { return u.replace(/'/g, ''); }
      g() { this.hub.on('VmCreated', (vm: Vm) => this.x(vm)); }
    }`;

    expect(hubCalls(source)).toEqual([{ kind: 'on', name: 'VmCreated', count: 1 }]);
  });

  test('a division is not read as a regex literal', () => {
    // The other half of the same judgement: treating `/` as a literal whenever it appears would blank
    // real code, so the reader decides from what precedes it.
    const source = `class S { f() { const h = total / 2; this.hub.on('Y', (a) => h); } }`;

    expect(hubCalls(source)).toEqual([{ kind: 'on', name: 'Y', count: 1 }]);
  });

  test('a comparison in an argument does not truncate the argument list', () => {
    // `>` was counted as a closing bracket, so this call's range ended at `b` and its arity came back
    // one short — a mismatch reported against the app, for an argument the client does pass.
    const source = `class S { f() { this.hub.invoke('Cmp', a > b, c); } }`;

    expect(hubCalls(source)).toEqual([{ kind: 'invoke', name: 'Cmp', count: 2 }]);
  });

  test('a generic type in a handler parameter list does not split it', () => {
    // The converse case, and the reason angle brackets are still counted when splitting arguments:
    // the comma inside `Map<string, Vm>` is not a parameter boundary.
    const source = `class S { f() { this.hub.on('X', (m: Map<string, Vm>, n: number) => 0); } }`;

    expect(hubCalls(source)).toEqual([{ kind: 'on', name: 'X', count: 2 }]);
  });

  test('a hub call inside a comment or a string is not a hub call', () => {
    const source = `class S {
      // this.hub.on('Commented', (a) => 0);
      f() { const s = "this.hub.on('Quoted', (a) => 0)"; this.hub.on('Real', (a) => s); }
    }`;

    expect(hubCalls(source)).toEqual([{ kind: 'on', name: 'Real', count: 1 }]);
  });
});
