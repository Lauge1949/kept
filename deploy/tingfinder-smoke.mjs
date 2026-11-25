// Development preview checks. Uses private synthetic fixtures, never a real user's login.
// Exercises real public HTTPS and native app login without a device-access session.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

const dir = process.env.KEPT_SMOKE_STATE;
assert(dir, 'Set KEPT_SMOKE_STATE to the private fixture directory');
const origin = 'https://tingfinder.laugesbin.win';
const fixture = JSON.parse(await readFile(`${dir}/fixtures.json`, 'utf8'));
const { chromium } = await import(process.env.KEPT_PLAYWRIGHT_MODULE || '@playwright/test');
const report = {
  checks: [],
  layouts: [],
  transport: 'public HTTPS; native app authentication',
  physicalPhone: false,
};
const pass = (s) => {
  report.checks.push(s);
  console.log('PASS', s);
};
const browser = await chromium.launch({ executablePath: process.env.KEPT_CHROME_PATH });
async function innerContext() {
  const context = await browser.newContext({
    baseURL: origin,
    serviceWorkers: 'block',
    locale: 'da-DK',
  });
  return context;
}

let page;
try {
  const context = await innerContext();
  for (const host of ['tingfinder.laugesbin.win', 'dev-kept.laugesbin.win']) {
    const base = `https://${host}`;
    assert.equal((await context.request.get(`${base}/api/v1/me`)).status(), 401);
    assert.equal((await context.request.get(`${base}/_device/verify`)).status(), 404);
    for (const path of ['/_device/login', '/api/preview-start', '/start']) {
      const response = await context.request.get(base + path, { maxRedirects: 0 });
      assert.equal(response.status(), 303);
      assert.equal(response.headers().location, '/signin');
    }
    const worker = await context.request.get(`${base}/sw.js`);
    assert.equal(worker.status(), 200);
    assert(!(await worker.text()).includes('unregister()'));
  }
  pass('both public hosts require native API authentication and retire outer login safely');
  page = await context.newPage();
  await page.goto('/signin');
  await page.getByRole('heading', { name: 'Log ind på Tingfinder', exact: true }).waitFor();
  assert.equal(await page.title(), 'Tingfinder');
  assert.equal(await page.locator('html').getAttribute('lang'), 'da');
  assert.equal(await page.getByRole('combobox').inputValue(), 'Dansk');
  await page.getByRole('img', { name: 'Tingfinder', exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert(await page.getByRole('img', { name: 'Tingfinder', exact: true }).evaluate((svg) => {
    const text = svg.querySelector('text').getBBox();
    return text.x + text.width <= svg.viewBox.baseVal.width;
  }), 'Full wordmark fits the logo viewport');
  const manifest = await page.evaluate(async () => {
    const response = await fetch('/manifest.webmanifest');
    if (!response.ok) throw new Error('PWA manifest is not readable');
    return response.json();
  });
  assert.equal(manifest.name, 'Tingfinder');
  assert.equal(manifest.short_name, 'Tingfinder');
  pass('Danish browser starts in Danish; document, logo and install name are Tingfinder');
  for (const width of [320, 390, 430, 844, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1);
    const sizes = await page
      .locator('input[type=password],input[autocomplete=username]')
      .evaluateAll((es) => es.map((e) => Number.parseFloat(getComputedStyle(e).fontSize)));
    assert(sizes.every((s) => s >= 16));
    report.layouts.push({ page: 'Danish sign in', width, noOverflow: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${dir}/tingfinder-danish-signin.png` });
  await page.getByRole('combobox').fill('English');
  await page.getByRole('option', { name: 'English', exact: true }).click();
  await page.getByRole('heading', { name: 'Sign in to Tingfinder', exact: true }).waitFor();
  await page.reload();
  await page.getByRole('heading', { name: 'Sign in to Tingfinder', exact: true }).waitFor();
  await page.getByRole('combobox').fill('Dansk');
  await page.getByRole('option', { name: 'Dansk', exact: true }).click();
  await page.getByRole('heading', { name: 'Log ind på Tingfinder', exact: true }).waitFor();
  pass('language picker switches between English and Danish and preserves selection after reload');
  await page.getByLabel('Mailadresse eller brugernavn', { exact: true }).fill('owner@kept.test');
  await page.getByLabel('Adgangskode', { exact: true }).fill(fixture.owner);
  let signedIn = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = page.waitForResponse(
      (r) => r.url().endsWith('/auth/sign-in/email') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Log ind', exact: true }).click();
    const r = await response;
    if (r.status() !== 429) {
      assert.equal(r.status(), 200);
      signedIn = true;
      break;
    }
    await page.waitForTimeout(
      Math.max(1, Math.min(60, Number(r.headers()['retry-after']) || 60)) * 1000 + 250,
    );
  }
  assert(signedIn);
  await page.waitForURL(origin + '/');
  const profile = await page.evaluate(async () => {
    const response = await fetch('/api/v1/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'da' }),
    });
    if (!response.ok) throw new Error('Danish profile save failed');
    return response.json();
  });
  assert.equal(profile.locale, 'da');
  await page.reload();
  await page.waitForFunction(() => document.documentElement.lang === 'da');
  await page.locator('main').waitFor({ state: 'visible' });
  await page.locator('main').getByRole('heading').first().waitFor({ state: 'visible' });
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole('link', { name: 'Forside', exact: true }).first().waitFor();
  assert(!/\b(?:i0qMbr|2FYpfJ|A1taO8|7MuXko)\b/.test(await page.locator('body').innerText()), 'No raw translation IDs in the signed-in UI');
  pass('Authenticated Danish navigation uses readable text rather than translation IDs');
  for (const width of [320, 390, 430, 844, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1);
    report.layouts.push({ page: 'Danish inventory', width, noOverflow: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${dir}/tingfinder-danish-home.png` });
  pass(
    'Danish account preference saves through API; signed in inventory fits all five viewport sizes',
  );
  // Keep the shared synthetic fixture ready for the English capture regression check.
  await page.evaluate(async () => {
    const r = await fetch('/api/v1/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'en' }),
    });
    if (!r.ok) throw new Error('Fixture locale reset failed');
  });
  await context.unrouteAll({ behavior: 'ignoreErrors' });
  await context.close();
  await writeFile(`${dir}/tingfinder-smoke-report.json`, JSON.stringify(report, null, 2) + '\n', {
    mode: 0o600,
  });
} catch (error) {
  if (page) await page.screenshot({ path: `${dir}/tingfinder-smoke-error.png` }).catch(() => {});
  throw error;
} finally {
  for (const context of browser.contexts()) await context.unrouteAll({ behavior: 'ignoreErrors' });
  await browser.close();
}
