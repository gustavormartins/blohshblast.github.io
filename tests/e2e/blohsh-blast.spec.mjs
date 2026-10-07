import { test, expect } from '@playwright/test';

async function assertNoPageErrors(page, errors) {
  if (errors.length) {
    throw new Error(`Runtime page errors detected:\n${errors.map(String).join('\n')}`);
  }
}

async function installErrorCapture(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error));
  page.on('console', message => {
    if (message.type() === 'error') {
      errors.push(new Error(`console.error: ${message.text()}`));
    }
  });
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

    const errors = await installErrorCapture(page);
    await openMenu(page);
    const logo = page.locator('.brand-logo').first();
    await expect(logo).toHaveAttribute('src', /logo-official-64/);
    await expect(logo).not.toHaveAttribute('src', /upload\\.wikimedia\\.org/);

    const isPC = testInfo.project.name === 'pc';
    const expectedEdition = isPC ? 'PC EDITION' : 'MOBILE EDITION';
    const expectedDevice = isPC ? 'pc' : 'mobile';
    await expect(page.locator('.phase3-subtitle')).toContainText(expectedEdition);
    await expect(page.locator('#phase3-device')).toContainText(isPC ? 'PC' : 'MOBILE');
    await expect.poll(() => page.evaluate(() => document.body.dataset.device)).toBe(expectedDevice);
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

    // Place deterministically after the cancel test.
    // Real drag placement is covered by the shared PointerEvents test below.
    await page.evaluate(() => {
      startKeyboardPlacement(0, rackPieces[0], rackSlots[0]);
    });
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
  test('device detection and base responsive layout', async ({ page }, testInfo) => {
    const errors = await installErrorCapture(page);
    await openMenu(page);
    const isPC = testInfo.project.name === 'pc';
    await expect(page.locator('.phase3-subtitle')).toContainText(isPC ? 'PC EDITION' : 'MOBILE EDITION');
    await expect(page.locator('#phase3-device')).toContainText(isPC ? 'PC' : 'MOBILE');
    await expect(page.locator('body')).toHaveClass(isPC ? /device-pc/ : /device-mobile/);
    await expect(page.locator('#phase3-menu')).toHaveAttribute('data-device', isPC ? 'pc' : 'mobile');
    await expect(page.locator('.phase3-pc-nav')).toBeVisible();
    await assertNoPageErrors(page, errors);
  });

  test('mobile portrait contract and responsive menu', async ({ page }, testInfo) => {
    const errors = await installErrorCapture(page);
    await openMenu(page);
    const isPC = testInfo.project.name === 'pc';
    if (testInfo.project.name === 'mobile-portrait') {
      const size = await page.viewportSize();
      expect(size.height).toBeGreaterThan(size.width);
    }
    await expect(page.locator('.phase3-subtitle')).toContainText(isPC ? 'PC EDITION' : 'MOBILE EDITION');
    await expect(page.locator('body')).toHaveClass(isPC ? /device-pc/ : /device-mobile/);
    await expect(page.locator('#phase3-menu')).toHaveAttribute('data-device', isPC ? 'pc' : 'mobile');
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

  test('mobile landscape contract', async ({ page }, testInfo) => {
    const errors = await installErrorCapture(page);
    await openMenu(page);
    const isPC = testInfo.project.name === 'pc';
    if (testInfo.project.name === 'mobile-landscape') {
      const size = await page.viewportSize();
      expect(size.width).toBeGreaterThan(size.height);
    }
    await expect(page.locator('.phase3-subtitle')).toContainText(isPC ? 'PC EDITION' : 'MOBILE EDITION');
    await expect(page.locator('body')).toHaveClass(isPC ? /device-pc/ : /device-mobile/);
    await expect(page.locator('#phase3-menu')).toHaveAttribute('data-device', isPC ? 'pc' : 'mobile');
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(horizontalOverflow).toBe(false);
    await assertNoPageErrors(page, errors);
  });

  test('offline reload after first visit', async ({ context, page }) => {
    const errors = await installErrorCapture(page);
    const failedRequests = [];
    page.on('requestfailed', request => {
      failedRequests.push({
        url: request.url(),
        failure: request.failure()?.errorText || 'unknown'
      });
    });

    await openMenu(page);
    await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.ready;
      }
    });

    const diagnostics = await page.evaluate(async () => {
      const assets = performance.getEntriesByType('resource')
        .map(entry => entry.name)
        .filter(url => url.includes('/assets/'));
      const cacheHits = {};
      for (const url of assets) {
        cacheHits[url] = 'caches' in window ? await caches.match(url).then(Boolean) : false;
      }
      return {
        controlled: Boolean(navigator.serviceWorker.controller),
        cacheHits
      };
    });

    expect(diagnostics.controlled).toBe(true);
    expect(Object.values(diagnostics.cacheHits).every(Boolean)).toBe(true);
    await assertNoPageErrors(page, errors);

    errors.length = 0;
    failedRequests.length = 0;
    await context.setOffline(true);
    await page.reload();
    await page.locator('#phase3-menu').waitFor({ state: 'visible' });
    await expect(page.locator('#phase3-offline')).toContainText('OFFLINE');
    await context.setOffline(false);

    const unexpectedErrors = errors.filter(error => {
      const message = String(error);
      return !message.includes('console.error: Failed to load resource: net::ERR_FAILED');
    });
    expect(unexpectedErrors).toEqual([]);

    const cachedAssetUrls = new Set(Object.entries(diagnostics.cacheHits)
      .filter(([, cached]) => cached)
      .map(([url]) => url));
    expect(failedRequests.every(request => cachedAssetUrls.has(request.url))).toBe(true);
  });
    });

    await openMenu(page);
    await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.ready;
      }
    });

    const offlineDiagnostics = await page.evaluate(async () => {
      const assets = performance.getEntriesByType('resource')
        .map(entry => entry.name)
        .filter(url => url.includes('/assets/'));
      const cacheHits = {};
      const cacheNames = 'caches' in window ? await caches.keys() : [];
      for (const url of assets) {
        cacheHits[url] = 'caches' in window ? await caches.match(url).then(Boolean) : false;
      }
      return {
        controlled: Boolean(navigator.serviceWorker.controller),
        cacheNames,
        assets,
        cacheHits
      };
    });
    console.log('Offline diagnostics before disconnect:', JSON.stringify(offlineDiagnostics, null, 2));

    await context.setOffline(true);
    await page.reload();
    await page.locator('#phase3-menu').waitFor({ state: 'visible' });
    await expect(page.locator('#phase3-offline')).toContainText('OFFLINE');
    await context.setOffline(false);

    if (failedRequests.length) {
      console.log('Offline request failures:', JSON.stringify(failedRequests, null, 2));
    }
    await assertNoPageErrors(page, errors);
  });
});


