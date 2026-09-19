// Optional: PLAYWRIGHT_MODULE, BROWSER_EXE, WUSHU_BASE_URL.
function loadPlaywright() {
  // 优先用 PLAYWRIGHT_MODULE 指定的模块；否则依次尝试 playwright / playwright-core。
  const attempts = [process.env.PLAYWRIGHT_MODULE, 'playwright', 'playwright-core'].filter(Boolean);
  for (const name of attempts) {
    try { return require(name); } catch { /* 试下一个 */ }
  }
  throw new Error('未找到 Playwright：先 npm install，或用 PLAYWRIGHT_MODULE 指向已安装的模块。');
}
const { chromium } = loadPlaywright();
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
  await page.goto(baseURL);
  await page.clock.runFor(32);
  return page;
}

async function openQuickChallenge(page, mode, level = 'easy') {
  await page.locator('#quick-mode').setChecked(true);
  await page.locator('#practice-mode').selectOption(mode);
  await click(page, `[data-level="${level}"]`);
  await click(page, '.female');
  await page.clock.runFor(1500);
  assert(await page.locator('#adventure').isVisible(), `${mode} 应进入校园挑战层`);
  assert.equal(await page.locator('#adventure').getAttribute('data-mode'), mode);
}

async function playPaper(page) {
  await page.evaluate(() => WushuSave.write({ records: { easy: { points: 100, grade: 'C' } } }));
  await openQuickChallenge(page, 'paper');
  assert((await page.locator('#adventure-help').textContent()).includes('页码'));
  await click(page, '#adventure-start');
  assert.equal(await page.locator('.flying-paper').count(), 8, '简单难度应有五张名单和三个干扰项');

  const beforePause = await page.locator('#adventure-secondary').textContent();
  await click(page, '#adventure-pause');
  await page.clock.runFor(5000);
  assert.equal(await page.locator('#adventure-secondary').textContent(), beforePause, '暂停时倒计时必须冻结');
  await click(page, '#adventure-pause');

  for (let pageNumber = 1; pageNumber <= 5; pageNumber++) {
    await click(page, `.flying-paper[data-page="${pageNumber}"]`);
    await page.clock.runFor(20);
  }
  assert(await page.locator('#adventure-result').isVisible(), '名单收齐后应出现结算');
  assert.equal(await page.locator('#adventure-grade').textContent(), 'S');
  let save = await page.evaluate(() => WushuSave.read());
  assert.equal(save.adventureRecords.easy.paper.correct, 5);
  assert(save.achievements.includes('paper_chaser'));
  const challenges = save.totalChallenges;
  await click(page, '#adventure-continue');
  assert(await page.locator('#difficulty-screen').isVisible(), '直接挑战完成后应回菜单');
  save = await page.evaluate(() => WushuSave.read());
  assert.equal(save.totalChallenges, challenges, '离开结算不可重复保存');
}

async function playSpar(page) {
  await openQuickChallenge(page, 'spar');
  assert((await page.locator('#adventure-help').textContent()).includes('重心'));
  await click(page, '#adventure-start');
  for (let round = 0; round < 5; round++) {
    const answer = await page.locator('#spar-cue').getAttribute('data-answer');
    await click(page, `[data-tactic="${answer}"]`);
    assert((await page.locator('#adventure-feedback').textContent()).includes('判断正确'));
    await click(page, '#adventure-next');
    await page.clock.runFor(20);
  }
  assert(await page.locator('#adventure-result').isVisible(), '最后一回合后应出现结算');
  assert.equal(await page.locator('#adventure-grade').textContent(), 'S');
  const save = await page.evaluate(() => WushuSave.read());
  assert.equal(save.adventureRecords.easy.spar.correct, 5);
  assert(save.achievements.includes('stance_reader'));
  assert(save.achievements.includes('all_rounder'), '节奏、观察和策略都完成后应解锁文武全勤');
  await click(page, '#adventure-continue');
  assert(await page.locator('#difficulty-screen').isVisible());

  await click(page, '#journal-button');
  await click(page, '[data-journal="records"]');
  const journal = await page.locator('#journal-dialog').textContent();
  assert(journal.includes('风中名单') && journal.includes('拆招预演'), '手记应显示两种校园挑战记录');
}

async function assertStoryReturn(page) {
  await page.reload();
  await page.clock.runFor(32);
  await click(page, '[data-level="easy"]');
  await click(page, '.male');
  await page.clock.runFor(1500);
  await page.evaluate(() => {
    const index = story.findIndex(line => line.event === 'adventure' && line.mode === 'spar');
    finishCurrentLine(); stopVoice(); storyIndex = index; void playEvent(story[index]);
  });
  await page.clock.runFor(32);
  await click(page, '#adventure-start');
  for (let round = 0; round < 5; round++) {
    const answer = await page.locator('#spar-cue').getAttribute('data-answer');
    await click(page, `[data-tactic="${answer}"]`);
    await click(page, '#adventure-next');
  }
  await click(page, '#adventure-continue');
  await page.clock.runFor(32);
  assert(await page.locator('#sight-screen').isVisible());
  assert(await page.locator('#adventure').isHidden());
  assert((await page.locator('#sight-title').textContent()).includes('动作还没完全做出来'), '挑战结果应进入后续剧情台词');
}

async function assertMobile(browser) {
  const page = await openPage(browser, { width: 320, height: 568 });
  await openQuickChallenge(page, 'spar');
  for (const id of ['adventure-start', 'adventure-exit']) {
    await page.locator(`#${id}`).scrollIntoViewIfNeeded();
    const rect = await page.locator(`#${id}`).boundingBox();
    assert(rect && rect.x >= -1 && rect.x + rect.width <= 321, `320px 下 ${id} 不应被横向裁切`);
  }
  await click(page, '#adventure-exit');
  assert(await page.locator('#difficulty-screen').isVisible());
  await page.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXE });
  try {
    const page = await openPage(browser);
    await playPaper(page);
    await playSpar(page);
    await click(page, '#journal-dialog form button');
    await assertStoryReturn(page);
    await page.close();
    await assertMobile(browser);
    console.log('PASS: 风中名单、拆招预演、暂停、存档、成就、剧情续接、手记与 320px 布局');
  } catch (error) {
    if (currentPage && !currentPage.isClosed()) {
      const screenshot = path.join(os.tmpdir(), `wushu-adventure-failure-${Date.now()}.png`);
      await currentPage.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
      console.error(`Failure screenshot: ${screenshot}`);
    }
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
