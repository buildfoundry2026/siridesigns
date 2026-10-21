// @ts-check
const { test, expect } = require('@playwright/test');

const translate = (locator) =>
  locator.evaluate((el) => {
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return { x: m.m41, y: m.m42 };
  });

const scrollTo = (page, y) => page.evaluate((y) => window.scrollTo(0, y), y);

test.describe('Siri Designs site', () => {
  /** @type {string[]} */
  let errors;

  test.beforeEach(async ({ page }) => {
    errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(() => {
    expect(errors, 'no console or page errors').toEqual([]);
  });

  test('loads with libraries and smooth scrolling active', async ({ page }) => {
    await expect(page).toHaveTitle(/siri.design/);
    const libs = await page.evaluate(() => ({
      gsap: typeof window.gsap, st: typeof window.ScrollTrigger, lenis: typeof window.Lenis,
    }));
    expect(libs).toEqual({ gsap: 'object', st: 'function', lenis: 'function' });
    await expect(page.locator('html')).toHaveClass(/lenis/);
  });

  test('hero headline, copy and design cards are visible after intro', async ({ page }) => {
    await expect(page.locator('h1.hero-title')).toHaveText(/NEVER\s*GO\s*QUIET\./);
    await expect(page.locator('.hero-copy')).toBeVisible();
    await page.waitForTimeout(2500);
    const cards = page.locator('.hcard');
    await expect(cards).toHaveCount(3);
    for (const op of await cards.evaluateAll((els) => els.map((e) => +getComputedStyle(e).opacity))) {
      expect(op).toBeGreaterThan(0.95);
    }
    const box = await page.locator('.hero-title .line-inner').first().boundingBox();
    expect(box?.y).toBeGreaterThan(0);
  });

  test('no horizontal page scroll', async ({ page }) => {
    for (const y of [0, 1200, 99999]) {
      await scrollTo(page, y);
      await page.waitForTimeout(400);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    }
  });

  test('pricing toggle switches between monthly and 6-month prices', async ({ page }) => {
    const growth = page.locator('#row-soc .plan').nth(1);
    const business = page.locator('#row-prt .plan').nth(1);
    await expect(page.locator('#row-soc .plan')).toHaveCount(3);
    await expect(page.locator('#row-prt .plan')).toHaveCount(3);
    await expect(growth.locator('.plan-price')).toHaveText('₹24,999');
    await expect(growth).toHaveClass(/is-pop/);

    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await page.getByRole('tab', { name: '6 months' }).click();
    await expect(page.getByRole('tab', { name: '6 months' })).toHaveAttribute('aria-selected', 'true');
    await expect(growth.locator('.plan-price')).toHaveText('₹1,49,999');
    await expect(growth.locator('.plan-unit')).toHaveText('per 6 months');
    await expect(business.locator('.plan-unit')).toHaveText('per 6 months · 10 designs / mo');

    await page.getByRole('tab', { name: 'Monthly' }).click();
    await expect(growth.locator('.plan-price')).toHaveText('₹24,999');
    await expect(page.locator('#row-prt .plan').first().locator('.plan-price')).toHaveText('₹4,999');
  });

  test('toggle thumb slides under the active option', async ({ page }) => {
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    const thumb = page.locator('.toggle-thumb');
    const before = await translate(thumb);
    await page.getByRole('tab', { name: '6 months' }).click();
    await page.waitForTimeout(800);
    const after = await translate(thumb);
    expect(after.x).toBeGreaterThan(before.x + 40);
  });

  test('nav CTA opens WhatsApp chat', async ({ page }) => {
    const cta = page.getByRole('link', { name: 'Start a plan →' });
    await expect(cta).toHaveAttribute('href', 'https://wa.me/919059675056');
    await expect(cta).toHaveAttribute('target', '_blank');
    await expect(page.getByRole('link', { name: 'Send us a hi →' })).toHaveAttribute('href', 'https://wa.me/919059675056');
    await expect(page.getByRole('link', { name: '+91 90596 75056' })).toHaveAttribute('href', 'tel:+919059675056');
  });

  test('desktop nav links reach their sections', async ({ page, isMobile }) => {
    test.skip(isMobile, 'section pills are hidden on mobile');
    for (const [name, id] of [['Pricing', '#pricing'], ['Services', '#services'], ['Process', '#process']]) {
      await page.locator('.nav-links').getByRole('link', { name, exact: true }).click();
      await page.waitForTimeout(2000);
      const top = await page.locator(id).evaluate((el) => el.getBoundingClientRect().top);
      expect(Math.abs(top - 80), `${name} lands under the nav`).toBeLessThan(40);
    }
  });

  test('hero layers move at different speeds on scroll (parallax)', async ({ page }) => {
    await page.waitForTimeout(1500);
    const layers = page.locator('.hero .layer');
    const start = await Promise.all([0, 1, 2, 3].map((i) => translate(layers.nth(i))));
    await scrollTo(page, 500);
    await page.waitForTimeout(1200);
    const end = await Promise.all([0, 1, 2, 3].map((i) => translate(layers.nth(i))));
    const moved = end.map((e, i) => start[i].y - e.y);
    moved.forEach((m) => expect(m).toBeGreaterThan(10));
    // deeper layers travel further
    expect(moved[3]).toBeGreaterThan(moved[2]);
    expect(moved[2]).toBeGreaterThan(moved[1]);
    expect(moved[1]).toBeGreaterThan(moved[0]);

    const lines = page.locator('.hero-title .line');
    expect((await translate(lines.nth(0))).x).toBeLessThan(0);
    expect((await translate(lines.nth(1))).x).toBeGreaterThan(0);
  });

  test('marquee keeps moving', async ({ page }) => {
    const track = page.locator('.marquee-track');
    const a = await translate(track);
    await page.waitForTimeout(800);
    const b = await translate(track);
    expect(Math.abs(b.x - a.x)).toBeGreaterThan(10);
  });

  test('stats count up to their final values', async ({ page }) => {
    await page.locator('#process').scrollIntoViewIfNeeded();
    await page.waitForTimeout(2500);
    await expect(page.locator('.count')).toHaveText(['2', '2', '100', '1']);
  });

  test('nav hides on scroll down and returns on scroll up', async ({ page }) => {
    const nav = page.locator('#nav');
    await scrollTo(page, 1200);
    await page.waitForTimeout(700);
    await expect(nav).toHaveClass(/is-hidden/);
    await expect(nav).toHaveClass(/is-scrolled/);
    await scrollTo(page, 900);
    await page.waitForTimeout(700);
    await expect(nav).not.toHaveClass(/is-hidden/);
  });

  test('scroll progress bar fills to the end', async ({ page }) => {
    await scrollTo(page, 99999);
    await page.waitForTimeout(1500);
    const sx = await page.locator('.progress').evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
    expect(sx).toBeGreaterThan(0.95);
  });
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('disables smooth scroll and animations but keeps content and pricing working', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('html')).not.toHaveClass(/lenis/);
    const anim = await page.locator('.hcard').first().evaluate((el) => getComputedStyle(el).animationName);
    expect(anim).toBe('none');
    await expect(page.locator('.hcard').first()).toBeVisible();
    await expect(page.locator('.count').nth(2)).toHaveText('100');

    await page.getByRole('tab', { name: '6 months' }).click();
    await expect(page.locator('#row-soc .plan').nth(1).locator('.plan-price')).toHaveText('₹1,49,999');
    expect(errors).toEqual([]);
  });
});
