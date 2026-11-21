// Only for the isolated development instance. Creates synthetic test accounts and data.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

const dir = process.env.KEPT_SMOKE_STATE;
assert(dir, 'Set KEPT_SMOKE_STATE to a private directory outside the repository');
const baseURL = 'http://127.0.0.1:18740';
const { chromium, webkit } = await import(process.env.KEPT_PLAYWRIGHT_MODULE || '@playwright/test');
await mkdir(dir, { recursive: true, mode: 0o700 });
const fixturePath = resolve(dir, 'fixtures.json');
let fixture;
try { fixture = JSON.parse(await readFile(fixturePath, 'utf8')); }
catch (e) {
  if (e.code !== 'ENOENT') throw e;
  fixture = { owner: randomUUID(), other: randomUUID() };
  await writeFile(fixturePath, JSON.stringify(fixture), { mode: 0o600, flag: 'wx' });
}
const report = { checks: [], layouts: [], webkit: 'not attempted' };
const pass = (name) => { report.checks.push(name); console.log('PASS', name); };
const browser = await chromium.launch({ executablePath: process.env.KEPT_CHROME_PATH, headless: true });
const owner = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 } });
const page = await owner.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
async function signIn(p, email, password) {
  await p.goto('/signin');
  await p.getByLabel('Email or username', { exact: true }).fill(email);
  await p.getByLabel('Password', { exact: true }).fill(password);
  for(let attempt=0;attempt<3;attempt++){
    const response=p.waitForResponse((r)=>r.url().endsWith('/auth/sign-in/email')&&r.request().method()==='POST');
    await p.getByRole('button', { name: 'Sign in', exact: true }).click();
    const r=await response;
    if(r.status()!==429){assert.equal(r.status(),200,'Sign-in failed');break;}
    // Honour the application's limiter rather than weakening it for tests.
    const seconds=Math.max(1,Math.min(60,Number(r.headers()['retry-after'])||60));
    console.log('Waiting for the login rate limit');
    await p.waitForTimeout(seconds*1000+250);
  }
  await p.waitForURL(baseURL + '/');
}
async function layout(p, width, height, path) {
  await p.setViewportSize({ width, height }); await p.goto(path);
  await p.getByRole('heading', { level: 1 }).first().waitFor();
  await p.evaluate(() => document.fonts.ready);
  const m = await p.evaluate(() => ({
    viewport: innerWidth, content: document.documentElement.scrollWidth,
    zoomAllowed: !/user-scalable=no|maximum-scale=1(?:\D|$)/.test(document.querySelector('meta[name=viewport]')?.content || ''),
  }));
  assert(m.content <= m.viewport + 1, `Horizontal overflow at ${width}x${height}`);
  assert(m.zoomAllowed); report.layouts.push({width,height,...m});
}
try {
  await page.goto('/');
  const setup = await (await owner.request.get('/api/v1/setup')).json();
  if (setup.needed) {
    const env = await readFile(resolve(dir, 'runtime.env'), 'utf8');
    const code = env.match(/^KEPT_SETUP_CODE=(\S+)$/m)?.[1]; assert(code);
    await page.getByLabel('Setup code', {exact:true}).fill(code);
    await page.getByRole('button', {name:'Continue',exact:true}).click();
    await page.getByLabel('Your name', {exact:true}).fill('Development owner');
    await page.getByLabel('Email', {exact:true}).fill('owner@kept.test');
    await page.getByLabel('Password', {exact:true}).fill(fixture.owner);
    await page.getByRole('button', {name:'Create account',exact:true}).click();
    await page.getByRole('heading', {name:'How should this Kept work?'}).waitFor();
    await page.locator('[data-slot="switch"]').filter({hasText:'Let anyone with the address'}).click();
    await page.getByRole('button', {name:'Finish setup',exact:true}).click();
    await page.waitForURL(baseURL + '/'); pass('first-run setup');
  } else { await signIn(page,'owner@kept.test',fixture.owner); }
  const settings = await owner.request.put('/api/v1/admin/settings', {
    headers:{Origin:baseURL},data:{signupOpen:true},
  });
  assert.equal(settings.status(),200);
  const locations = await (await owner.request.get('/api/v1/locations')).json();
  const personal = locations.locations.find((l) => l.name === 'Personal'); assert(personal);
  const name = 'Smoke-test kommode';
  const search = `/api/v1/search?q=${encodeURIComponent(name)}&kind=things`;
  let result = await (await owner.request.get(search)).json();
  let thing = result.things.items.find((t) => t.name === name);
  if(fixture.thingId)assert.equal(thing?.id,fixture.thingId,'Persisted fixture disappeared; refusing to recreate it');
  if (!thing) {
    await page.goto(`/loc/${personal.id}`);
    // A tiny synthetic picture, generated without external assets or personal data.
    await page.evaluate(() => {
      const c=document.createElement('canvas'); c.id='synthetic-photo'; c.width=160; c.height=120;
      c.style.cssText='position:fixed;top:0;left:0;z-index:9999'; document.body.append(c);
      const g=c.getContext('2d'); g.fillStyle='#e0e7ef'; g.fillRect(0,0,160,120);
      g.fillStyle='#8b5e3c'; g.fillRect(35,25,90,75);
      for(let y=35;y<95;y+=22){g.strokeStyle='#fff';g.strokeRect(40,y,80,18);}
    });
    const png=await page.locator('#synthetic-photo').screenshot();
    await page.locator('#synthetic-photo').evaluate((el)=>el.remove());
    await page.getByRole('region',{name:'Add here'}).or(page.locator('section',{hasText:'Add here'})).first()
      .getByRole('button',{name:'Thing',exact:true}).click();
    const sheet=page.getByRole('dialog',{name:'Add a thing'});
    await sheet.getByRole('textbox',{name:'Name',exact:true}).fill(name);
    const chooser=page.waitForEvent('filechooser');
    await sheet.getByRole('button',{name:'Add a photo',exact:true}).click();
    await (await chooser).setFiles({name:'synthetic-chest.png',mimeType:'image/png',buffer:png});
    await sheet.getByText('synthetic-chest.png').waitFor();
    await sheet.getByRole('button',{name:'Add',exact:true}).click();
    await sheet.waitFor({state:'hidden'});
    for(let i=0;i<20;i++){
      result=await (await owner.request.get(search)).json();
      thing=result.things.items.find((t)=>t.name===name); if(thing)break;
      await page.waitForTimeout(250);
    }
    assert(thing,'Saved item missing from search');
  }
  fixture.thingId=thing.id;
  await writeFile(fixturePath,JSON.stringify(fixture),{mode:0o600});
  pass('item creation and keyword search');
  const places=await (await owner.request.get(`/api/v1/locations/${personal.id}/places`)).json();
  let attic=places.places.find((p)=>p.name==='Loftet');
  if(!attic){
    const r=await owner.request.post(`/api/v1/locations/${personal.id}/places`,{
      headers:{Origin:baseURL},data:{name:'Loftet',kindKey:'room'},
    });
    assert.equal(r.status(),201);attic=await r.json();
  }
  const moved=await owner.request.post('/api/v1/things/move',{
    headers:{Origin:baseURL},data:{thingIds:[thing.id],to:{placeId:attic.id}},
  });
  assert.equal(moved.status(),200);
  const detail=await (await owner.request.get(`/api/v1/things/${thing.id}`)).json();
  const edited=await owner.request.patch(`/api/v1/things/${thing.id}`,{
    headers:{Origin:baseURL,'If-Match':String(detail.rowVersion)},
    data:{notes:'Syntetisk kommode ved den bagerste gavl.'},
  });
  assert.equal(edited.status(),200);
  const current=await edited.json();
  assert(current.path.some((p)=>p.name==='Loftet'));
  assert.equal(current.notes,'Syntetisk kommode ved den bagerste gavl.');
  pass('physical location and optional description saved and read back');
  await page.goto(`/t/${thing.id}`);
  await page.getByText('Loftet',{exact:true}).first().waitFor();
  const photo=page.getByRole('img',{name:'Photo 1 of 1'}).filter({visible:true}).first();
  await photo.waitFor(); await photo.evaluate((img)=>img.decode());
  assert(await photo.evaluate((img)=>img.naturalWidth>0));
  const photoURL=await photo.getAttribute('src'); pass('uploaded photo renders');
  const attachments=await (await owner.request.get(`/api/v1/things/${thing.id}/attachments`)).json();
  const fileId=attachments.items?.find((a)=>a.file)?.file.id;
  assert(fileId,'Photo attachment file id missing');
  for(const [w,h] of [[320,780],[390,844],[430,932],[844,390],[1440,900]]){
    await layout(page,w,h,`/t/${thing.id}`); await layout(page,w,h,`/loc/${personal.id}`);
  }
  pass('five mobile/landscape/desktop sizes, inventory and detail, zoom allowed');
  const anon=await browser.newContext({baseURL});
  for(const path of ['/api/v1/me',`/api/v1/things/${thing.id}`]){
    const r=await anon.request.get(path); assert([401,403,404].includes(r.status()),`Anonymous read: ${r.status()}`);
  }
  const anonURL=await anon.request.post(`/api/v1/files/${fileId}/url`,{
    headers:{Origin:baseURL},data:{variant:'display'},
  });
  assert([401,403,404].includes(anonURL.status()));
  assert.equal((await anon.request.get(photoURL)).status(),200);
  assert.equal((await anon.request.get(photoURL+'tampered')).status(),404);
  await anon.close(); pass('anonymous item access and photo URL issuance denied; signed bearer URL behavior verified');
  const other=await browser.newContext({baseURL});
  const signup=await other.request.post('/api/v1/auth/sign-up',{
    headers:{Origin:baseURL},data:{displayName:'Development other',email:'other@kept.test',password:fixture.other},
  });
  assert.equal(signup.status(),202);
  const otherPage=await other.newPage(); await signIn(otherPage,'other@kept.test',fixture.other);
  for(const path of [`/api/v1/things/${thing.id}`]){
    const r=await other.request.get(path); assert([403,404].includes(r.status()),`Other user read: ${r.status()}`);
  }
  const otherURL=await other.request.post(`/api/v1/files/${fileId}/url`,{
    headers:{Origin:baseURL},data:{variant:'display'},
  });
  assert([403,404].includes(otherURL.status()));
  const otherSearch=await (await other.request.get(search)).json();
  assert(!otherSearch.things.items.some((t)=>t.id===thing.id));
  await other.close(); pass('second user cannot read item, obtain photo URL or find item in search');
  const bad=await owner.request.post('/api/v1/things',{
    headers:{Origin:'https://untrusted.invalid'},data:{locationId:personal.id,name:'must-not-exist'},
  });
  assert.equal(bad.status(),403); pass('cross-origin mutation denied');
  const manifest=await (await owner.request.get(await page.locator('link[rel=manifest]').getAttribute('href'))).json();
  assert.equal(manifest.display,'standalone');
  assert(manifest.icons.some((i)=>i.sizes.includes('192')));
  assert(manifest.icons.some((i)=>i.sizes.includes('512')));
  const leaks=await page.evaluate(async()=>{
    let n=0; for(const name of await caches.keys())for(const req of await (await caches.open(name)).keys()){
      if(/\/api\/|\/files\//.test(new URL(req.url).pathname))n++;
    } return n;
  });
  assert.equal(leaks,0); pass('PWA manifest/icons and no private API/file Cache API entries');
  assert.equal(errors.length,0,'Browser JavaScript errors');
  await page.screenshot({path:resolve(dir,'inventory-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:resolve(dir,'inventory-mobile.png'),fullPage:true});
  const wk=await webkit.launch({headless:true}).catch((e)=>{
    report.webkit=`Unavailable: ${e.message.split('\n')[0]}`;return null;
  });
  if(wk){
    const ctx=await wk.newContext({baseURL,viewport:{width:390,height:844}});
    const p=await ctx.newPage(); await signIn(p,'owner@kept.test',fixture.owner);
    await layout(p,390,844,`/t/${thing.id}`);
    report.webkit='Login and detail passed (emulation, not physical iPhone)'; await wk.close();
  }
  const logout=await owner.request.post('/api/v1/auth/sign-out',{headers:{Origin:baseURL},data:{}});
  assert.equal(logout.status(),200);
  assert.equal((await owner.request.get('/api/v1/me')).status(),401);
  await signIn(page,'owner@kept.test',fixture.owner);
  assert.equal((await owner.request.get(`/api/v1/things/${thing.id}`)).status(),200);
  pass('logout revokes browser session; login restores access to persisted item');
  report.passed=true;
}catch(e){
  report.passed=false;
  await page.screenshot({path:resolve(dir,'failure.png'),fullPage:true}).catch(()=>{});
  // Full Playwright call logs may contain input credentials; print only the summary.
  console.error('FAIL',e.message.split('\n')[0]);process.exitCode=1;
}finally{
  await owner.request.put('/api/v1/admin/settings',{
    headers:{Origin:baseURL},data:{signupOpen:false},
  }).catch(()=>{});
  await writeFile(resolve(dir,'report.json'),JSON.stringify(report,null,2),{mode:0o600});
  await browser.close();
}
