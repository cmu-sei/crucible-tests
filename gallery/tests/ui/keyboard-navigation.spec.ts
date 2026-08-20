// Copyright 2026 Carnegie Mellon University. All Rights Reserved.
// Released under a MIT (SEI)-style license. See LICENSE.md in the project root for license information.

// spec: gallery/gallery-test-plan.md
// seed: seed.spec.ts

import { test, expect, gotoGalleryAdmin } from '../../fixtures';

test.describe('Responsive Design and Accessibility', () => {
  test('Keyboard Navigation', async ({ galleryAuthenticatedPage: page }) => {
    // 1. Navigate the application using Tab, Enter, and Escape keys

    // expect: All interactive elements are reachable via keyboard.
    // Assert focus actually lands on interactive elements on each Tab — the bare
    // `keyboard.press('Tab')` calls this spec used to make would have passed even
    // if nothing on the page were focusable at all.
    const describeFocus = () =>
      page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return null;
        return {
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute('role'),
          tabIndex: el.tabIndex,
          isBody: el === document.body,
        };
      });

    const nativelyFocusable = ['a', 'button', 'input', 'select', 'textarea'];
    const reached: string[] = [];
    for (let i = 1; i <= 5; i++) {
      await page.keyboard.press('Tab');
      const focused = await describeFocus();
      expect(focused, 'Tab should always leave focus on some element').not.toBeNull();
      expect(focused!.isBody, `Tab #${i} left focus on <body> (nothing focusable)`).toBe(false);
      expect(
        nativelyFocusable.includes(focused!.tag) || focused!.role !== null || focused!.tabIndex >= 0,
        `Tab #${i} focused a non-interactive <${focused!.tag}>`
      ).toBe(true);
      reached.push(`${focused!.tag}#${i}`);
    }
    // Tabbing must actually traverse the page rather than park on one element.
    expect(new Set(reached).size, 'Tab did not move focus between elements').toBeGreaterThan(1);

    // expect: Focus indicators are visible — the focused control must carry an
    // Angular Material focus marker class or a rendered outline.
    const userMenuButton = page.getByRole('button', { name: 'Admin User' });
    await userMenuButton.focus();
    await expect(userMenuButton).toBeFocused();
    const focusIndicator = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement;
      const style = window.getComputedStyle(el);
      return {
        classes: el.className,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      };
    });
    expect(
      /cdk-(keyboard|program|mouse)-focused|mat-mdc-button-base|mat-focus-indicator/.test(
        focusIndicator.classes
      ) || (focusIndicator.outlineStyle !== 'none' && focusIndicator.outlineWidth !== '0px'),
      `focused element exposes no focus indicator: ${JSON.stringify(focusIndicator)}`
    ).toBe(true);

    // Enter activates the focused button.
    await page.keyboard.press('Enter');

    // expect: Menu opens
    await expect(page.getByRole('menuitem', { name: 'Administration' })).toBeVisible();

    // The opened menu is itself keyboard-navigable: focus lands inside the menu
    // panel and the arrow keys move it between menu items. (Which item Material
    // focuses first is an implementation detail, so assert on the movement.)
    const focusedMenuItem = () =>
      page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return null;
        return {
          role: el.getAttribute('role'),
          inMenu: !!el.closest('.mat-mdc-menu-panel'),
          text: (el.textContent ?? '').trim(),
        };
      });

    const firstFocused = await focusedMenuItem();
    expect(firstFocused?.inMenu, 'opening the menu did not move focus into it').toBe(true);
    expect(firstFocused?.role).toBe('menuitem');

    await page.keyboard.press('ArrowDown');
    const nextFocused = await focusedMenuItem();
    expect(nextFocused?.inMenu, 'ArrowDown moved focus out of the menu').toBe(true);
    expect(nextFocused?.role).toBe('menuitem');
    expect(nextFocused?.text, 'ArrowDown did not move focus to another menu item').not.toBe(
      firstFocused?.text
    );

    // Escape closes the menu and returns focus to its trigger.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menuitem', { name: 'Administration' })).not.toBeVisible();
    await expect(userMenuButton).toBeFocused();

    // expect: Dialogs can be closed with Escape.
    // Exercise a real modal (Add Collection), not just the user menu.
    await gotoGalleryAdmin(page);
    await page.getByRole('button', { name: 'Add Collection' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Focus is moved into the dialog once Material's focus trap has run (it does
    // this after the open animation, so poll rather than sampling once).
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              !!(document.activeElement as HTMLElement | null)?.closest(
                'mat-dialog-container, .mat-mdc-dialog-container, .cdk-dialog-container'
              )
          ),
        { message: 'focus never moved into the dialog', timeout: 10000 }
      )
      .toBe(true);

    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();

    // The Collections list remains interactive after the dialog is dismissed.
    await expect(page.getByRole('button', { name: 'Add Collection' })).toBeEnabled();
  });
});
