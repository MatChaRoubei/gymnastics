// PLAYWRIGHT_MODULE and BROWSER_EXE may point to an existing local browser runtime.
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
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXE });
  try {
    for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 320, height: 568 }]) {
      const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
      assert.equal(await page.locator('#cast-portrait').getAttribute('src'), null, 'Menu must not load portraits');
      await page.evaluate(() => { showScreen('sight'); setScene('yard'); });
      for (const name of ['陈佳佳', '张鹏', '王磊']) {
        await page.evaluate(name => {
          renderLine({ speaker: name, text: '今天第一件事是签到，第二件事是别把名单当成午饭菜单。都看着我干什么，嘉豪已经拿反了。' }, false);
          finishCurrentLine();
        }, name);
        await page.waitForFunction(() => {
          const image = document.querySelector('#cast-portrait');
          return !image.hidden && image.complete && image.naturalWidth > 0;
        });
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const geometry = await page.evaluate(() => {
          const image = document.querySelector('#cast-portrait');
          const r = image.getBoundingClientRect(), d = document.querySelector('#novel-dialogue').getBoundingClientRect();
          const toolbar = document.querySelector('.story-tools').getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, dialogue: d.top, toolbar: toolbar.bottom, visible: getComputedStyle(image).visibility !== 'hidden' };
        });
        if (geometry.visible) {
          assert(geometry.left >= 0 && geometry.right <= viewport.width, 'Portrait must fit horizontally');
          assert(geometry.top >= geometry.toolbar && geometry.bottom <= geometry.dialogue, 'Portrait must avoid controls and text');
        }
        await page.evaluate(() => { renderLine({ text: '他身后的同学叹了口气。' }, false); finishCurrentLine(); });
        assert.equal(await page.locator('#cast-portrait').evaluate(image => image.hidden), false, 'Narration retains the last character');
      }
      await page.evaluate(() => {
        renderLine({ speaker: '陈佳佳', text: '先签到。' }, false);
        renderLine({ speaker: '张鹏', text: '鼓手还缺一个。' }, false);
        renderLine({ speaker: '王磊', text: '下次一定。' }, false);
        finishCurrentLine();
      });
      await page.waitForFunction(() => {
        const image = document.querySelector('#cast-portrait');
        return !image.hidden && image.complete && image.getAttribute('src').includes('wang_lei');
      });
      await page.evaluate(() => { setScene('exercise'); });
      assert(await page.locator('#cast-portrait').isHidden(), 'Scene changes clear the portrait');
      await page.evaluate(() => { renderLine({ speaker: '嘉豪', text: '本座来了。' }, false); finishCurrentLine(); });
      assert.equal(await page.locator('#sight-screen').evaluate(el => el.classList.contains('has-cast-portrait')), false);
      assert.deepEqual(errors, []);
      if (process.env.CAST_SCREENSHOT) {
        await page.evaluate(() => { renderLine({ speaker: '张鹏', text: '行，你负责给效果器供电。' }, false); finishCurrentLine(); });
        await page.waitForFunction(() => !document.querySelector('#cast-portrait').hidden);
        await page.screenshot({ path: `${process.env.CAST_SCREENSHOT}-${viewport.width}.png`, fullPage: true });
      }
      console.log(`PASS: ${viewport.width}px portraits, narration, fast switching, scene reset and lazy loading`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
