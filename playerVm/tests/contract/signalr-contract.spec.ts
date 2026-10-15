// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: playerVm/playerVm-test-plan.md
// reads: player/vm.api (C#), player/vm.ui, player/console.ui

/**
 * The two halves of the Player VM SignalR contract, compared: what `vm.api` declares, and what the two
 * browser clients do about it.
 *
 * `vm.api` used to publish `contracts/signalr-contract.json` and this spec used to read it. That file was
 * deleted along with the test that generated it, so the API's half is now derived from its C# by
 * `api-sources.ts` — every hub it maps, every method those hubs declare, and every message they send. The
 * trade is set out at the top of that file: the reader fails loudly rather than reading short, because a
 * method it silently missed is a method this spec would pass on without checking.
 *
 * Why this is worth a test rather than a convention. SignalR dispatches by name *and* argument count. A
 * client that invokes `JoinView` with two arguments against a one-argument hub method does not get an error
 * anywhere a user would see: the invocation fails, the connection stays up, and the view simply never
 * receives updates. A handler registered for a message name nothing sends is not an error either - it is
 * just never called. Both sides compile, both test suites pass, and the feature is quietly dead. Nothing
 * else in the estate compares the two lists: `vm.api`'s own suite asserts the hubs against themselves, and
 * it cannot see a line of TypeScript.
 *
 * Note the shape of the suite. Every `describe` below is generated from {@link CLIENTS}, a constant in this
 * file, and the API's surface is read *inside* each test. That is deliberate. The old version read the
 * contract file at collection time and looped over the hubs it found, so when the file went away the loop
 * ran zero times: no failures, no skips, twenty-odd tests silently absent from a green report. A suite
 * whose size depends on the thing it is testing cannot report the absence of that thing.
 *
 * This reads application source. `../../../AGENTS.md` permits that to verify a contract, and nothing here
 * writes to an application repository.
 */

import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';
import { requireAppSources } from '../../../shared-fixtures';
import {
  HubCall,
  allPresent,
  appDirectory,
  generatedClientDirectory,
  generatedInterfaceProperties,
  hubCalls,
  hubPaths,
} from '../../contract-sources';
import {
  ApiHub,
  apiHubSurface,
  apiSourcesPresent,
  domainVmModifiedProperties,
  viewModelVmProperties,
} from '../../api-sources';

type Client = { app: string; source: string };

/**
 * Which clients consume which hub - the one part of the contract no source on either side states.
 *
 * `vm.api` does not know who dials it, and a client's `withUrl` names a path rather than declaring a
 * relationship. So this table is the claim, and the `connects to the hub path the API maps` test below is
 * what keeps it honest: an entry pointed at the wrong hub fails there rather than quietly checking a client
 * against a contract it was never party to.
 */
const CLIENTS: Record<string, Client[]> = {
  '/hubs/vm': [
    { app: 'vm.ui', source: 'src/app/services/signalr/signalr.service.ts' },
    { app: 'console.ui', source: 'src/app/services/signalr/signalr.service.ts' },
  ],
  '/hubs/progress': [
    { app: 'console.ui', source: 'src/app/services/notification/notification.service.ts' },
  ],
};

/**
 * Handlers for messages the API never sends: known, deliberate, and recorded here so they stay known.
 *
 * These used to live in the contract file under `clientListenersWithNoSender`. A handler for a message
 * nothing sends is dead code that looks like a feature, and the only thing worse than one nobody has
 * noticed is one everybody has stopped noticing - so each entry is asserted to still be true, and goes
 * stale loudly when the handler is removed or the API starts sending the message.
 */
const LISTENERS_WITH_NO_SENDER: Array<{ path: string; name: string; listenedForBy: string[]; note: string }> =
  [
    {
      path: '/hubs/progress',
      name: 'Complete',
      listenedForBy: ['console.ui'],
      note:
        "`notification.service.ts` registers a `Complete` handler that clears the console's progress bar. " +
        'The VM API sends only `Progress`, from the two hypervisor task pollers, and has no `Complete` ' +
        'anywhere - so the bar is cleared by the next `Progress` at 100 and never by this handler.',
    },
  ];

/** Read once: the surface is 274 files of C#, and every test below wants the same answer. */
let surface: ApiHub[] | null = null;

/**
 * The API's declaration of one hub.
 *
 * Skips (or, under CI, fails - see `requireAppSources`) when `vm.api` is not checked out, and *throws* when
 * it is checked out and no longer maps this path. Those are different facts and only one of them is about
 * the environment: a hub that stopped being mapped is a client dialling a 404, which is exactly the kind of
 * thing this spec exists to catch, and reporting it as "not checked out" would bury it.
 */
function hubAt(hubPath: string): ApiHub {
  requireAppSources(apiSourcesPresent(), `${appDirectory('vm.api')} is not checked out.`);

  surface ??= apiHubSurface();
  const hub = surface.find((x) => x.path === hubPath);

  if (!hub) {
    throw new Error(
      `The VM API maps no hub at '${hubPath}', and ${
        CLIENTS[hubPath].length
      } client(s) dial it. It maps: ${surface.map((x) => x.path).join(', ') || 'nothing'}.`
    );
  }

  return hub;
}