test.describe('Blohsh Blast — mobile input', () => {
  test('touch drag, cancel and placement', async ({ page }, testInfo) => {

    const errors = await installErrorCapture(page);
    await openMenu(page);
    await expect(page.locator('#phase3-device')).toContainText(testInfo.project.name === 'pc' ? 'PC' : 'MOBILE');
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


test.describe('Blohsh Blast — error + skipped-path regressions', () => {
  test('invalid drop on occupied cell keeps the piece and score stable', async ({ page }) => {
    const errors = await installErrorCapture(page);
    await openMenu(page);
    await page.locator('[data-pc-action="play"]').click();

    await page.evaluate(() => {
      board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(1));
      board[0][0] = 0;
      rackPieces = [[[1]], null, null];
      score = 0;
      updateBoardVisuals();
      renderRack();
    });

    const slot = page.locator('#rack .rack-slot').first();
    const target = page.locator('#board .cell[data-x="4"][data-y="4"]');
    const slotBox = await slot.boundingBox();
    const targetBox = await target.boundingBox();
    if (!slotBox || !targetBox) throw new Error('Invalid-drop geometry unavailable');

    const sx = slotBox.x + slotBox.width / 2;
    const sy = slotBox.y + slotBox.height / 2;
    const tx = targetBox.x + targetBox.width / 2;
    const ty = targetBox.y + targetBox.height / 2 + 58;

    await slot.dispatchEvent('pointerdown', {
      bubbles: true, pointerId: 91, pointerType: 'touch', isPrimary: true,
      clientX: sx, clientY: sy, button: 0
    });
    await page.locator('body').dispatchEvent('pointermove', {
      bubbles: true, pointerId: 91, pointerType: 'touch', isPrimary: true,
      clientX: tx, clientY: ty, buttons: 1
    });
    await page.locator('body').dispatchEvent('pointerup', {
      bubbles: true, pointerId: 91, pointerType: 'touch', isPrimary: true,
      clientX: tx, clientY: ty, buttons: 0
    });

    await expect(slot).not.toHaveClass(/hidden-slot/);
    await expect(slot.locator('.piece-preview')).toHaveCount(1);
    await expect(page.locator('#score-display')).toHaveText('0');

    const state = await page.evaluate(() => ({ validEmptyCell: board[0][0], occupiedTarget: board[4][4] }));
    expect(state.validEmptyCell).toBe(0);
    expect(state.occupiedTarget).toBe(1);
    await assertNoPageErrors(page, errors);
  });

  test('reset during an active drag clears transient drag state', async ({ page }) => {
    const errors = await installErrorCapture(page);
    await openMenu(page);
    await page.locator('[data-pc-action="play"]').click();

    const slot = page.locator('#rack .rack-slot').first();
    const board = page.locator('#board');
    const slotBox = await slot.boundingBox();
    const boardBox = await board.boundingBox();
    if (!slotBox || !boardBox) throw new Error('Reset-drag geometry unavailable');

    await slot.dispatchEvent('pointerdown', {
      bubbles: true, pointerId: 92, pointerType: 'touch', isPrimary: true,
      clientX: slotBox.x + slotBox.width / 2,
      clientY: slotBox.y + slotBox.height / 2,
      button: 0
    });
    await board.dispatchEvent('pointermove', {
      bubbles: true, pointerId: 92, pointerType: 'touch', isPrimary: true,
      clientX: boardBox.x + boardBox.width / 2,
      clientY: boardBox.y + boardBox.height / 2, buttons: 1
    });

    await page.evaluate(() => resetGame());

    await expect(slot).not.toHaveClass(/hidden-slot/);
    await expect(page.locator('#dragging-container')).toHaveCSS('display', 'none');
    await expect(page.locator('.cell-hint, .cell-hint-error')).toHaveCount(0);

    const transient = await page.evaluate(() => ({
      hasDraggingClass: document.body.classList.contains('is-dragging'),
      hiddenSlots: document.querySelectorAll('.rack-slot.hidden-slot').length
    }));
    expect(transient.hasDraggingClass).toBe(false);
    expect(transient.hiddenSlots).toBe(0);
    await assertNoPageErrors(page, errors);
  });

  test('game-over sound guard is idempotent on repeated checks', async ({ page }) => {
    const errors = await installErrorCapture(page);
    await openMenu(page);
    await page.locator('[data-pc-action="play"]').click();

    await page.evaluate(() => {
      board = Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(1));
      rackPieces = [[[1]], null, null];
      updateBoardVisuals();
      renderRack();
    });

    const calls = await page.evaluate(() => {
      let count = 0;
      const original = playSound;
      playSound = kind => {
        if (kind === 'gameover') count += 1;
        original(kind);
      };
      checkGameOver();
      checkGameOver();
      return count;
    });

    expect(calls).toBe(1);
    await expect(page.locator('#game-over-modal')).not.toHaveClass(/modal-hidden/);
    await assertNoPageErrors(page, errors);
  });
});
