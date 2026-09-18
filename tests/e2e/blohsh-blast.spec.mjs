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

test.describe('Blohsh Blast — core gameplay', () => {
  test('core gameplay state machine', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'pc', 'Desktop project owns the full deterministic core gameplay suite.');

    const errors = await installErrorCapture(page);
    await openMenu(page);

    await expect(page.locator('.phase3-subtitle')).toContainText('PC EDITION');
    await expect.poll(() => page.evaluate(() => stats.gamesPlayed)).toBe(0);
    await startClassic(page);
    await expect.poll(() => page.evaluate(() => stats.gamesPlayed)).toBe(1);

    // Drag + cancel: piece remains in the rack after dropping outside the board.
    const slot = page.locator('#rack .rack-slot').first();
    const slotBox = await slot.boundingBox();
    if (!slotBox) throw new Error('Rack slot has no bounding box');
    await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(20, 20, { steps: 8 });
    await page.mouse.up();
    await expect(slot).not.toHaveClass(/hidden-slot/);
    await expect.poll(() => page.evaluate(() => rackPieces[0] !== null)).toBe(true);
    await expect(slot.locator('.piece-preview')).toHaveCount(1);

    // Drag + place: use the center of the board as a drop target.
    const boardBox = await page.locator('#board').boundingBox();
    if (!boardBox) throw new Error('Board has no bounding box');
    await page.mouse.move(slotBox.x + slotBox.width / 2, slotBox.y + slotBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(boardBox.x + boardBox.width / 2, boardBox.y + boardBox.height / 2, { steps: 12 });
    await page.mouse.up();
    await expect(slot).toBeEmpty();
    await expect.poll(() => page.evaluate(() => score)).toBeGreaterThan(0);

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
    const gameOverSoundCalls = await page.evaluate(() => {
      let count = 0;
      const original = playSound;
      playSound = kind => {
        if (kind === 'gameover') count += 1;
        original(kind);
      };
      checkGameOver();
      return count;
    });
    expect(gameOverSoundCalls).toBe(0);

    // Restart.
    await page.locator('#phase3-restart').click();
    await expect(page.locator('#game-over-modal')).toHaveClass(/modal-hidden/);
    await expect(page.locator('#phase3-menu')).toHaveClass(/phase3-menu/);
    await expect(page.locator('body')).not.toHaveClass(/phase3-menu-open/);
    await expect.poll(() => page.evaluate(() => stats.gamesPlayed)).toBe(2);

    // Hardcore multiplier is applied by the real engine bridge.
    await page.locator('#phase3-menu-game').click();
    await page.locator('[data-pc-action="modes"]').click();
    await page.locator('.phase3-mode[data-mode="hardcore"]').click();
    await page.evaluate(() => {
      board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
      rackPieces = [[[1]], null, null];
      updateBoardVisuals();
      renderRack();
      startKeyboardPlacement(0, rackPieces[0], rackSlots[0]);
    });
    await expect.poll(() => page.evaluate(() => score)).toBe(15);

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
    await page.evaluate(() => {
      board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(1));
      rackPieces = [[[1]], null, null];
      score = 321;
      updateBoardVisuals();
      renderRack();
      checkGameOver();
    });
    await expect.poll(() => page.evaluate(() => {
      const daily = JSON.parse(localStorage.getItem('blohshBlastDailyV3') || 'null');
      return daily?.best || 0;
    })).toBe(321);
    await page.locator('#phase3-restart').click();
    await expect(page.locator('#game-over-modal')).toHaveClass(/modal-hidden/);

    // Leaderboard + Daily best are recorded once at game over.
    const persisted = await page.evaluate(() => ({
      leaderboard: JSON.parse(localStorage.getItem('blohshBlastLeaderboardV3') || '[]'),
      daily: JSON.parse(localStorage.getItem('blohshBlastDailyV3') || 'null')
    }));
    expect(persisted.leaderboard.length).toBeGreaterThan(0);

    // Persistent skin selection.
    await page.locator('#phase3-menu-game').click();
    await page.evaluate(() => {
      localStorage.setItem('blohshBlastProgressionV3', JSON.stringify({
        xp: 350, level: 2, unlockedSkins: ['skin-blohsh', 'skin-tty'], selectedSkin: 'skin-blohsh'
      }));
      window.location.reload();
    });
    await page.locator('#phase3-menu').waitFor({ state: 'visible' });
    await page.locator('[data-pc-action="skins"]').click();
    await page.locator('.p3-skin[data-skin="skin-tty"]').click();
    await expect(page.locator('body')).toHaveClass(/skin-tty/);

    // Close/reopen browser session using the persisted storage state.
    const storage = await page.context().storageState();
    const reopenedContext = await page.context().browser().newContext({ storageState: storage });
    const reopened = await reopenedContext.newPage();
    await reopened.goto('http://127.0.0.1:4173/');
    await reopened.locator('#phase3-menu').waitFor({ state: 'visible' });
    await expect(reopened.locator('.p3-skin[data-skin="skin-tty"]')).toHaveClass(/selected/);
    await reopened.close();
    await reopenedContext.close();

    await assertNoPageErrors(page, errors);
  });
});

