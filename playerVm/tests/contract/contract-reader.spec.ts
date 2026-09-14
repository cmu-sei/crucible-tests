// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: playerVm/playerVm-test-plan.md

import { test, expect } from '@playwright/test';
import { OpenApiDocument, hubCalls, openApiSurfaceFrom } from '../../contract-sources';
import { autoProperties, hubMethods, hubSends, mappedHubs, maskCSharp } from '../../api-sources';

/**
 * `hubCalls` reading source it was not given by the app repos.
 *
 * The rest of this directory asserts the app clients against what the API declares, and every one of those
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

/**
 * The same argument, one language over. `api-sources.ts` reads the API's half of the SignalR contract out of
 * C#, because the file `vm.api` used to publish it in is gone, and every assertion in
 * `signalr-contract.spec.ts` is a comparison against what that reader returned.
 *
 * Which makes a short answer the dangerous failure here, not a wrong one: a hub method it does not find is a
 * method no client is checked against, and a broadcast it does not find is a handler nothing validates. The
 * reader is written to throw rather than shorten, so several of the fixtures below assert that it throws.
 */
test.describe('Player VM API source reader', () => {
  test('a hub declares the methods a client can invoke, and nothing else', () => {
    // SignalR dispatches to public instance methods declared on the hub type. Not the constructor, not
    // `static` members, and not `override`s - `OnDisconnectedAsync` is declared on `Hub`, and a client
    // cannot invoke it. A reader that returned any of them would report a client as *missing* calls it
    // was never meant to make.
    const source = `namespace Player.Vm.Api.Features.Vms.Hubs
{
    public class TestHub : Hub
    {
        private readonly IService _service;

        public TestHub(IService service) { _service = service; }

        /// <summary>
        /// Doc comments describe signatures: public Task JoinNothing(Guid viewId) { }
        /// </summary>
        public async Task JoinView(Guid viewId)
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, viewId.ToString());
        }

        public Task SetActiveVirtualMachine(Guid vmId) => Task.CompletedTask;

        private Task Hidden(Guid id) { return Task.CompletedTask; }

        public static Task Helper(Guid id) { return Task.CompletedTask; }

        public override Task OnDisconnectedAsync(Exception exception)
        {
            return base.OnDisconnectedAsync(exception);
        }
    }
}`;

    expect(hubMethods(source, 'TestHub')).toEqual([
      { name: 'JoinView', arguments: 1 },
      { name: 'SetActiveVirtualMachine', arguments: 1 },
    ]);
  });

  test('a CancellationToken parameter is not an argument a client sends', () => {
    // SignalR binds that one from the connection. Counting it would make every client that calls the
    // method look like it was passing one argument too few.
    const source = `public class TestHub : Hub
    {
        public Task JoinVm(Guid vmId, CancellationToken cancellationToken) { return Task.CompletedTask; }
    }`;

    expect(hubMethods(source, 'TestHub')).toEqual([{ name: 'JoinVm', arguments: 1 }]);
  });

  test('a brace inside a string does not end the class body', () => {
    // The reader finds a hub's methods inside the range of its class body, so a `}` the masker leaves in a
    // string closes that body early and every method after it disappears - silently, into a surface that
    // looks smaller than it is. All three of C#'s string forms are here because they fail differently: the
    // verbatim one doubles its quotes instead of escaping them, and the interpolated one holds braces.
    const source = `public class TestHub : Hub
    {
        public Task First(Guid id)
        {
            _logger.LogWarning("unbalanced }");
            _logger.LogWarning($"vm {id} }}");
            _logger.LogWarning(@"say ""hi"" }");
            return Task.CompletedTask;
        }

        public Task Second(Guid id) { return Task.CompletedTask; }
    }`;

    expect(hubMethods(source, 'TestHub')).toEqual([
      { name: 'First', arguments: 1 },
      { name: 'Second', arguments: 1 },
    ]);
  });

  test('a raw string literal stops the reader rather than being misread', () => {
    // `"""` needs its own state in the masker. Reading on without it inverts the quoting of everything
    // after it, and what that produces is not an error - it is a method name read out of what used to be
    // code. `vm.api` has none today; this is the guard for the day it gets one.
    expect(() => maskCSharp('var json = """{ "a": 1 }""";')).toThrow(/raw string literal/);
  });

  test('only a send to Clients is a broadcast, and a trailing token is not an argument', () => {
    // `SendAsync` is also `HttpClient`'s method and a dataflow block's, and `vm.api` calls both. Matching
    // on the name alone reported an outbound webhook as a hub message - a phantom broadcast that fails the
    // "every message is listened for" test with a name no client could ever have handled.
    const source = `public class Handler
    {
        private readonly IHubContext<VmHub> _vmHub;
        private readonly HttpClient _client;

        public async Task Handle(Vm vm, string[] properties, CancellationToken cancellationToken)
        {
            await _client.SendAsync(request, cancellationToken);
            await _vmHub.Clients
                .Group(vm.Id.ToString())
                .SendAsync(VmHubMethods.VmUpdated, vm, properties, cancellationToken);
        }
    }`;

    expect(hubSends(source, new Map([['VmHubMethods.VmUpdated', 'VmUpdated']]))).toEqual([
      { hubType: 'VmHub', name: 'VmUpdated', arguments: 2 },
    ]);
  });

  test('a message named by a parameter is resolved through the calls that pass it', () => {
    // Not generality for its own sake: `VmBaseSignalRHandler.HandleCreateOrUpdate` takes the message name
    // as a `string method` parameter, and it is how both `VmCreated` and `VmUpdated` are sent. A reader
    // without this rule loses the two broadcasts the whole VM list is built on, and every client handler
    // for them goes unchecked.
    const source = `public class Handler
    {
        private readonly IHubContext<VmHub> _vmHub;

        public async Task Created(Vm vm) { await Broadcast(VmHubMethods.VmCreated, vm); }

        public async Task Updated(Vm vm) { await Broadcast("VmUpdated", vm); }

        private async Task Broadcast(string method, Vm vm)
        {
            await _vmHub.Clients.All.SendAsync(method, vm);
        }
    }`;

    expect(hubSends(source, new Map([['VmHubMethods.VmCreated', 'VmCreated']]))).toEqual([
      { hubType: 'VmHub', name: 'VmCreated', arguments: 1 },
      { hubType: 'VmHub', name: 'VmUpdated', arguments: 1 },
    ]);
  });

  test('a message this reader cannot name throws rather than being dropped', () => {
    const source = `public class Handler
    {
        private readonly IHubContext<VmHub> _vmHub;
        private string _method;

        public Task Go(Vm vm) { return _vmHub.Clients.All.SendAsync(_method, vm); }
    }`;

    expect(() => hubSends(source, new Map())).toThrow(/neither a string literal/);
  });

  test('a source naming two hubs throws rather than guessing', () => {
    // Attributing this send by guessing would move a message from one hub's contract to the other's, and
    // both hubs' specs would still pass: the message is listened for somewhere, and nothing checks that it
    // is listened for by a client of the hub it actually goes out on.
    const source = `public class Handler
    {
        private readonly IHubContext<VmHub> _vmHub;
        private readonly IHubContext<ProgressHub> _progressHub;

        public Task Go(Vm vm) { return _vmHub.Clients.All.SendAsync("Something", vm); }
    }`;

    expect(() => hubSends(source, new Map())).toThrow(/more than one hub/);
  });

  test('the tracked properties of an entity are the settable scalars', () => {
    // What Entity Framework reports in `ModifiedProperties`, which is what `VmUpdated` carries. A computed
    // getter cannot be modified and a `virtual` navigation is tracked as a relationship, so neither can
    // ever be sent - and a name in that list the API cannot send fails the modified-properties check on
    // the reader's mistake rather than the application's. A restricted setter is still tracked and counts.
    const source = `public class Vm
    {
        public Guid Id { get; set; }
        public string Name { get; set; }
        public string Url { get; private set; }
        public virtual ICollection<VmTeam> VmTeams { get; set; }
        public static string Kind { get; set; }
        public bool DefaultUrl { get => !string.IsNullOrEmpty(Url); }
        internal string Hidden { get; set; }
    }`;

    expect(autoProperties(source, 'Vm')).toEqual(['Id', 'Name', 'Url']);
  });

  test('the hub paths clients must dial are read from MapHub', () => {
    const source = `app.UseEndpoints(endpoints =>
    {
        endpoints.MapHub<VmHub>("/hubs/vm").RequireAuthorization();
        endpoints.MapHub<ProgressHub>("/hubs/progress").RequireAuthorization();
    });`;

    expect(mappedHubs(source)).toEqual([
      { hubType: 'VmHub', path: '/hubs/vm' },
      { hubType: 'ProgressHub', path: '/hubs/progress' },
    ]);
  });
});

