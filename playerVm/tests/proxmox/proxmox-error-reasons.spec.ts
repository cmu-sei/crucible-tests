// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: playerVm/playerVm-test-plan.md
// seed: seed.spec.ts

import { test, expect, PLAYERVM_THEMES } from '../../fixtures';
import { Services, requirePrecondition } from '../../../shared-fixtures';
import {
  getProxmoxVm,
  postProxmoxAction,
  requireProxmoxConsoleVm,
  ProxmoxConsoleVm,
} from '../../vm-helpers';

/**
 * The VM API's Proxmox endpoints, against a live Proxmox VM: the state the
 * console gates its options bar on, and the 400s that replaced the 500s a
 * refused or failed Proxmox request used to produce. Each error carries the
 * reason in the ProblemDetails `title`, phrased with the console's own label
 * ("Power On failed: ...") so the console can show it as it is.
 *
 * Every request here is one that the API or Proxmox refuses, so the VM is not
 * changed: a snapshot name the API rejects before calling Proxmox, a revert to a
 * snapshot that doesn't exist, and Power On on a VM that is already running.
 * There is deliberately no "revert to the current snapshot" case: on a VM that
 * has a snapshot that request would succeed and roll the machine back.
 *
 * API-only, so the theme changes nothing but the describe title; it is wrapped
 * like every Player VM spec.
 */

// These hit a real VM, so one browser project is enough.
test.skip(({ browserName }) => browserName !== 'chromium', 'live-VM test; runs on one project only');

for (const theme of PLAYERVM_THEMES) {
  test.describe(`${theme} theme › Proxmox API error reasons`, () => {
    let vm: ProxmoxConsoleVm;

    test.beforeEach(async () => {
      vm = await requireProxmoxConsoleVm();
    });

    test('Proxmox VM state reports what the console gates on', async () => {
      // guestAgentRunning, hasSnapshot, currentSnapshot and vncClipboardEnabled
      // come from the VM config call the API already makes, and the console reads
      // them to enable or disable Files, Snapshots and Copy.
      const r = await getProxmoxVm(vm.token, vm.record.id);
      expect(r.status).toBe(200);
      expect(r.data.id).toBe(vm.record.id);
      expect(typeof r.data.guestAgentRunning).toBe('boolean');
      expect(typeof r.data.hasSnapshot).toBe('boolean');
      expect(typeof r.data.vncClipboardEnabled).toBe('boolean');
      expect(typeof r.data.canMountIso).toBe('boolean');
      // A current snapshot is named exactly when there is one.
      if (r.data.hasSnapshot) {
        expect(typeof r.data.currentSnapshot).toBe('string');
      } else {
        expect(r.data.currentSnapshot).toBeNull();
      }
    });

    test('A snapshot named "current" is refused before it reaches Proxmox', async () => {
      // "current" is PVE's pseudo-snapshot for the running state. The API rejects
      // it itself, so no snapshot is taken.
      const r = await postProxmoxAction(vm.token, vm.record.id, 'snapshots', { snapshotName: 'current' });
      expect(r.status).toBe(400);
      expect(r.data?.title).toBe('"current" is reserved by Proxmox and cannot be used as a snapshot name.');
    });

    test("A snapshot name outside PVE's naming rule is refused with the rule", async () => {
      // PVE wants 2-40 characters starting with a letter; this one starts with a
      // digit. Checked by the API before calling Proxmox, so nothing is created.
      const r = await postProxmoxAction(vm.token, vm.record.id, 'snapshots', { snapshotName: '1e2e' });
      expect(r.status).toBe(400);
      expect(r.data?.title).toBe(
        'A snapshot name must be 2 to 40 characters, start with a letter, and contain only letters, digits, hyphens and underscores.'
      );
    });

    test("Reverting to a snapshot that doesn't exist returns Proxmox's reason", async () => {
      // A name no one would take, so Proxmox is sure to refuse the rollback.
      const name = `e2e-missing-${Date.now()}`;
      const r = await postProxmoxAction(vm.token, vm.record.id, `snapshots/${name}/revert`);
      expect(r.status).toBe(400);
      expect(r.data?.title).toBe(`Revert to Snapshot failed: snapshot '${name}' does not exist`);
    });

    test("Power On on a running VM returns Proxmox's reason as a 400", async () => {
      // requireProxmoxConsoleVm has checked the VM is on, so Proxmox refuses this
      // and the machine is untouched.
      const r = await postProxmoxAction(vm.token, vm.record.id, 'power-on');
      expect(r.status).toBe(400);
      expect(r.data?.title).toBe(`Power On failed: VM ${vm.target.id} already running`);
    });

    test('Download File without a guest agent is a 400 that says why', async ({ request }) => {
      // The guest agent is the VM's config, not something a test can switch, so
      // this needs a VM without one running.
      requirePrecondition(
        !vm.state.guestAgentRunning,
        `Proxmox VM ${vm.target.id} has a QEMU guest agent running, so a download would succeed`
      );
      const base = Services.PlayerVM.API.replace(/\/$/, '');
      const path = '/etc/hostname';
      const res = await request.get(
        `${base}/api/vms/proxmox/${vm.record.id}/actions/download-file?path=${encodeURIComponent(path)}`,
        { headers: { Authorization: `Bearer ${vm.token}` } }
      );
      expect(res.status()).toBe(400);
      const body = await res.json();
      expect(body.title).toMatch(new RegExp(`^Could not read ${path} from the virtual machine: .+`));
    });
  });
}
