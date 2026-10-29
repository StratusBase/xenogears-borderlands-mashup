/** Ordinary '/' only. Trusted keyboard/mouse controls and read-only DOM evidence;
 * no Game imports, private fields, synthetic gameplay events or lab APIs. */
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'artifacts/crowd-feedback'); await mkdir(out, { recursive: true });
const url = process.env.CROWD_MAIN_URL ?? 'http://127.0.0.1:5210/';
assert.equal(new URL(url).pathname, '/', 'This smoke must exercise the ordinary entrypoint');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const launch = { headless: true, args: process.platform === 'darwin' ? ['--use-angle=metal'] : [] };
if (process.env.CHROME_EXECUTABLE) launch.executablePath = process.env.CHROME_EXECUTABLE;
const bundle = [];
for (const file of (await readdir(join(root, 'dist-crowd/assets'))).filter(file => /\.(js|css)$/.test(file)).sort()) {
  bundle.push({ file, sha256: createHash('sha256').update(await readFile(join(root, 'dist-crowd/assets', file))).digest('hex') });
}
const report = { protocol: 'crowd-normal-main-v1', capturedAt: new Date().toISOString(), url, bundle,
  controls: 'Trusted Enter, K, workbench selectors, mouse fire, arrow-key aim, Escape/Resume and R. DOM-only observation; no private Game access.',
  screenshots: [], errors: [], ignoredFavicon404: 0, status: 'running' };