/**
 * The reduction `openapi-surface.spec.ts` compares the generated client against.
 *
 * Kept apart from the fetch so it can be driven from a fixture: the spec that uses it needs a running API,
 * and the shape of this transformation is the part that can be wrong without anyone noticing - an
 * operations map that came out empty passes every comparison built on it.
 */
test.describe('Player VM OpenAPI surface', () => {
  /**
   * A path item holds keys that are not operations - `parameters`, `summary`, `$ref` - so the fixture has
   * one, and the type assertion is there because a real document is looser than the type this reader
   * declares for the parts it uses.
   */
  const document = {
    paths: {
      '/api/vms/{id}': {
        get: { operationId: 'getVm', tags: ['Vm'] },
        delete: { operationId: 'deleteVm', tags: ['Vm'] },
        parameters: [{ name: 'id', in: 'path' }],
      },
      '/api/vms': { post: { operationId: 'createVm' } },
    },
    components: {
      schemas: {
        Vm: { type: 'object', properties: { id: {}, name: {} } },
        PowerState: { type: 'string', enum: ['on', 'off'] },
        Level: { type: 'integer', enum: [0, 1] },
        Uuid: { type: 'string', format: 'uuid' },
      },
    },
  } as unknown as OpenApiDocument;

  test('every operation is keyed by method and route, and nothing else in a path item is', () => {
    expect(openApiSurfaceFrom(document).operations).toEqual({
      'GET /api/vms/{id}': { operationId: 'getVm', tags: ['Vm'] },
      'DELETE /api/vms/{id}': { operationId: 'deleteVm', tags: ['Vm'] },
      // An untagged operation is generated onto no service at all, which the spec reports rather than
      // skipping - so it has to arrive here with an empty tag list rather than not arriving.
      'POST /api/vms': { operationId: 'createVm', tags: [] },
    });
  });

  test('a schema is read as an object, an enum, or neither', () => {
    expect(openApiSurfaceFrom(document).schemas).toEqual({
      Vm: { properties: ['id', 'name'], values: null },
      PowerState: { properties: null, values: ['on', 'off'] },
      // As strings, because a union type of string literals is what the generator emits either way.
      Level: { properties: null, values: ['0', '1'] },
      // A formatted scalar is neither, and the spec compares it against neither: `Uuid` becomes a type
      // alias, with no properties to drift and no values to add.
      Uuid: { properties: null, values: null },
    });
  });
});
