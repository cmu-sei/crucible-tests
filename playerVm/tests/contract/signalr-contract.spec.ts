// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: playerVm/playerVm-test-plan.md
// contract: player/vm.api/contracts/signalr-contract.json

/**
 * The client half of the Player VM SignalR contract.
 *
 * `player/vm.api/contracts/signalr-contract.json` lists every hub method the API declares and every
 * message it broadcasts. `Player.Vm.Api.Tests/ContractTests.cs` asserts that file against the server:
 * it reflects over the hub classes and drives the real event handlers into a recording hub context, so
 * the file cannot claim a method or an argument count the API does not have. This asserts the same file
 * against the two browser clients that consume it.
 *
 * Why this is worth a test rather than a convention. SignalR dispatches by name *and* argument count.
 * A client that invokes `JoinView` with two arguments against a one-argument hub method does not get an
 * error anywhere a user would see: the invocation fails, the connection stays up, and the view simply
 * never receives updates. A handler registered for a message name nothing sends is not an error either
 * - it is just never called. Both sides compile, both test suites pass, and the feature is quietly
 * dead. Nothing else in the estate compares the two lists.
 *
 * This reads application source. `../../../AGENTS.md` permits that to verify a contract, and nothing
 * here writes to an application repository.
 */

import fs from 'fs';
import path from 'path';
import { expect, test } from '@playwright/test';
import { requirePrecondition } from '../../../shared-fixtures';
import {
  ContractHub,
  HubCall,
  SignalRContract,
  allPresent,
  appDirectory,
  contractsDirectory,
  generatedClientDirectory,
  generatedInterfaceProperties,
  hubCalls,
  hubPaths,
  readJson,
} from '../../contract-sources';

const contractFile = path.join(contractsDirectory(), 'signalr-contract.json');

// Read at collection time, because the hubs and clients it lists are what the tests below are named
// after. A missing file leaves `contract` null and the suite becomes the single precondition test at
// the bottom, rather than a collection error that reads as a broken suite.
const contract: SignalRContract | null = fs.existsSync(contractFile)
  ? readJson<SignalRContract>(contractFile)
  : null;

/**
 * The client source a contract entry points at, or null when that repository is not checked out.
 *
 * A repository that is checked out but does not hold the file is a different thing, and throws. The two
 * have to be told apart because `requirePrecondition` skips locally: a `source` that is a typo, or an
 * entry left behind when a client's service file was renamed, would otherwise read as "vm.ui is not
 * checked out" on the machine of the only person in a position to see that it was there all along - and
 * the contract entry would keep naming a file that no longer exists while its four tests quietly did
 * nothing.
 */
function clientSource(app: string, source: string): string | null {
  const directory = appDirectory(app);

  if (!fs.existsSync(directory)) {
    return null;
  }

  const file = path.join(directory, source);

  if (!fs.existsSync(file)) {
    throw new Error(
      `The contract names '${source}' as ${app}'s client, and ${directory} does not hold it. Either ` +
        'the path in contracts/signalr-contract.json is wrong, or the client moved and the entry was ' +
        'not moved with it.'
    );
  }

  return fs.readFileSync(file, 'utf8');
}

/** Everything a client source says about one hub. */
function callsFor(app: string, source: string): { calls: HubCall[]; paths: string[] } | null {
  const text = clientSource(app, source);

  return text === null ? null : { calls: hubCalls(text), paths: hubPaths(text) };
}

