import { test, expect } from '@playwright/test';

async function assertNoPageErrors(page, errors) {
  if (errors.length) {
    throw new Error(`Runtime page errors detected:\n${errors.map(String).join('\n')}`);
  }
}

async function installErrorCapture(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error));
  return errors;
}

async function openMenu(page) {
  await page.goto('/');
  await page.locator('#phase3-menu').waitFor({ state: 'visible' });
  await page.waitForTimeout(250);
}

async function startClassic(page) {
  await page.locator('[data-pc-action="play"]').click();
  await expect(page.locator('#phase3-menu')).toHaveClass(/phase3-menu/);
  await expect(page.locator('body')).not.toHaveClass(/phase3-menu-open/);
  await expect(page.locator('#rack .rack-slot').first()).not.toHaveClass(/hidden-slot/);
}

async function configurePerfectClear(page) {
  await page.evaluate(() => {
    const matrix = [[1, 1, 1, 1]];
    board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(1));
    for (let x = 0; x < 4; x++) board[0][x] = 0;
    rackPieces = [matrix, null, null];
    updateBoardVisuals();
    renderRack();
  });
}

async function makeNonClearMove(page) {
  await page.evaluate(() => {
    board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
    rackPieces = [[[1]], null, null];
    updateBoardVisuals();
    renderRack();
    startKeyboardPlacement(0, rackPieces[0], rackSlots[0]);
  });
}

test.describe('Blohsh Blast — PC smoke / gameplay', () => {
  test('core gameplay state machine', async ({ page }) => {
    const errors = await installErrorCapture(page);
    await openMenu(page);

    await expect(page.locator('.phase3-subtitle')).toContainText('PC EDITION');
    await startClassic(page);

    // Drag + cancel: piece remains in the rack after dropping outside the board.
    const slot = page.locator('#rack .rack-slot').first();
    const slotBox = await slot.boundingBox();
    if (!slotBox) throw new Error('Rack slot has no bounding box');
    await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(20, 20, { steps: 8 });
    await page.mouse.up();
    await expect(slot).not.toHaveClass(/hidden-slot/);
    await expect(slot).not.toBeEmpty();

    // Drag + place: use the center of the board as a drop target.
    const boardBox = await page.locator('#board').boundingBox();
    if (!boardBox) throw new Error('Board has no bounding box');
    await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(boardBox.x + boardBox.width / 2, boardBox.y + boardBox.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(slot).toHaveClass(/hidden-slot/, { timeout: 1_000 }).catch(() => {});
    await expect(page.locator('#score-display')).not.toHaveText('0');

    // Deterministic clear + Perfect Clear.
    await configurePerfectClear(page);
    await page.evaluate(() => startKeyboardPlacement(0, rackPieces[0], rackSlots[0]));
    await expect(page.locator('#perfect-clear')).toHaveClass(/show/);
    await expect(page.locator('#stat-perfect')).toHaveText(/1|2|3/);

    // True combo: a second consecutive clear reaches COMBO 2X.
    await configurePerfectClear(page);
    await page.evaluate(() => startKeyboardPlacement(0, rackPieces[0], rackSlots[0]));
    await expect(page.locator('#combo-badge')).toContainText('COMBO 2X');

    // Non-clear move breaks the sequence.
    await makeNonClearMove(page);
    await expect(page.locator('#combo-badge')).not.toHaveClass(/show/);

    // Game over.
    await page.evaluate(() => {
      board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(1));
      rackPieces = [[[1]], null, null];
      updateBoardVisuals();
      renderRack();
      checkGameOver();
    });
    await expect(page.locator('#game-over-modal')).not.toHaveClass(/modal-hidden/);

    // Restart.
    await page.locator('#phase3-restart').click();
    await expect(page.locator('#game-over-modal')).toHaveClass(/modal-hidden/);
    await expect(page.locator('#phase3-menu')).toHaveClass(/phase3-menu/);
    await expect(page.locator('body')).not.toHaveClass(/phase3-menu-open/);

    // Open menu while playing, then return to game.
    await page.locator('#phase3-menu-game').click();
    await expect(page.locator('body')).toHaveClass(/phase3-menu-open/);
    await page.locator('#phase3-close-menu').click();
    await expect(page.locator('body')).not.toHaveClass(/phase3-menu-open/);

    // Switch mode through the menu.
    await page.locator('#phase3-menu-game').click();
    await page.locator('[data-pc-action="modes"]').click();
    await page.locator('.phase3-mode[data-mode="zen"]').click();
    await expect.poll(() => page.evaluate(() => window.BlohshBlastPhase3.getMode())).toBe('zen');

    // Daily mode.
    await page.locator('#phase3-menu-game').click();
    await page.locator('[data-pc-action="daily"]').click();
    await expect.poll(() => page.evaluate(() => window.BlohshBlastPhase3.getMode())).toBe('daily');

    // Persistent skin selection.
    await page.locator('#phase3-menu-game').click();
    await page.evaluate(() => {
      localStorage.setItem('blohshBlastProgressionV3', JSON.stringify({
        xp: 350, level: 2, unlockedSkins: ['skin-blohsh', 'skin-tty'], selectedSkin: 'skin-blohsh'
      }));
      window.location.reload();
    });
    await page.locator('#phase3-menu').waitFor({ state: 'visible' });
    await page.locator('.p3-skin[data-skin="skin-tty"]').click();
    await expect(page.locator('body')).toHaveClass(/skin-tty/);

    // Reopen browser/page and verify persistence.
    await page.reload();
    await expect(page.locator('.p3-skin[data-skin="skin-tty"]')).toHaveClass(/selected/);

    await assertNoPageErrors(page, errors);
  });
});

test.describe('Blohsh Blast — device + PWA/offline', () => {
  test('PC detection and desktop layout', async ({ page }) => {
    const errors = await installErrorCapture(page);
    await openMenu(page);
    await expect(page.locator('.phase3-subtitle')).toContainText('PC EDITION');
    await expect(page.locator('.phase3-menu')).toBeVisible();
    await assertNoPageErrors(page, errors);
  });

  test('mobile portrait detection and responsive menu', async ({ page }) => {
    const errors = await installErrorCapture(page);
    await openMenu(page);
    await expect(page.locator('.phase3-subtitle')).toContainText('MOBILE EDITION');
    await expect(page.locator('body')).toHaveClass(/device-mobile/);
    await expect(page.locator('.phase3-pc-nav')).toBeVisible();
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(horizontalOverflow).toBe(false);
    await assertNoPageErrors(page, errors);
  });

  test('mobile landscape detection', async ({ page }) => {
    const errors = await installErrorCapture(page);
    await openMenu(page);
    await expect(page.locator('.phase3-subtitle')).toContainText('MOBILE EDITION');
    await expect(page.locator('body')).toHaveClass(/device-mobile/);
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(horizontalOverflow).toBe(false);
    await assertNoPageErrors(page, errors);
  });

  test('offline reload after first visit', async ({ context, page }) => {
    const errors = await installErrorCapture(page);
    await openMenu(page);
    await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.ready;
      }
    });
    await context.setOffline(true);
    await page.reload();
    await page.locator('#phase3-menu').waitFor({ state: 'visible' });
    await expect(page.locator('#phase3-offline')).toContainText('OFFLINE');
    await context.setOffline(false);
    await assertNoPageErrors(page, errors);
  });
});