/**
 * The client source a table entry points at, or null when that repository is not checked out.
 *
 * A repository that is checked out but does not hold the file is a different thing, and throws. The two
 * have to be told apart because `requireAppSources` skips locally: a `source` that is a typo, or an entry
 * left behind when a client's service file was renamed, would otherwise read as "vm.ui is not checked out"
 * on the machine of the only person in a position to see that it was there all along - and the entry would
 * keep naming a file that no longer exists while its four tests quietly did nothing.
 */
function clientSource(app: string, source: string): string | null {
  const directory = appDirectory(app);

  if (!fs.existsSync(directory)) {
    return null;
  }

  const file = path.join(directory, source);

  if (!fs.existsSync(file)) {
    throw new Error(
      `This spec names '${source}' as ${app}'s client, and ${directory} does not hold it. Either the ` +
        'path in CLIENTS is wrong, or the client moved and the entry was not moved with it.'
    );
  }

  return fs.readFileSync(file, 'utf8');
}

/** Everything a client source says about one hub. */
function callsFor(client: Client): { calls: HubCall[]; paths: string[] } | null {
  const text = clientSource(client.app, client.source);

  return text === null ? null : { calls: hubCalls(text), paths: hubPaths(text) };
}

function describeHub(hubPath: string, clients: Client[]): void {
  test.describe(`${hubPath} hub`, () => {
    for (const client of clients) {
      test.describe(client.app, () => {
        /**
         * The half that breaks silently in the client's favour. An invocation SignalR cannot bind is
         * rejected on the server and the returned promise rejects, but these clients invoke without
         * awaiting - so a renamed hub method or one extra argument costs the client every message the
         * group would have carried, with nothing logged and nothing thrown.
         */
        test(`invokes only methods the API declares, with the arguments it declares`, () => {
          const found = callsFor(client);
          requireAppSources(found, `${client.app}/${client.source} is not checked out.`);

          const hub = hubAt(hubPath);
          const declared = new Set(hub.methods.map((x) => `${x.name}/${x.arguments}`));
          const invoked = [
            ...new Set(found.calls.filter((x) => x.kind === 'invoke').map((x) => `${x.name}/${x.count}`)),
          ].sort();

          // Asserted as a whole set rather than one name at a time so a failure shows the name and the
          // count together: `SetActiveVirtualMachine/2` against a hub that declares `/1` is the bug, and a
          // message that only said the name would look like the method was missing.
          expect(
            invoked.filter((x) => !declared.has(x)),
            `${hub.file} declares [${[...declared].sort().join(', ')}]`
          ).toEqual([]);
        });

        /**
         * A handler for a message nothing sends is dead code that looks like a feature. The ones that
         * already exist are recorded in {@link LISTENERS_WITH_NO_SENDER}, with a note saying why, so this
         * test is about the ones nobody has decided about yet.
         */
        test(`listens only for messages the API sends`, () => {
          const found = callsFor(client);
          requireAppSources(found, `${client.app}/${client.source} is not checked out.`);

          const hub = hubAt(hubPath);
          const known = new Set([
            ...hub.broadcasts.map((x) => x.name),
            ...LISTENERS_WITH_NO_SENDER.filter((x) => x.path === hubPath).map((x) => x.name),
          ]);

          expect(
            [...new Set(found.calls.filter((x) => x.kind === 'on').map((x) => x.name))]
              .filter((x) => !known.has(x))
              .sort()
          ).toEqual([]);
        });

        /**
         * Broadcast arity is one-sided: SignalR drops arguments a handler does not bind, so binding fewer
         * than the API sends is legal and both clients do it deliberately. Binding *more* is not caught
         * anywhere - the extra parameter arrives as `undefined`, and `undefined` is what a half-written
         * feature and a working one look like alike.
         */
        test(`binds no more arguments than the API sends`, () => {
          const found = callsFor(client);
          requireAppSources(found, `${client.app}/${client.source} is not checked out.`);

          const hub = hubAt(hubPath);
          const sent = new Map(hub.broadcasts.map((x) => [x.name, Math.min(...x.arguments)]));
          const overbound = found.calls
            .filter((x) => x.kind === 'on' && sent.has(x.name) && x.count > sent.get(x.name))
            .map((x) => `${x.name} binds ${x.count}, the API sends ${sent.get(x.name)}`)
            .sort();

          // Against the smallest arity a name is ever sent with, not the largest. `VmCreated` goes out
          // with one argument from one handler and two from another, so a client that bound two would see
          // `undefined` for half the VMs it was told about.
          expect(overbound).toEqual([]);
        });

        test(`connects to the hub path the API maps`, () => {
          const found = callsFor(client);
          requireAppSources(found, `${client.app}/${client.source} is not checked out.`);

          expect(found.paths).toContain(hubAt(hubPath).path);
        });
      });
    }

    /**
     * The other direction. A broadcast no client listens for is either a feature that was removed from the
     * UI and left running on the server, or one that was never wired up - and no test inside `vm.api` can
     * tell, because from in there a send that nobody receives looks exactly like a send.
     */
    test(`every message it broadcasts is listened for by some client`, () => {
      const sources = clients.map(callsFor);
      requireAppSources(
        sources.every((x) => x),
        `Not every client of the ${hubPath} hub is checked out.`
      );

      const listened = new Set(
        sources.flatMap((x) => x.calls.filter((c) => c.kind === 'on').map((c) => c.name))
      );

      expect(hubAt(hubPath).broadcasts.map((x) => x.name).filter((x) => !listened.has(x))).toEqual([]);
    });

    for (const listener of LISTENERS_WITH_NO_SENDER.filter((x) => x.path === hubPath)) {
      /**
       * The recorded anomalies stay honest, in both directions: the handler is still registered, and the
       * API still does not send the message. Either one changing makes the record above a lie, and a lie
       * in that table is worse than no table - it is a documented reason not to look.
       */
      test(`the unsent message ${listener.name} is still listened for, and still unsent`, () => {
        const sources = listener.listenedForBy.map((app) => ({
          app,
          found: callsFor(clients.find((x) => x.app === app)),
        }));

        requireAppSources(
          sources.every((x) => x.found),
          `Not every client listed for ${listener.name} is checked out.`
        );

        expect(
          sources
            .filter((x) => !x.found.calls.some((c) => c.kind === 'on' && c.name === listener.name))
            .map((x) => x.app),
          `${listener.name} is recorded as a handler with no sender: ${listener.note}`
        ).toEqual([]);

        expect(
          hubAt(hubPath).broadcasts.map((x) => x.name),
          `the API now sends ${listener.name}, so the record of it having no sender is stale`
        ).not.toContain(listener.name);
      });
    }
  });
}