function describeHub(hub: ContractHub): void {
  test.describe(`${hub.name} hub`, () => {
    for (const client of hub.clients) {
      test.describe(client.app, () => {
        /**
         * The half that breaks silently in the client's favour. An invocation SignalR cannot bind is
         * rejected on the server and the returned promise rejects, but these clients invoke without
         * awaiting - so a renamed hub method or one extra argument costs the client every message the
         * group would have carried, with nothing logged and nothing thrown.
         */
        test(`invokes only methods the API declares, with the arguments it declares`, () => {
          const found = callsFor(client.app, client.source);
          requirePrecondition(found, `${client.app}/${client.source} is not checked out.`);

          const declared = new Set(hub.invocations.map((x) => `${x.name}/${x.arguments}`));
          const invoked = [
            ...new Set(found.calls.filter((x) => x.kind === 'invoke').map((x) => `${x.name}/${x.count}`)),
          ].sort();

          // Asserted as a whole set rather than one name at a time so a failure shows the name and the
          // count together: `SetActiveVirtualMachine/2` against a hub that declares `/1` is the bug,
          // and a message that only said the name would look like the method was missing.
          expect(invoked.filter((x) => !declared.has(x))).toEqual([]);
        });

        /**
         * A handler for a message nothing sends is dead code that looks like a feature. The contract
         * records the ones that already exist under `clientListenersWithNoSender`, with a note saying
         * why, so this test is about the ones nobody has decided about yet.
         */
        test(`listens only for messages the API sends`, () => {
          const found = callsFor(client.app, client.source);
          requirePrecondition(found, `${client.app}/${client.source} is not checked out.`);

          const known = new Set([
            ...hub.broadcasts.map((x) => x.name),
            ...hub.clientListenersWithNoSender.map((x) => x.name),
          ]);

          expect(
            [...new Set(found.calls.filter((x) => x.kind === 'on').map((x) => x.name))]
              .filter((x) => !known.has(x))
              .sort()
          ).toEqual([]);
        });

        /**
         * Broadcast arity is one-sided: SignalR drops arguments a handler does not bind, so binding
         * fewer than the API sends is legal and both clients do it deliberately. Binding *more* is not
         * caught anywhere - the extra parameter arrives as `undefined`, and `undefined` is what a
         * half-written feature and a working one look like alike.
         */
        test(`binds no more arguments than the API sends`, () => {
          const found = callsFor(client.app, client.source);
          requirePrecondition(found, `${client.app}/${client.source} is not checked out.`);

          const sent = new Map(hub.broadcasts.map((x) => [x.name, Math.min(...x.arguments)]));
          const overbound = found.calls
            .filter((x) => x.kind === 'on' && sent.has(x.name) && x.count > sent.get(x.name))
            .map((x) => `${x.name} binds ${x.count}, the API sends ${sent.get(x.name)}`)
            .sort();

          // Against the smallest arity a name is ever sent with, not the largest. `VmCreated` goes out
          // with one argument from one handler and two from another, so a client that bound two would
          // see `undefined` for half the VMs it was told about.
          expect(overbound).toEqual([]);
        });

        test(`connects to the hub path the API maps`, () => {
          const found = callsFor(client.app, client.source);
          requirePrecondition(found, `${client.app}/${client.source} is not checked out.`);

          expect(found.paths).toContain(hub.path);
        });
      });
    }

    /**
     * The other direction. A broadcast no client listens for is either a feature that was removed from
     * the UI and left running on the server, or one that was never wired up - and the server-side test
     * cannot tell, because from inside `vm.api` a send that nobody receives looks exactly like a send.
     */
    test(`every message it broadcasts is listened for by some client`, () => {
      const sources = hub.clients.map((x) => callsFor(x.app, x.source));
      requirePrecondition(
        sources.every((x) => x),
        `Not every client of the ${hub.name} hub is checked out.`
      );

      const listened = new Set(
        sources.flatMap((x) => x.calls.filter((c) => c.kind === 'on').map((c) => c.name))
      );

      expect(hub.broadcasts.map((x) => x.name).filter((x) => !listened.has(x))).toEqual([]);
    });

    /**
     * The recorded anomalies stay honest. Each entry under `clientListenersWithNoSender` names the
     * clients that register a handler for a message the API never sends; when one of those handlers is
     * removed - or the API starts sending the message - the entry is stale and should be deleted rather
     * than left as documentation of something that is no longer true.
     */
    for (const listener of hub.clientListenersWithNoSender) {
      test(`the unsent message ${listener.name} is still listened for`, () => {
        const sources = listener.listenedForBy.map((app) => ({
          app,
          found: callsFor(app, hub.clients.find((x) => x.app === app).source),
        }));

        requirePrecondition(
          sources.every((x) => x.found),
          `Not every client listed for ${listener.name} is checked out.`
        );

        expect(
          sources
            .filter((x) => !x.found.calls.some((c) => c.kind === 'on' && c.name === listener.name))
            .map((x) => x.app)
        ).toEqual([]);
      });
    }
  });
}

test.describe('Player VM SignalR contract', () => {
  for (const hub of contract?.hubs ?? []) {
    describeHub(hub);
  }

  /**
   * The `modifiedProperties` argument of `VmUpdated` is a list of property names, and `vm.ui` spends
   * them as `model[x] = vm[x]`. A name that is not a key of the serialized VM assigns `undefined` over
   * a value that was correct a moment ago, so the failure is not a missing update but a field that goes
   * blank when the VM changes. `vm.api` asserts these names are JSON keys of its own DTO; this asserts
   * they are properties of the interface the browser actually indexes.
   */
  test.describe('modifiedProperties', () => {
    test('every name the API can send is a property of the generated Vm interface', () => {
      requirePrecondition(
        contract && allPresent(generatedClientDirectory()),
        'The contract or the generated vm.ui API client is not checked out.'
      );

      const generated = generatedInterfaceProperties('Vm');
      expect(generated, 'the generated client has no Vm interface').not.toBeNull();

      expect(contract.modifiedProperties.names.filter((x) => !generated.includes(x))).toEqual([]);
    });

    /**
     * The keys `modifiedProperties` never names are still keys - they change with the VM, they are just
     * only ever carried by the whole `Vm` the first argument holds. Recorded so that a client author
     * reading the list does not conclude they do not exist, and asserted so the list does not rot.
     */
    test('every key no update ever names is a property of the generated Vm interface', () => {
      requirePrecondition(
        contract && allPresent(generatedClientDirectory()),
        'The contract or the generated vm.ui API client is not checked out.'
      );

      const generated = generatedInterfaceProperties('Vm');
      expect(generated, 'the generated client has no Vm interface').not.toBeNull();

      expect(contract.modifiedProperties.neverSent.keys.filter((x) => !generated.includes(x))).toEqual(
        []
      );
    });
  });

  test('the contract file the API publishes is readable', () => {
    requirePrecondition(contract, `${contractFile} is not checked out.`);

    expect(contract.hubs.length).toBeGreaterThan(0);
  });
});
