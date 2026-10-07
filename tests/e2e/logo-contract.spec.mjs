import { test, expect } from '@playwright/test';

async function readLogoState(page) {
  return page.locator('[data-blohsh-logo]').evaluateAll(images => images.map(image => ({
    src: image.getAttribute('src') || '',
    currentSrc: image.currentSrc,
    complete: image.complete,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    source: image.dataset.logoSource || ''
  })));
}

test.describe('Blohsh Blast — logo asset contract', () => {
  test('menu and gameplay use one valid local logo asset', async ({ page }) => {
    await page.goto('/');
    await page.locator('#phase3-menu').waitFor({ state: 'visible' });

    const menuLogos = page.locator('#phase3-menu [data-blohsh-logo]');
    const gameLogo = page.locator('header .brand-logo[data-blohsh-logo]');

    await expect(menuLogos).toHaveCount(1);
    await expect(gameLogo).toHaveCount(1);

    await expect.poll(async () => (await readLogoState(page)).every(logo => (
      logo.complete && logo.naturalWidth > 0 && logo.naturalHeight > 0
    ))).toBe(true);

    const initial = await readLogoState(page);
    expect(initial).toHaveLength(2);
    expect(new Set(initial.map(logo => logo.currentSrc)).size).toBe(1);
    expect(initial.every(logo => /logo-official-64/.test(logo.currentSrc))).toBe(true);
    expect(initial.every(logo => !/logo-official\\.svg|wikimedia/i.test(logo.currentSrc))).toBe(true);
    expect(initial.every(logo => ['vite-local-asset', 'runtime-fallback'].includes(logo.source))).toBe(true);

    await page.locator('[data-pc-action="play"]').click();
    await expect(page.locator('#phase3-menu')).toBeHidden();
    await expect(gameLogo).toBeVisible();

    const gameplay = await readLogoState(page);
    expect(gameplay).toHaveLength(2);
    expect(new Set(gameplay.map(logo => logo.currentSrc)).size).toBe(1);
    expect(gameplay.every(logo => /logo-official-64/.test(logo.currentSrc))).toBe(true);
    expect(gameplay.every(logo => logo.naturalWidth > 0 && logo.naturalHeight > 0)).toBe(true);
  });
});
