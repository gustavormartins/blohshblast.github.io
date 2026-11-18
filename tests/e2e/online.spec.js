import { test, expect } from '@playwright/test';

test('online panel shows a safe nickname leaderboard and keeps local play optional', async ({ page }) => {
  await page.route('**/api/v1/leaderboard**', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: [{ nickname: 'JogadorQA', score: 147, mode: 'classic', createdAt: '2026-11-18T12:00:00Z' }] })
  }));
  await page.goto('/');
  await expect(page.locator('#online-panel')).toBeVisible();
  await expect(page.locator('#online-leaderboard')).toContainText('JogadorQA');
  await expect(page.locator('#online-leaderboard')).toContainText('147');
  await expect(page.locator('.phase3-leaderboard-panel')).toBeVisible();
  await expect(page.locator('#online-email')).toBeVisible();
  await page.locator('#online-auth-toggle').click();
  await expect(page.locator('#online-register-name-row')).toBeVisible();

  // Game remains usable without signing in.
  await page.locator('[data-pc-action="play"]').click();
  await expect(page.locator('#board .cell')).toHaveCount(64);
  await expect(page.locator('#phase3-menu')).toHaveCSS('visibility', 'hidden');
});

test('registration uses server endpoints, next run starts online and logout keeps local data', async ({ page }) => {
  let started = 0;
  await page.route('**/api/v1/leaderboard**', route => route.fulfill({
    status: 200, contentType: 'application/json', body: '{"data":[]}'
  }));
  await page.route('**/api/v1/auth/register', async route => {
    const data = route.request().postDataJSON();
    expect(data.email).toBe('qa@example.com');
    expect(data.nickname).toBe('JogadorQA');
    expect(data.password.length).toBeGreaterThanOrEqual(12);
    await route.fulfill({ status: 201, contentType: 'application/json',
      body: '{"data":{"accessToken":"fake-jwt-for-e2e","expiresIn":900}}' });
  });
  await page.route('**/api/v1/me', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: '{"data":{"id":"e2e","email":"qa@example.com","role":"user","nickname":"JogadorQA"}}'
  }));
  await page.route('**/api/v1/runs', async route => {
    started += 1;
    await route.fulfill({status:201, contentType:'application/json',
      body:'{"data":{"runId":"ca3f8259-c57b-4d56-a160-4992a39834b2","mode":"classic","rulesVersion":"phase4"}}'});
  });
  await page.goto('/');
  await page.locator('#online-auth-toggle').click();
  await page.locator('#online-email').fill('qa@example.com');
  await page.locator('#online-password').fill('TestPassword12345!');
  await page.locator('#online-nickname').fill('JogadorQA');
  await page.locator('#online-account-submit').click();
  await expect(page.locator('#online-user-label')).toHaveText('Conectado: JogadorQA');
  await expect(page.locator('#online-password')).toHaveValue('');
  await page.locator('[data-pc-action="play"]').click();
  await expect.poll(() => started).toBe(1);
  await page.locator('#phase3-menu-game').click();
  await page.locator('#online-logout').click();
  await expect(page.locator('#online-form')).toBeVisible();
  await expect(page.locator('#board .cell')).toHaveCount(64);
});