test.describe('Player VM SignalR contract', () => {
  for (const [hubPath, clients] of Object.entries(CLIENTS)) {
    describeHub(hubPath, clients);
  }

  /**
   * A hub added to `vm.api` with no entry in {@link CLIENTS} would be a whole hub this spec never looks at,
   * and nothing above could report it: every test here is generated from that table. So the table is
   * asserted against the application.
   */
  test('the API maps exactly the hubs this spec knows clients for', () => {
    requireAppSources(apiSourcesPresent(), `${appDirectory('vm.api')} is not checked out.`);

    surface ??= apiHubSurface();

    expect(
      surface.map((x) => x.path).sort(),
      'a hub with no entry in CLIENTS is a hub no test in this file checks a client against'
    ).toEqual(Object.keys(CLIENTS).sort());
  });

  /**
   * The reader's own precondition. Every assertion above compares a client against a set this suite read
   * out of C#, and an empty set makes all of them pass; this is the one test that fails when the reading
   * itself has stopped working.
   */
  test('the hub surface read from the API is not empty', () => {
    requireAppSources(apiSourcesPresent(), `${appDirectory('vm.api')} is not checked out.`);

    surface ??= apiHubSurface();

    expect(surface.length).toBeGreaterThan(0);

    for (const hub of surface) {
      expect(hub.methods.length, `${hub.file} declares no invocable methods`).toBeGreaterThan(0);
      expect(hub.broadcasts.length, `${hub.file} sends nothing`).toBeGreaterThan(0);
    }
  });

  /**
   * The `modifiedProperties` argument of `VmUpdated` is a list of property names, and `vm.ui` spends them
   * as `model[x] = vm[x]`. A name that is not a key of the serialized VM assigns `undefined` over a value
   * that was correct a moment ago, so the failure is not a missing update but a field that goes blank when
   * the VM changes.
   *
   * The names are Entity Framework's, taken from the tracked properties of the domain entity, and the keys
   * are the DTO's. Both are read from `vm.api`; the interface is the one the browser actually indexes.
   */
  test.describe('modifiedProperties', () => {
    /** Both sides of the comparison, or a skip when either repository is missing. */
    function generatedVm(): string[] {
      requireAppSources(
        apiSourcesPresent() && allPresent(generatedClientDirectory()),
        'vm.api or the generated vm.ui API client is not checked out.'
      );

      const generated = generatedInterfaceProperties('Vm');
      expect(generated, 'the generated client has no Vm interface').not.toBeNull();

      return generated;
    }

    test('every name the API can send is a property of the generated Vm interface', () => {
      const generated = generatedVm();

      expect(domainVmModifiedProperties().filter((x) => !generated.includes(x))).toEqual([]);
    });

    /**
     * The keys `modifiedProperties` never names are still keys - they change with the VM, they are just
     * only ever carried by the whole `Vm` the first argument holds. Asserted because a client indexing one
     * of them off a stale interface reads `undefined` just the same, and because the difference between the
     * two lists is where somebody looking for "why did this field not update" ends up.
     */
    test('every key no update ever names is a property of the generated Vm interface', () => {
      const generated = generatedVm();
      const named = new Set(domainVmModifiedProperties());
      const neverNamed = viewModelVmProperties().filter((x) => !named.has(x));

      expect(neverNamed.length, 'the DTO has no keys beyond the ones updates name').toBeGreaterThan(0);
      expect(neverNamed.filter((x) => !generated.includes(x))).toEqual([]);
    });
  });
});
