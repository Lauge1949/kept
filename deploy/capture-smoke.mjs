// Development preview checks. Uses private synthetic fixtures, never a real user's login.
// Inner UI requests travel straight to loopback under the canonical HTTPS browser origin.
// The public perimeter is tested separately WITHOUT a device-access session.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import https from 'node:https';
import { Resolver } from 'node:dns/promises';
const dir = process.env.KEPT_SMOKE_STATE;
assert(dir, 'Set KEPT_SMOKE_STATE to the private fixture directory');
const origin = 'https://dev-kept.laugesbin.win';
const internal = 'http://127.0.0.1:18740';
const fixture = JSON.parse(await readFile(`${dir}/fixtures.json`, 'utf8'));
const { chromium } = await import(process.env.KEPT_PLAYWRIGHT_MODULE || '@playwright/test');
const report = { checks: [], layouts: [], transport: 'inner UI: loopback route substitution; public: unauthenticated HTTPS', physicalPhone: false };
const pass = (s) => { report.checks.push(s); console.log('PASS', s); };
const browser = await chromium.launch({ executablePath: process.env.KEPT_CHROME_PATH });
async function innerContext() {
  const context = await browser.newContext({ baseURL: origin, serviceWorkers: 'block' });
  await context.route(`${origin}/**`, async (route) => {
    const req = route.request(), url = new URL(req.url());
    const headers = await req.allHeaders();
    // Explicit empty Cookie also disables route.fetch's loopback cookie-jar fallback.
    headers.cookie ??= '';
    const response = await route.fetch({
      url: internal + url.pathname + url.search,
      headers: { ...headers, host: new URL(origin).host }, maxRedirects: 0,
    });
    await route.fulfill({ response });
  });
  return context;
}
async function publicGet(path) {
  // Optional public resolver avoids stale NXDOMAIN cached on the development host.
  const options = { autoSelectFamily: false };
  if (process.env.KEPT_PREVIEW_RESOLVER) {
    const resolver = new Resolver(); resolver.setServers([process.env.KEPT_PREVIEW_RESOLVER]);
    const addresses = await resolver.resolve4(new URL(origin).hostname);
    options.lookup = (_host, _options, callback) => callback(null, addresses[0], 4);
  }
  return new Promise((resolve, reject) => {
    const req = https.get(origin + path, options, response => {
      response.resume();
      response.on('end', () => resolve({ status: response.statusCode, headers: new Headers(response.headers) }));
      response.on('error', reject);
    });
    req.setTimeout(15000, () => req.destroy(new Error('Public HTTPS timeout')));
    req.on('error', reject);
  });
}
async function perimeter(path, expected) {
  const r = await publicGet(path);
  assert(expected.includes(r.status), `Unexpected perimeter status ${r.status}`);
  assert.notEqual(r.headers.get('cf-cache-status'), 'HIT');
  assert.match(r.headers.get('cache-control') || '', /no-store/);
  assert(r.headers.get('strict-transport-security'));
  if (r.status === 303) assert(r.headers.get('location')?.startsWith('/_device/login'));

}
try {
  for (const path of ['/', '/start', '/api/preview-start', '/api/v1/me', '/f/probe', '/assets/probe.js']) {
    await perimeter(path, [303, 401]);
  }
  await perimeter('/_device/verify', [404]);
  const login = await publicGet('/_device/login');
  assert.equal(login.status, 200);
  pass('public HTTPS requires shared login for pages, onboarding, API, images and assets; verifier hidden');
  const publicContext = await browser.newContext({ serviceWorkers: 'block' });
  const loginPage = await publicContext.newPage();
  await loginPage.goto(origin + '/api/preview-start');
  await loginPage.waitForURL(url => url.pathname === '/_device/login');
  assert.equal(new URL(loginPage.url()).searchParams.get('next'), '/api/preview-start');
  await loginPage.locator('input[type=password]').waitFor();
  for (const width of [320, 390, 430]) {
    await loginPage.setViewportSize({ width, height: 844 });
    await loginPage.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1);
  }
  await loginPage.screenshot({ path: `${dir}/https-preview-shared-login.png` });
  await publicContext.close();
  pass('real public browser reaches shared password login from onboarding at three mobile widths');
  const context = await innerContext(), page = await context.newPage();
  await page.goto('/signin');
  await page.getByLabel('Email or username', { exact: true }).fill('owner@kept.test');
  await page.getByLabel('Password', { exact: true }).fill(fixture.owner);
  let signedIn = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = page.waitForResponse(r => r.url().endsWith('/auth/sign-in/email') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    const r = await response;
    if (r.status() !== 429) { assert.equal(r.status(), 200); signedIn = true; break; }
    const seconds = Math.max(1, Math.min(60, Number(r.headers()['retry-after']) || 60));
    console.log('Waiting for application login rate limit');
    await page.waitForTimeout(seconds * 1000 + 250);
  }
  assert(signedIn); await page.waitForURL(origin + '/');
  const cookies = await context.cookies(origin);
  assert(cookies.some(c => c.name.startsWith('__Secure-') && c.domain === new URL(origin).hostname && c.secure && c.httpOnly));
  pass('Kept login works with canonical HTTPS Origin and Secure HttpOnly cookie on internal test transport');
  const get = (path) => page.evaluate(async (path) => { const r = await fetch(path); if (!r.ok) throw new Error('Fixture request failed'); return r.json(); }, path);
  const original = await get(`/api/v1/things/${fixture.thingId}`);
  assert(original.placeId);
  const title = `Capture regression ${Date.now()}`;
  const secondTitle = `${title} second`;
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/capture?place=${original.placeId}`);
  const field = page.getByRole('textbox', { name: 'Name', exact: true });
  await field.waitFor();
  assert.equal(await field.getAttribute('aria-required') === 'true' || await field.getAttribute('required') !== null, true);
  const gallery = page.locator('input[type=file][multiple]').first();
  const photo = { name: 'synthetic.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRz8AAAAASUVORK5CYII=', 'base64') };
  await gallery.setInputFiles(photo);
  await page.getByText('Enter a name before saving.', { exact: true }).waitFor();
  pass('photo import is blocked without a title');
  for (const [width, height] of [[320,780],[390,844],[430,932],[844,390],[1440,900]]) {
    await page.setViewportSize({ width, height });
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1);
    assert(await field.evaluate(el => parseFloat(getComputedStyle(el).fontSize) >= 16));
    report.layouts.push({ width, height, screen: 'capture' });
  }
  await page.setViewportSize({ width:390, height:844 });
  await field.fill(title);
  await gallery.setInputFiles(photo);
  await page.getByText('1 captured', { exact:true }).waitFor();
  await field.fill(secondTitle);
  await field.press('Enter');
  await page.getByText('2 captured', { exact:true }).waitFor();
  await page.getByRole('button', { name:'Done', exact:true }).click();
  await page.getByRole('heading', { name:'Capture done', exact:true }).waitFor();
  await page.getByText('2 synced', { exact:true }).waitFor({ timeout:30000 });
  for (const [width,height] of [[320,780],[390,844],[430,932],[844,390],[1440,900]]) {
    await page.setViewportSize({ width,height });
    await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1);
    const box = await page.getByRole('button', { name:`Delete capture: ${title}`,exact:true }).boundingBox();
    assert(box && box.width >=44 && box.height >=44);
    report.layouts.push({width,height,screen:'summary'});
  }
  pass('named photo and name-only capture sync; camera/summary fit five viewport sizes with accessible delete controls');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:`${dir}/capture-summary-mobile.png`});
  await page.getByRole('button', {name:`Delete capture: ${title}`,exact:true}).click();
  await page.getByRole('alertdialog').getByRole('button', {name:'Delete',exact:true}).click();
  await page.getByRole('button', {name:`Delete capture: ${title}`,exact:true}).waitFor({state:'detached'});
  assert(await page.getByRole('button', {name:`Delete capture: ${secondTitle}`,exact:true}).isVisible());
  const result = await get(`/api/v1/search?q=${encodeURIComponent(secondTitle)}&kind=things`);
  assert(result.things.items.some(t => t.name === secondTitle && t.placeId === original.placeId));
  pass('deleting one synced capture leaves the other saved item and the session intact');
  await page.getByRole('button', {name:`Delete capture: ${secondTitle}`,exact:true}).click();
  await page.getByRole('alertdialog').getByRole('button', {name:'Delete',exact:true}).click();
  await page.getByRole('button', {name:`Delete capture: ${secondTitle}`,exact:true}).waitFor({state:'detached'});
  pass('both synthetic test captures removed to trash; original fixture untouched');
  await context.close();
  report.passed=true;
} catch(error) {
  report.passed=false; report.errorType=error.name;
  console.error('Capture check failed; inspect the private report and current assertion.');
  process.exitCode=1;
} finally {
  await writeFile(`${dir}/capture-report.json`,JSON.stringify(report,null,2),{mode:0o600});
  await browser.close();
}