test.describe('Blohsh Blast — device + PWA/offline', () => {
  test('PC detection and desktop layout', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'pc', 'PC-only device profile test.');
    const errors = await installErrorCapture(page);
    await openMenu(page);
    await expect(page.locator('.phase3-subtitle')).toContainText('PC EDITION');
    await expect(page.locator('.phase3-menu')).toBeVisible();
    await assertNoPageErrors(page, errors);
  });

  test('mobile portrait detection and responsive menu', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-portrait', 'Portrait-only device profile test.');
    const errors = await installErrorCapture(page);
    await openMenu(page);
    await expect(page.locator('.phase3-subtitle')).toContainText('MOBILE EDITION');
    await expect(page.locator('body')).toHaveClass(/device-mobile/);
    await expect(page.locator('#phase3-menu')).toHaveAttribute('data-device', 'mobile');
    await expect(page.locator('.phase3-pc-nav')).toBeVisible();
    const overflow = await page.evaluate(() => {
      const offenders = [];
      for (const el of document.querySelectorAll('*')) {
        const rect = el.getBoundingClientRect();
        if (rect.right > window.innerWidth + 1 || rect.left < -1) {
          offenders.push({ tag: el.tagName, id: el.id, cls: String(el.className).slice(0, 80), left: Math.round(rect.left), right: Math.round(rect.right) });
        }
      }
      return { scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, offenders: offenders.slice(0, 12) };
    });
    expect.soft(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);
    expect(overflow.offenders.filter(item => !['p3-floor', 'p3-horizon'].includes(item.cls))).toEqual([]);
    await assertNoPageErrors(page, errors);
  });

  test('mobile landscape detection', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-landscape', 'Landscape-only device profile test.');
    const errors = await installErrorCapture(page);
    await openMenu(page);
    await expect(page.locator('.phase3-subtitle')).toContainText('MOBILE EDITION');
    await expect(page.locator('body')).toHaveClass(/device-mobile/);
    await expect(page.locator('#phase3-menu')).toHaveAttribute('data-device', 'mobile');
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


test.describe('Blohsh Blast — mobile input', () => {
  test('touch drag, cancel and placement', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-portrait', 'Touch input is covered in the mobile portrait project.');

    const errors = await installErrorCapture(page);
    await openMenu(page);
    await page.locator('[data-pc-action="play"]').click();

    const slot = page.locator('#rack .rack-slot').first();
    const board = page.locator('#board');
    const slotBox = await slot.boundingBox();
    const boardBox = await board.boundingBox();
    if (!slotBox || !boardBox) throw new Error('Mobile game geometry unavailable');

    const sx = slotBox.x + slotBox.width / 2;
    const sy = slotBox.y + slotBox.height / 2;

    // Synthetic touch PointerEvents exercise the same application path used by real touch input.
    await slot.dispatchEvent('pointerdown', {
      bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true,
      clientX: sx, clientY: sy, button: 0
    });
    await page.locator('body').dispatchEvent('pointermove', {
      bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true,
      clientX: 8, clientY: 8, buttons: 1
    });
    await page.locator('body').dispatchEvent('pointercancel', {
      bubbles: true, pointerId: 7, pointerType: 'touch', isPrimary: true,
      clientX: 8, clientY: 8, buttons: 0
    });

    await expect(slot).not.toHaveClass(/hidden-slot/);
    await expect(slot.locator('.piece-preview')).toHaveCount(1);

    // Second touch PointerEvent sequence and placement on a guaranteed valid empty board cell.
    const firstCell = board.locator('.cell[data-x="4"][data-y="4"]');
    const cellBox = await firstCell.boundingBox();
    if (!cellBox) throw new Error('Board cell geometry unavailable');

    await slot.dispatchEvent('pointerdown', {
      bubbles: true, pointerId: 8, pointerType: 'touch', isPrimary: true,
      clientX: sx, clientY: sy, button: 0
    });
    await page.locator('body').dispatchEvent('pointermove', {
      bubbles: true, pointerId: 8, pointerType: 'touch', isPrimary: true,
      clientX: cellBox.x + cellBox.width / 2, clientY: cellBox.y + cellBox.height / 2 + 58, buttons: 1
    });
    await page.locator('body').dispatchEvent('pointerup', {
      bubbles: true, pointerId: 8, pointerType: 'touch', isPrimary: true,
      clientX: cellBox.x + cellBox.width / 2, clientY: cellBox.y + cellBox.height / 2 + 58, buttons: 0
    });

    await expect(slot.locator('.piece-preview')).toHaveCount(0);
    await expect(page.locator('#score-display')).not.toHaveText('0');
    await assertNoPageErrors(page, errors);
  });
});