const browser = await chromium.launch(launch);
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage(); report.browser = browser.version();
page.on('pageerror', error => report.errors.push({ kind: 'pageerror', message: error.message }));
page.on('console', message => {
  if (message.type() !== 'error') return;
  if (message.text().includes('404') && /\/favicon\.ico(?:\?|$)/.test(message.location().url)) report.ignoredFavicon404++;
  else report.errors.push({ kind: 'console', message: message.text(), location: message.location().url });
});
const persist = () => writeFile(join(out, 'main-verification.json'), JSON.stringify(report, null, 2) + '\n');
const numeric = value => Number(String(value ?? '').replaceAll(',', '').replace(/[^0-9.e+-]/gi, '')) || 0;
async function picture(name) { const file = `main-${name}.png`; await page.screenshot({ path: join(out, file) }); report.screenshots.push(file); }
async function view() {
  return page.evaluate(() => ({
    screen: document.querySelector('.game-interface')?.dataset.screen,
    mode: document.querySelector('.game-interface')?.dataset.mode,
    ammo: document.querySelector('.ammo-count')?.textContent,
    magazine: document.querySelector('.ammo-total')?.textContent,
    weapon: document.querySelector('.weapon-name')?.textContent,
    statuses: [...document.querySelectorAll('.target-status-chip')].map(node => node.textContent),
    dummyVisible: !document.querySelector('.test-dummy-readout')?.hidden,
    dummyKind: document.querySelector('.test-dummy-readout')?.dataset.damageKind,
    dummyMetrics: [...document.querySelectorAll('.dummy-readout-metric>strong')].map(node => node.textContent),
    pool: document.querySelectorAll('.crowd-damage-number').length,
    visible: [...document.querySelectorAll('.crowd-damage-number')].filter(node => !node.hidden).map(node => ({
      id: node.dataset.feedbackId, kind: node.dataset.damageKind, eventKind: node.dataset.eventKind,
      amount: Number(node.dataset.damageAmount), events: Number(node.dataset.damageEvents), text: node.textContent,
      breakdown: JSON.parse(node.dataset.damageBreakdown ?? '{}'), color: getComputedStyle(node).color, opacity: Number(node.style.opacity),
    })),
  }));
}
async function frozenLabels() {
  return page.evaluate(() => [...document.querySelectorAll('.crowd-damage-number')].map(node => ({
    id: node.dataset.feedbackId, amount: node.dataset.damageAmount, events: node.dataset.damageEvents,
    transform: node.style.transform, opacity: node.style.opacity, hidden: node.hidden,
  })));
}
try {
  await persist(); await page.goto(url);
  const enter = page.getByRole('button', { name: /enter proving ground/i }); await enter.focus(); await page.keyboard.press('Enter');
  await page.waitForSelector('.game-interface[data-screen=none]'); await page.keyboard.press('KeyK');
  await page.getByRole('heading', { name: 'WEAPON WORKBENCH' }).waitFor();
  for (const [label, value] of [['Loadout', 'pilot'], ['Manufacturer', 'voltaic'], ['Weapon type', 'smg'], ['Assembly', 'rapid'],
    ['Projectile', 'bullet'], ['Flight style', 'tracer'], ['Primary element', 'fire'], ['Secondary element', 'shock'], ['Rarity', 'rare']]) {
    await page.getByLabel(label, { exact: true }).selectOption(value);
  }
  await page.getByLabel('Weapon level', { exact: true }).fill('5'); await page.getByLabel('Weapon level', { exact: true }).press('Tab');
  await page.getByLabel('Guaranteed status procs', { exact: true }).check();
  report.buildCode = await page.getByLabel('Build code; paste a code and select Load', { exact: true }).inputValue();
  assert.ok(report.buildCode.includes(':bullet:fire:shock:')); await picture('workbench');
  await page.getByRole('button', { name: /^EQUIP & TEST/ }).click();
  await page.waitForFunction(() => document.pointerLockElement !== null);
  await page.waitForSelector('.crowd-damage-numbers');

  // Observe only the existing DOM. An epoch ID distinguishes recycled nodes;
  // updates replace each row's previous amount instead of double-counting it.
  await page.evaluate(() => {
    const layer = document.querySelector('.crowd-damage-numbers');
    const rows = new Map(), pool = [...layer.querySelectorAll('.crowd-damage-number')];
    const collect = () => {
      for (const node of pool) {
        const id = Number(node.dataset.feedbackId), amount = Number(node.dataset.damageAmount), events = Number(node.dataset.damageEvents);
        if (!id || !Number.isFinite(amount) || amount <= 0 || node.hidden) continue;
        rows.set(id, { id, amount, events, target: node.dataset.targetId, kind: node.dataset.damageKind,
          eventKind: node.dataset.eventKind, breakdown: JSON.parse(node.dataset.damageBreakdown ?? '{}'), text: node.textContent, color: getComputedStyle(node).color });
      }
    };
    const observer = new MutationObserver(collect); observer.observe(layer, { subtree: true, attributes: true, childList: true, characterData: true });
    globalThis.__crowdDomReview = { rows, pool, observer, collect };
  });
  report.before = await view(); assert.equal(report.before.pool, 40); assert.equal(numeric(report.before.dummyMetrics[1]), 0);
  await picture('equipped');
  let criticalImageCaptured = false;
  const criticalCapture = page.waitForFunction(() => [...document.querySelectorAll('.crowd-damage-number')]
    .some(node => !node.hidden && node.dataset.damageKind === 'critical' && Number(node.style.opacity) > .9), undefined, { timeout: 10000 })
    .then(async () => {
      const before = (await view()).visible.filter(row => row.kind === 'critical');
      await picture('critical-response');
      const after = (await view()).visible.filter(row => row.kind === 'critical' && row.opacity > .5);
      report.criticalCapture = { before, after };
      criticalImageCaptured = before.some(row => row.opacity > .9) && after.length > 0;
      return criticalImageCaptured;
    }).catch(error => { report.criticalCaptureError = error.message; return false; });
  await page.mouse.down();
  try {
    await page.waitForFunction(() => [...globalThis.__crowdDomReview.rows.values()].some(row => row.eventKind === 'status' && row.events >= 4), undefined, { timeout: 6500 });
  } finally { await page.mouse.up(); }
  report.active = await view(); assert.ok(numeric(report.active.ammo) < numeric(report.before.ammo));
  assert.ok(report.active.visible.some(row => row.eventKind === 'direct'));
  assert.ok(report.active.visible.some(row => row.eventKind === 'status' && row.events >= 4));
  await picture('rapid-fire-status-tallies');

  // The pilot's authored kick raises aim during rapid fire. Small ordinary
  // downward/upward taps search the actual red center; no camera teleport.
  let critical = false;
  for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowUp', 'ArrowUp']) {
    if (criticalImageCaptured) { critical = true; break; }
    await page.keyboard.down(key); await page.waitForTimeout(22); await page.keyboard.up(key);
    await page.mouse.down(); await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(140);
  }
  critical ||= await page.evaluate(() => [...globalThis.__crowdDomReview.rows.values()].some(row => row.kind === 'critical'));
  report.criticalObserved = critical;
  assert.equal(await criticalCapture, true, 'Critical screenshot must contain a currently visible high-opacity response, with current rows before/after capture');

  await page.keyboard.press('Escape'); await page.waitForSelector('.game-interface[data-screen=pause]');
  await page.waitForFunction(() => document.querySelector('.crowd-damage-numbers')?.dataset.paused === 'true');
  const paused = await frozenLabels(), pausedView = await view(); await page.waitForTimeout(1000);
  assert.deepEqual(await frozenLabels(), paused, 'Pooled row lifetimes/transforms changed while paused');
  assert.equal((await view()).ammo, pausedView.ammo); report.pauseFrozen = true; await picture('pause-frozen');
  await page.getByRole('button', { name: /^resume/i }).click(); await page.waitForSelector('.game-interface[data-screen=none]');
  await page.waitForFunction(() => document.querySelector('.crowd-damage-numbers')?.dataset.paused !== 'true');
  report.resumed = await view(); await picture('resumed');

  let beforeReload = await view();
  if (numeric(beforeReload.ammo) === numeric(beforeReload.magazine)) {
    await page.mouse.down(); await page.waitForTimeout(50); await page.mouse.up(); await page.waitForTimeout(120); beforeReload = await view();
  }
  await page.keyboard.press('KeyR');
  await page.waitForFunction(() => !document.querySelector('.weapon-reload-track')?.hidden);
  await picture('reload');
  await page.waitForFunction(() => document.querySelector('.weapon-reload-track')?.hidden
    && Number(document.querySelector('.ammo-count')?.textContent) === Number(document.querySelector('.ammo-total')?.textContent), undefined, { timeout: 6000 });
  report.reload = { before: beforeReload, after: await view() }; assert.ok(numeric(report.reload.after.ammo) > numeric(beforeReload.ammo));

  await page.waitForTimeout(6500);
  await page.waitForFunction(() => [...document.querySelectorAll('.crowd-damage-number')].every(node => node.hidden), undefined, { timeout: 10000 });
  report.final = await view();
  const accounting = await page.evaluate(() => {
    const review = globalThis.__crowdDomReview; review.collect(); review.observer.disconnect();
    const rows = [...review.rows.values()];
    return { rows, samePool: review.pool.every((node, i) => document.querySelectorAll('.crowd-damage-number')[i] === node),
      rawDamage: rows.reduce((sum, row) => sum + row.amount, 0), events: rows.reduce((sum, row) => sum + row.events, 0),
      mergedStatusEvents: rows.filter(row => row.eventKind === 'status').reduce((sum, row) => sum + row.events - 1, 0) };
  });
  assert.equal(accounting.samePool, true); assert.equal(report.final.pool, 40); assert.ok(accounting.mergedStatusEvents > 0);
  assert.ok(accounting.rows.some(row => row.kind === 'critical' && row.color === 'rgb(255, 59, 59)'), 'Actual critical response must use the red damage palette');
  for (const row of accounting.rows) {
    assert.ok(Number.isFinite(row.amount) && row.amount > 0 && row.events > 0);
    if (row.eventKind === 'status') {
      const parts = Object.values(row.breakdown);
      assert.ok(Math.abs(parts.reduce((sum, part) => sum + part.amount, 0) - row.amount) < 1e-8);
      assert.equal(parts.reduce((sum, part) => sum + part.events, 0), row.events);
    } else assert.equal(row.events, 1, 'Ordinary direct/critical hits must remain distinct');
  }
  const dummyTotal = numeric(report.final.dummyMetrics[1]);
  report.accounting = { ...accounting, dummyDisplayedTotal: dummyTotal,
    differenceFromTwoDecimalDummyReadout: accounting.rawDamage - dummyTotal };
  assert.ok(dummyTotal > 0); assert.ok(Math.abs(accounting.rawDamage - dummyTotal) <= .011, 'Observed raw label totals must reconcile with the ordinary two-decimal dummy total');
  await picture('decayed');

  // A separate ordinary workbench reset epoch. The first receipt above remains
  // intact; never compare a reset dummy meter with cumulative observer totals.
  await page.evaluate(() => {
    const review = globalThis.__crowdDomReview; review.rows.clear();
    review.observer.observe(document.querySelector('.crowd-damage-numbers'), { subtree: true, attributes: true, childList: true, characterData: true });
  });
  await page.mouse.down(); await page.waitForTimeout(25); await page.mouse.up();
  await page.waitForFunction(() => [...globalThis.__crowdDomReview.rows.values()].some(row => row.eventKind === 'status'));
  const beforeReset = await view();
  const priorMaximumId = await page.evaluate(initialMax => Math.max(initialMax, ...globalThis.__crowdDomReview.rows.keys()), Math.max(0, ...accounting.rows.map(row => row.id)));
  assert.ok(beforeReset.visible.length > 0 && beforeReset.statuses.length > 0);
  await page.keyboard.press('KeyK'); await page.getByRole('heading', { name: 'WEAPON WORKBENCH' }).waitFor();
  await page.getByRole('button', { name: /^EQUIP & TEST/ }).click();
  await page.waitForFunction(() => document.pointerLockElement !== null);
  const cleanReset = await view();
  assert.equal(cleanReset.pool, 40); assert.equal(cleanReset.visible.length, 0); assert.equal(numeric(cleanReset.dummyMetrics[1]), 0);
  assert.equal(await page.evaluate(() => globalThis.__crowdDomReview.pool.every((node, i) => document.querySelectorAll('.crowd-damage-number')[i] === node)), true);
  await picture('reset-clean'); await page.evaluate(() => globalThis.__crowdDomReview.rows.clear());
  await page.mouse.down(); await page.waitForTimeout(15); await page.mouse.up();
  await page.waitForFunction(() => [...globalThis.__crowdDomReview.rows.values()].some(row => row.eventKind === 'status'));
  const fresh = await view(), freshStatus = fresh.visible.find(row => row.eventKind === 'status');
  assert.ok(freshStatus); assert.equal(freshStatus.events, 2, 'A fresh single-shot fire/shock window contains exactly its first two elemental ticks');
  assert.equal(freshStatus.breakdown.fire?.events, 1); assert.equal(freshStatus.breakdown.shock?.events, 1);
  assert.ok(fresh.visible.every(row => Number(row.id) > priorMaximumId), 'Reset must never recycle feedback IDs or retain an old amount window');
  await page.waitForFunction(() => {
    const raw = [...globalThis.__crowdDomReview.rows.values()].reduce((sum, row) => sum + row.amount, 0);
    const displayed = Number(document.querySelectorAll('.dummy-readout-metric>strong')[1]?.textContent?.replaceAll(',', ''));
    return raw > 0 && Math.abs(raw - displayed) <= .011;
  });
  await picture('reset-new-feedback');
  const epoch = await page.evaluate(() => {
    const review = globalThis.__crowdDomReview; review.collect(); review.observer.disconnect();
    const rows = [...review.rows.values()]; return { rows, rawDamage: rows.reduce((sum, row) => sum + row.amount, 0) };
  });
  report.workbenchReset = { before: beforeReset, priorMaximumId, clean: cleanReset, fresh, epoch,
    dummyDisplayedTotal: numeric((await view()).dummyMetrics[1]), poolPreserved: true, independentMeterEpoch: true };
  assert.deepEqual(report.errors, []); report.status = 'passed'; await persist();
  console.log(JSON.stringify({ status: report.status, critical, events: accounting.events, mergedStatusEvents: accounting.mergedStatusEvents,
    rawDamage: accounting.rawDamage, pauseFrozen: true, pool: 40, reload: true, workbenchReset: true, screenshots: report.screenshots, errors: report.errors }));
} catch (error) {
  report.status = 'failed'; report.failure = error.stack ?? error.message; await picture('failure').catch(() => {}); await persist(); throw error;
} finally { await context.close(); await browser.close(); }
