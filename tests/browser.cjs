const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { pathToFileURL } = require('url');
const path = require('path');
const assert = require('assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXE });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
  await page.locator('#help-button').click();
  await page.locator('#text-speed').selectOption('0');
  await page.locator('dialog button').click();
  // 嘉豪的转身最终状态与下一句。
  await page.locator('#easy-button').click();
  await page.locator('.male').click();
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    stopVoice();
    storyIndex = story.findIndex(line => line.event === 'jiahaoEntrance');
    playEvent(story[storyIndex]);
  });
  await page.waitForTimeout(3300);
  assert.equal(await page.locator('.jiahao-character').evaluate(el => getComputedStyle(el).opacity), '1');
  assert.equal(await page.locator('.jiahao-front').evaluate(el => getComputedStyle(el).opacity), '1');
  await page.locator('#story-log').click();
  assert(await page.locator('#info-body').textContent());
  await page.locator('dialog button').click();
  await page.locator('#story-home').click();
  // 每档完成一次。只加快测试时钟，不改生产配置。
  for (const level of ['easy', 'normal', 'hard']) {
    await page.locator('#quick-mode').check();
    await page.locator('[data-level="' + level + '"]').click();
    await page.locator('.female').click();
    await page.locator('#practice-start').waitFor({ state: 'visible' });
    await page.locator('#practice-start').click();
    await page.locator('#practice-pause').click();
    assert.match(await page.locator('#practice-feedback').textContent(), /暂停/);
    await page.locator('#practice-pause').click();
    await page.evaluate(() => {
      const actual = performance.now.bind(performance);
      performance.now = () => actual() + 120000;
      const original = window.requestAnimationFrame;
      window.requestAnimationFrame = cb => original(t => cb(t + 120000));
    });
    await page.locator('#practice-continue').waitFor({ state: 'visible' });
    assert.match(await page.locator('#practice-feedback').textContent(), /命中率/);
    await page.locator('#practice-continue').click();
    await page.locator('#story-home').click();
    await page.reload();
  }
  assert.match(await page.locator('#personal-best').textContent(), /困难：0 分/);
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.locator('#quick-mode').check();
  await page.locator('#easy-button').click();
  await page.locator('.male').click();
  await page.locator('#practice-start').waitFor({ state: 'visible' });
  await page.locator('#practice-exit').click();
  await page.locator('#easy-button').waitFor({ state: 'visible' });
  assert.deepEqual(errors, []);
  console.log('PASS: character turn, log, settings, three levels, pause, results, storage, mobile width, exit');
  await browser.close();
})().catch(error => { console.error(error); process.exit(1); });
