// Optional: PLAYWRIGHT_MODULE, BROWSER_EXE, WUSHU_BASE_URL.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');

const baseURL = process.env.WUSHU_BASE_URL || pathToFileURL(path.resolve(__dirname, '../index.html')).href;
let currentPage;

async function click(page, selector) {
  await page.locator(selector).click({ force: true });
}

async function openPage(browser, viewport = { width: 1280, height: 900 }) {
  const page = await browser.newPage({ viewport });
  currentPage = page;
  await page.clock.install({ time: new Date('2030-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2030-01-01T00:00:00Z'));
  await page.goto(baseURL); await page.clock.runFor(32);
  return page;
}

async function openForms(page) {
  await page.locator('#quick-mode').setChecked(true);
  await page.locator('#practice-mode').selectOption('forms');
  await click(page, '[data-level="easy"]');
  await click(page, '.female');
  await page.clock.runFor(1500);
  assert(await page.locator('#forms').isVisible());
  await click(page, '#forms-start');
}

async function finishEveryFormByTimeout(page) {
  const expected = ['salute', 'crane', 'union', 'tigerstep', 'tigerstrike', 'tide', 'push', 'breath'];
  for (let index = 0; index < expected.length; index++) {
    assert.equal(await page.locator('#forms-stage').getAttribute('data-game'), expected[index]);
    assert(await page.locator('#forms-playfield .forms-game').isVisible(), `${expected[index]} 应渲染可玩区域`);
    if (index === 0) {
      await click(page, '.forms-pads button:nth-child(1)');
      await click(page, '.forms-pads button:nth-child(2)');
    }
    await page.clock.fastForward(40000);
    assert(await page.locator('#forms-round-result').isVisible(), `${expected[index]} 超时后也必须结算，不可卡关`);
    await click(page, '#forms-next');
    await page.clock.runFor(20);
  }
  assert(await page.locator('#forms-final').isVisible());
  const save = await page.evaluate(() => WushuSave.read());
  assert(save.formRecords?.easy, '八式百炼应保存独立纪录');
  assert.equal(save.formRecords.easy.forms.length, 8);
  assert(save.achievements.includes('eight_ways'));
  const runs = save.totalFormRuns;
  await click(page, '#forms-continue');
  assert(await page.locator('#difficulty-screen').isVisible());
  assert.equal(await page.evaluate(() => WushuSave.read().totalFormRuns), runs, '离开总评不能重复保存');
}

async function assertPause(page) {
  await openForms(page);
  await click(page, '#forms-pause');
  assert.equal(await page.locator('#forms').getAttribute('data-state'), 'paused');
  const time = await page.locator('#forms-time').textContent();
  await page.clock.runFor(10000);
  assert.equal(await page.locator('#forms-time').textContent(), time);
  await click(page, '#forms-pause');
  assert.equal(await page.locator('#forms').getAttribute('data-state'), 'playing');
  await click(page, '#forms-exit');
  assert(await page.locator('#difficulty-screen').isVisible());
}

async function assertMobile(browser) {
  const page = await openPage(browser, { width: 320, height: 568 });
  await openForms(page);
  for (const id of ['forms-pause', 'forms-exit']) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    const rect = await page.locator(`#${id}`).boundingBox();
    assert(rect && rect.x >= -1 && rect.x + rect.width <= 321, `320px 下 ${id} 不应被横向裁切`);
  }
  await click(page, '#forms-exit'); await page.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXE });
  try {
    const page = await openPage(browser);
    await openForms(page); await finishEveryFormByTimeout(page); await assertPause(page); await page.close();
    await assertMobile(browser);
    console.log('PASS: 八种动作游戏、超时保护、总评、存档、暂停与 320px 布局');
  } catch (error) {
    if (currentPage && !currentPage.isClosed()) {
      const screenshot = path.join(os.tmpdir(), `wushu-forms-failure-${Date.now()}.png`);
      await currentPage.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
      console.error(`Failure screenshot: ${screenshot}`);
    }
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
