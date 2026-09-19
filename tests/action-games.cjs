const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXE });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.evaluate(() => {
      document.querySelector('#forms').hidden = false;
      window.mountAction = name => {
        document.querySelector('#forms-stage').dataset.game = name === 'fight' ? 'tigerstrike' : 'tide';
        window.result = null; window.active = true;
        WushuActionGames[name]({
          level: 'easy', random: () => .5, playing: () => window.active,
          gameShell(title, help) {
            const shell = document.createElement('div'); shell.className = 'forms-game';
            const h = document.createElement('h4'); h.textContent = title;
            const p = document.createElement('p'); p.textContent = help; shell.append(h, p);
            document.querySelector('#forms-playfield').replaceChildren(shell); return shell;
          },
          setRuntime: r => { window.actionRuntime = r; },
          complete: (score, detail) => { window.result = { score, detail }; window.active = false; },
          feedback: text => { document.querySelector('#forms-feedback').textContent = text; }, tone() {},
        });
        window.stepAction = ms => { for (let t = 0; t < ms && window.active; t += 10) window.actionRuntime.update(Math.min(10, ms - t)); };
      };
      mountAction('fight');
      actionRuntime.onKeyDown('j');
    });
    assert.equal(await page.locator('canvas').getAttribute('data-health'), '92', '抢招应被惩罚');
    await page.evaluate(() => {
      mountAction('fight'); stepAction(1800); actionRuntime.onKeyDown('k'); stepAction(200);
      actionRuntime.onKeyUp('k'); actionRuntime.onKeyDown('j'); stepAction(340);
      actionRuntime.onKeyDown('j'); stepAction(340); actionRuntime.onKeyDown('l');
    });
    assert.equal(await page.locator('canvas').getAttribute('data-health'), '100', '格挡保住架势');
    assert.equal(await page.locator('canvas').getAttribute('data-enemy'), '58', '两轻拳接重拳');
    await page.evaluate(async () => {
      await Promise.all(['resources/character/jiahao_front_start.webp', 'resources/character/training_dummy_v1.webp', 'resources/scene/sight/training_arena_v1.webp', 'resources/scene/sight/tide_court_v1.webp'].map(async src => {
        const img = new Image(); img.src = src; await img.decode();
      }));
      stepAction(10);
    });
    await page.screenshot({ path: path.join(require('node:os').tmpdir(), 'wushu-action-fight.png'), fullPage: true });
    await page.evaluate(() => { stepAction(4000); actionRuntime.timeout(); });
    assert((await page.evaluate(() => result.score)) >= 0);
    await page.evaluate(() => {
      mountAction('tide'); stepAction(4500); actionRuntime.onKeyDown('x');
      actionRuntime.onKeyDown('x'); actionRuntime.onKeyDown('d'); stepAction(300);
      actionRuntime.onPause(); stepAction(300);
    });
    assert(await page.getByRole('button', { name: '清场已用' }).isDisabled());
    await page.screenshot({ path: path.join(require('node:os').tmpdir(), 'wushu-action-tide.png'), fullPage: true });
    for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      for (const game of ['fight', 'tide']) {
        await page.evaluate(name => mountAction(name), game);
        for (const button of await page.locator('.action-controls button').all()) {
          await button.scrollIntoViewIfNeeded();
          const rect = await button.boundingBox();
          assert(rect.x >= 0 && rect.x + rect.width <= viewport.width, `${game} 控件不能横向越界`);
          assert(await button.evaluate(b => {
            const r = b.getBoundingClientRect();
            return b.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
          }), `${game} 控件不能被遮挡`);
        }
      }
    }
    await page.evaluate(() => { stepAction(18000); actionRuntime.timeout(); });
    assert(Number.isFinite(await page.evaluate(() => result.score)));
    assert.deepEqual(errors, []);
    console.log('PASS: 抢招惩罚、精准格挡、轻重连招、一次清场、结算、手机及横屏控件可点击');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
