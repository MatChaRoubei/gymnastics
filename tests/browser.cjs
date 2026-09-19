// Optional: PLAYWRIGHT_MODULE, BROWSER_EXE, WUSHU_BASE_URL (including a site subdirectory).
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
const clockStart = new Date('2030-01-01T00:00:00Z');
const failures = [];
let currentPage;

async function click(page, selector) {
  // A real pointer click; bypass animation stability while the test clock is paused.
  await page.locator(selector).click({ force: true });
}

async function openPage(browser, viewport = { width: 1280, height: 900 }) {
  const page = await browser.newPage({ viewport });
  currentPage = page;
  page.on('pageerror', error => failures.push(error.message));
  page.on('requestfailed', request => {
    const reason = request.failure()?.errorText || '';
    if (!reason.includes('ERR_ABORTED')) failures.push(`${request.url()}: ${reason}`);
  });
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) failures.push(`${response.status()}: ${response.url()}`);
  });
  await page.clock.install({ time: clockStart });
  await page.clock.pauseAt(clockStart);
  await page.goto(baseURL);
  await page.clock.runFor(32);
  return page;
}

async function chooseCharacter(page, { gender = 'female', quick = false, level = 'easy', mode = 'standard' } = {}) {
  await page.locator('#quick-mode').setChecked(quick);
  if (quick) await page.locator('#practice-mode').selectOption(mode);
  await click(page, `[data-level="${level}"]`);
  await click(page, `.${gender}`);
  await page.clock.runFor(1500);
}

async function nextLine(page) {
  await page.evaluate(() => { finishCurrentLine(); stopVoice(); advanceStory(); });
  await page.clock.runFor(32);
}

async function jumpToEvent(page, eventName, occurrence = 0) {
  const found = await page.evaluate(({ eventName, occurrence }) => {
    const indices = story.flatMap((line, index) => line.event === eventName ? [index] : []);
    const index = indices[occurrence];
    if (index === undefined) return false;
    finishCurrentLine(); stopVoice();
    storyIndex = index;
    void playEvent(story[storyIndex]);
    return true;
  }, { eventName, occurrence });
  assert(found, `Story is missing ${eventName} event ${occurrence}`);
  await page.clock.runFor(32);
}

async function assertOpening(page, gender) {
  await chooseCharacter(page, { gender });
  const lines = [], voices = [];
  let foundOi = false;
  for (let i = 0; i < 18; i++) {
    await page.evaluate(() => finishCurrentLine());
    const text = await page.locator('#sight-title').textContent();
    const voice = await page.locator('#voice-audio').getAttribute('src');
    lines.push(text); if (voice) voices.push(voice);
    if (/Oi！|Oi!|oi！|oi!/.test(text)) {
      foundOi = true;
      assert.equal(await page.locator('.jiahao-character').evaluate(el => getComputedStyle(el).opacity), '0', '嘉豪必须等 Oi 台词之后出场');
      assert.match(voice || '', /school_open2/);
      await nextLine(page);
      await page.clock.runFor(3500);
      assert.equal(await page.locator('.jiahao-character').evaluate(el => getComputedStyle(el).opacity), '1');
      assert.equal(await page.locator('.jiahao-front').evaluate(el => getComputedStyle(el).opacity), '1', '嘉豪转身后正面必须可见');
      break;
    }
    await nextLine(page);
  }
  assert(foundOi, 'Opening did not reach the Oi voice line');
  if (gender === 'female') {
    assert(lines.some(text => text.includes('这就是高中')));
    assert(!lines.some(text => text.includes('区区高中')), '女角色不应出现男角色开场台词');
    assert(!voices.some(source => source.includes('school_open1')), '女角色不应播放男角色开场配音');
  } else {
    assert(lines.some(text => text.includes('区区高中')));
    assert(!lines.some(text => text.includes('这就是高中')), '男角色不应同时播放女角色开场台词');
    assert(voices.some(source => source.includes('school_open1')));
  }
}

async function waitForPlaying(page) {
  for (let i = 0; i < 100; i++) {
    if (await page.locator('#practice-hit').isVisible() && await page.locator('#practice-hit').isEnabled()) return;
    await page.clock.runFor(100);
  }
  throw new Error('Practice did not leave the countdown / demonstration');
}

async function hitOnePerfect(page, levelKey, tutorial = false) {
  const timing = await page.evaluate(({ levelKey, tutorial }) => {
    const target = document.querySelector('#practice .beat-window');
    const percent = parseFloat(document.querySelector('#beat-dot').style.left) || 0;
    const center = parseFloat(target.style.left) + parseFloat(target.style.width) / 2;
    const beatMs = tutorial ? Math.max(950, WUSHU.difficulties[levelKey].beatMs) : WUSHU.difficulties[levelKey].beatMs;
    return { remaining: (center - percent) / 100 * beatMs * 4 };
  }, { levelKey, tutorial });
  if (timing.remaining > 0) await page.clock.runFor(Math.ceil(timing.remaining));
  await page.keyboard.press('Space');
  assert.match(await page.locator('#practice-feedback').textContent(), /精准|Perfect/i, '中心拍按键应判为精准');
}

async function runPractice(page, { level = 'easy', mode = 'standard' } = {}) {
  await chooseCharacter(page, { quick: true, level, mode });
  // Keyboard activation must select the focused style, not start the round.
  await page.locator('[data-style="fierce"]').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('.style-choice .active').getAttribute('data-style'), 'fierce');
  assert(await page.locator('#practice-start').isVisible());
  await click(page, '#practice-start');
  await waitForPlaying(page);
  await click(page, '#practice-pause');
  const pausedDot = await page.locator('#beat-dot').getAttribute('style');
  await page.clock.runFor(5000);
  assert.equal(await page.locator('#beat-dot').getAttribute('style'), pausedDot, '暂停时节拍不可继续移动');
  assert.match(await page.locator('#practice-feedback').textContent(), /暂停/);
  await click(page, '#practice-pause');
  await page.locator('#practice-hit').focus();
  await hitOnePerfect(page, level);
  // Leave remaining beats unplayed: the same run checks automatic misses and completion.
  await page.clock.fastForward(180000);
  assert(await page.locator('#practice-continue').isVisible(), `${level}/${mode} must reach results`);
  const save = await page.evaluate(() => WushuSave.read());
  const record = save.modeRecords?.[level]?.[mode];
  assert(record && record.points > 0, '本模式应保存本轮真实命中的成绩');
  assert(record.counts['精准'] >= 1 && record.counts['错过'] >= 1, '结果应同时包含精准和自动错过');
  if (mode === 'standard') assert(save.records?.[level], '八式巡礼应同时更新主菜单成绩');
  assert(JSON.stringify(save).includes('fierce'), '保存应记录行拳风格');
  assert.match(await page.locator('#practice').textContent(), /精准/);
  assert.match(await page.locator('#practice').textContent(), /错过|漏拍/);
  await click(page, '#practice-continue');
  await page.clock.runFor(32);
  assert(await page.locator('#difficulty-screen').isVisible(), '快速练习完成应回菜单');
  assert(await page.locator('#sight-screen').isHidden(), '快速练习不能误接剧情后半段');
}

async function assertTutorial(page) {
  const recordsBefore = await page.evaluate(() => WushuSave.read().records || {});
  await click(page, '#tutorial-button');
  await page.clock.runFor(32);
  assert(await page.locator('#practice-start').isVisible());
  await click(page, '#practice-start');
  await waitForPlaying(page);
  await page.locator('#practice-hit').focus();
  await hitOnePerfect(page, 'easy', true);
  await page.clock.fastForward(30000);
  assert(await page.locator('#practice-continue').isVisible());
  assert.deepEqual(await page.evaluate(() => WushuSave.read().records || {}), recordsBefore, '教程不能写入正式排行榜成绩');
  await click(page, '#practice-continue');
  assert(await page.locator('#difficulty-screen').isVisible());
}

async function assertFullCombo(page) {
  await chooseCharacter(page, { quick: true });
  await click(page, '#practice-start');
  await page.clock.runFor(500);
  assert.equal(await page.locator('#practice').getAttribute('data-state'), 'countdown');
  await click(page, '#practice-pause');
  const count = await page.locator('#countdown-number').textContent();
  await page.clock.runFor(5000);
  assert.equal(await page.locator('#countdown-number').textContent(), count, '倒数也应可暂停');
  await page.keyboard.press('Escape');
  await waitForPlaying(page);
  const rounds = await page.evaluate(() => WUSHU.difficulties.easy.rounds);
  for (let round = 0; round < rounds; round++) {
    await page.locator('#practice-hit').focus();
    await hitOnePerfect(page, 'easy');
    const score = await page.locator('#practice-score').textContent();
    await page.keyboard.press('Space');
    assert.equal(await page.locator('#practice-score').textContent(), score, '同一招只能计分一次');
    const remaining = await page.evaluate(() =>
      (1 - parseFloat(document.querySelector('#beat-dot').style.left) / 100) * WUSHU.difficulties.easy.beatMs * 4);
    await page.clock.runFor(Math.ceil(remaining) + 32);
  }
  assert.equal(await page.locator('#result-perfect').textContent(), String(rounds));
  assert.equal(await page.locator('#result-combo').textContent(), String(rounds));
  assert.equal(await page.locator('#result-grade').textContent(), 'S');
  const save = await page.evaluate(() => WushuSave.read());
  assert(save.achievements.includes('spirit_burst'), '全精准应触发少年意气并解锁成就');
  const runs = save.totalRuns;
  await click(page, '#practice-continue');
  assert.equal(await page.evaluate(() => WushuSave.read().totalRuns), runs, '离开成绩页不能重复保存同一轮');
}

async function assertMashNeverScores(page) {
  await chooseCharacter(page, { quick: true });
  await click(page, '#practice-start');
  await waitForPlaying(page);
  await page.locator('#practice-hit').focus();
  const rounds = await page.evaluate(() => WUSHU.difficulties.easy.rounds);
  for (let round = 0; round < rounds; round++) {
    await page.keyboard.press('Space');
    await page.clock.runFor(24);
    assert.match(await page.locator('#practice-feedback').textContent(), /太早/, '第一次过早出招只提醒');
    await page.keyboard.press('Space');
    await page.clock.runFor(24);
    assert.match(await page.locator('#practice-feedback').textContent(), /抢拍/, '第二次过早出招应直接判错过');
    await page.keyboard.press('Space');
    // 每次按当前拍点补足剩余时间，本招结束即进入下一招，误差不会累积。
    const remaining = await page.evaluate(() =>
      (1 - parseFloat(document.querySelector('#beat-dot').style.left) / 100) * WUSHU.difficulties.easy.beatMs * 4);
    await page.clock.runFor(Math.ceil(remaining) + 8);
  }
  // 收尾：循环可能刚好停在回合边界，再多跑几帧让末招结算。
  await page.clock.runFor(600);
  assert(await page.locator('#practice-continue').isVisible(), '连点也应走完整轮并进入结算');
  assert.equal(await page.locator('#result-perfect').textContent(), '0', '连点不应拿到精准分');
  assert.equal(await page.locator('#result-good').textContent(), '0', '连点不应拿到合格分');
  assert.equal(await page.locator('#result-missed').textContent(), String(rounds), '抢拍连点应全部记为错过');
  assert.equal(await page.locator('#result-combo').textContent(), '0', '抢拍应断开连击');
  assert.equal(await page.locator('#result-grade').textContent(), 'C');
  const record = await page.evaluate(() => WushuSave.read().modeRecords?.easy?.standard || null);
  assert(record?.timing?.mashPenalties === rounds, '结算应记录抢拍判罚次数');
  assert.match(await page.locator('#result-advice').textContent(), /抢拍/, '建议应指出抢拍问题');
  await click(page, '#practice-continue');
  await page.clock.runFor(32);
  assert(await page.locator('#difficulty-screen').isVisible());
}

async function assertJudgeOffsetSetting(page) {
  await click(page, '#help-button');
  await page.clock.runFor(32);
  assert(await page.locator('#calibration-button').isVisible(), '设置里应提供节奏校准');
  await page.locator('#judge-offset').evaluate(node => { node.value = '60'; node.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.clock.runFor(32);
  assert.equal(await page.locator('#judge-offset-value').textContent(), '+60 毫秒');
  assert.equal(await page.evaluate(() => WushuSave.read().settings.judgeOffset), 60, '判定补偿应写入设置');
  await click(page, '#info-dialog form button');
  await page.clock.runFor(32);
  await chooseCharacter(page, { quick: true });
  assert.match(await page.locator('#practice-help').textContent(), /判定补偿 \+60 毫秒/, '练习应读取判定补偿');
  await click(page, '#practice-exit');
  await page.clock.runFor(32);
  assert(await page.locator('#difficulty-screen').isVisible(), '退出练习应回到菜单');
}

async function assertCalibrationRun(page) {
  await click(page, '#help-button');
  await page.clock.runFor(32);
  await click(page, '#calibration-button');
  assert(await page.locator('#calibration-tap').isVisible(), '校准开始后应出现跟拍按钮');
  // 每次都比提示音晚 30 毫秒点击，中位数应写入 +30。
  await page.clock.runFor(730);
  for (let beat = 0; beat < 8; beat++) {
    await click(page, '#calibration-tap');
    if (beat < 7) await page.clock.runFor(600);
  }
  assert.equal(await page.evaluate(() => WushuSave.read().settings.judgeOffset), 30, '8 次偏晚 30 毫秒应写入 +30');
  assert.match(await page.locator('#calibration-status').textContent(), /已写入判定补偿 \+30 毫秒/);
  assert(await page.locator('#calibration-button').isVisible(), '校准结束后应恢复开始按钮');
  await click(page, '#info-dialog form button');
  await page.clock.runFor(32);
  assert(await page.locator('#info-dialog').isHidden());
  assert.equal(await page.evaluate(() => WushuSave.read().settings.judgeOffset), 30, '关闭设置不应丢失校准结果');
}

async function assertImageAssets(browser) {
  // 立绘从 PNG 换成 WebP 后，逐个确认页面里引用的图片真的能解码出像素。
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  currentPage = page;
  page.on('pageerror', error => failures.push(error.message));
  await page.goto(baseURL);
  const sources = await page.evaluate(() =>
    [...new Set([...document.querySelectorAll('img')].map(image => image.getAttribute('src')).filter(Boolean))]);
  assert(sources.length >= 4, '应能读到页面里的四张角色图');
  const broken = await page.evaluate(async list => {
    const failed = [];
    for (const source of list) {
      const loaded = await new Promise(resolve => {
        const probe = new Image();
        probe.onload = () => resolve(probe.naturalWidth > 0 && probe.naturalHeight > 0);
        probe.onerror = () => resolve(false);
        probe.src = source;
      });
      if (!loaded) failed.push(source);
    }
    return failed;
  }, sources);
  assert.deepEqual(broken, [], '页面引用的每张图片都必须能加载');
}

async function assertAudioAssets(browser) {
  // 配乐换格式后最容易出问题的是编解码：这里逐个解码，确认能真正播放。
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  currentPage = page;
  page.on('pageerror', error => failures.push(error.message));
  await page.goto(baseURL);
  const sources = await page.evaluate(() => Object.entries(musicSources));
  assert(sources.length >= 7, '应能读到全部配乐路径');
  const failed = await page.evaluate(async list => {
    const broken = [];
    for (const [name, source] of list) {
      const playable = await new Promise(resolve => {
        const audio = new Audio();
        const settle = value => { audio.onloadedmetadata = audio.onerror = null; audio.removeAttribute('src'); resolve(value); };
        audio.onloadedmetadata = () => settle(audio.duration > 0);
        audio.onerror = () => settle(false);
        audio.src = source;
      });
      if (!playable) broken.push(`${name} ${source}`);
    }
    return broken;
  }, sources);
  assert.deepEqual(failed, [], '每个配乐都必须在浏览器里解码成功');
}

async function assertMobile(browser) {
  for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
    const page = await openPage(browser, viewport);
    for (const level of ['easy', 'normal', 'hard']) {
      const button = page.locator(`[data-level="${level}"]`);
      const rect = await button.boundingBox();
      assert(rect && rect.x >= -1 && rect.x + rect.width <= viewport.width + 1, `${viewport.width}px ${level} 按钮被裁切`);
      await button.scrollIntoViewIfNeeded();
      await button.click({ force: true });
      assert(await page.locator('#character-screen').isVisible());
      await click(page, '#back-button');
    }
    await chooseCharacter(page, { quick: true });
    for (const id of ['practice-start', 'practice-exit']) {
      await page.locator(`#${id}`).scrollIntoViewIfNeeded();
      const rect = await page.locator(`#${id}`).boundingBox();
      assert(rect && rect.y >= -1 && rect.y + rect.height <= viewport.height + 1, `${viewport.width}×${viewport.height} 无法滚到 ${id}`);
    }
    await click(page, '#practice-exit');
    assert(await page.locator('#difficulty-screen').isVisible());
    await page.close();
  }
}

async function assertSaveRecovery(page) {
  await page.evaluate(() => { WushuSave.write({ settings: { practiceStyle: 'fierce' } }); saveSettings(); });
  assert.equal(await page.evaluate(() => WushuSave.read().settings.practiceStyle), 'fierce', '更改其他设置不可丢失行拳风格');
  for (const corrupted of ['{invalid json', JSON.stringify({ settings: { musicVolume: 2, textSpeed: -10 }, achievements: 7, records: 'bad' })]) {
    await page.evaluate(value => localStorage.setItem('wushu-v1', value), corrupted);
    await page.reload();
    await page.clock.runFor(32);
    assert(await page.locator('#easy-button').isVisible());
    await click(page, '#help-button');
    assert(await page.locator('#info-dialog').isVisible(), '损坏存档后仍应可以操作');
    await click(page, '#info-dialog form button');
  }
}

async function selectStoryChoice(page, occurrence, optionId) {
  await jumpToEvent(page, 'choice', occurrence);
  assert(await page.locator('#story-choice').isVisible());
  const optionIndex = await page.evaluate(({ occurrence, optionId }) =>
    story.filter(line => line.event === 'choice')[occurrence].options.findIndex(option => option.id === optionId),
  { occurrence, optionId });
  assert(optionIndex >= 0, `Missing story option ${optionId}`);
  await page.locator('#choice-options button').nth(optionIndex).click({ force: true });
  await page.clock.runFor(32);
  await page.evaluate(() => finishCurrentLine());
}

async function assertChoiceResumeAndEndings(page) {
  const routes = [
    { ending: 'together', options: ['friendly', 'together', 'listen'] },
    { ending: 'lead', options: ['bold', 'call_out', 'lead'] },
    { ending: 'steady', options: ['careful', 'organize', 'count'] },
  ];
  for (const [routeIndex, route] of routes.entries()) {
    await chooseCharacter(page, { gender: 'female' });
    for (let index = 0; index < route.options.length; index++) {
      await selectStoryChoice(page, index, route.options[index]);
      if (routeIndex === 0 && index === 0) {
        const before = await page.evaluate(() => ({ index: storyIndex, text: currentLineText }));
        await page.reload();
        await click(page, '#resume-button');
        await page.clock.runFor(1500);
        await page.evaluate(() => finishCurrentLine());
        assert.deepEqual(await page.evaluate(() => ({ index: storyIndex, text: currentLineText })), before,
          '选项后的存档应恢复同一句，不可重加选项属性');
      }
    }
    // Gameplay itself is tested above; inject its outcome here to cover every narrative branch efficiently.
    await page.evaluate(() => {
      const result = { accuracy: 100, bestCombo: 8, points: 1000, level: 'easy', style: 'steady', counts: { 精准: 8, 合格: 0, 错过: 0 } };
      gameState.practiceResult = result;
      gameState.practiceResults = { standard: result, relay: { ...result, mode: 'relay' } };
    });
    await jumpToEvent(page, 'ending');
    assert(await page.locator('#ending-screen').isVisible());
    const title = await page.evaluate(key => WUSHU.endings[key].title, route.ending);
    assert((await page.locator('#ending-screen').textContent()).includes(title), `Expected ${route.ending} ending`);
    await click(page, '#ending-home');
    assert(await page.locator('#difficulty-screen').isVisible());
  }
  const save = await page.evaluate(() => WushuSave.read());
  for (const route of routes) assert(JSON.stringify(save.endings).includes(route.ending), `${route.ending} should be permanently unlocked`);
  await click(page, '#journal-button');
  for (const section of ['moves', 'records', 'endings']) {
    await click(page, `[data-journal="${section}"]`);
    assert(await page.locator('#journal-dialog').isVisible());
    assert((await page.locator('#journal-dialog').textContent()).trim().length > 20);
  }
  const titles = await page.evaluate(() => Object.values(WUSHU.endings).map(ending => ending.title));
  const journal = await page.locator('#journal-dialog').textContent();
  for (const title of titles) assert(journal.includes(title), '手记应显示已解锁的三个结局');
  await click(page, '#journal-dialog form button');
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_EXE });
  try {
    for (const gender of ['female', 'male']) {
      const page = await openPage(browser);
      await assertOpening(page, gender);
      await page.close();
    }
    console.log('PASS: gender-specific opening, voice routing, Oi → back → front');
    const tutorialPage = await openPage(browser);
    await assertTutorial(tutorialPage);
    await tutorialPage.close();
    console.log('PASS: tutorial precise hit, completion, no formal score pollution');
    for (const options of [{ level: 'easy', mode: 'standard' }, { level: 'normal', mode: 'relay' }, { level: 'hard', mode: 'standard' }]) {
      const page = await openPage(browser);
      await runPractice(page, options);
      await page.close();
    }
    console.log('PASS: all difficulties, standard + relay, keyboard style, precise hit, misses, pause, saved result, quick return');
    const comboPage = await openPage(browser);
    await assertFullCombo(comboPage);
    await comboPage.close();
    console.log('PASS: countdown pause, full perfect combo, S grade, spirit achievement, one judgment per move');
    const mashPage = await openPage(browser);
    await assertMashNeverScores(mashPage);
    await mashPage.close();
    console.log('PASS: mashing space always misses, combo breaks, penalty recorded, advice warns about 抢拍');
    const offsetPage = await openPage(browser);
    await assertJudgeOffsetSetting(offsetPage);
    await offsetPage.close();
    console.log('PASS: judge offset calibration control persists and reaches practice');
    const calibrationPage = await openPage(browser);
    await assertCalibrationRun(calibrationPage);
    await calibrationPage.close();
    console.log('PASS: 8-beat calibration measures a +30ms median and survives closing settings');
    const storyPage = await openPage(browser);
    await assertChoiceResumeAndEndings(storyPage);
    await storyPage.close();
    console.log('PASS: all nine choices, reload + resume, three endings, journal');
    await assertMobile(browser);
    console.log('PASS: 390px / 320px / short landscape button bounds and reachable practice controls');
    await assertImageAssets(browser);
    console.log('PASS: every <img> on the page decodes (png → webp swap)');
    await assertAudioAssets(browser);
    console.log('PASS: every music track decodes in the browser after the webp/mp3 asset swap');
    const page = await openPage(browser);
    await assertSaveRecovery(page);
    await page.close();
    assert.deepEqual(failures, [], 'Browser errors or missing assets');
    console.log('PASS: settings merge, malformed-save recovery, no browser errors or missing assets');
  } catch (error) {
    if (currentPage && !currentPage.isClosed()) {
      const screenshot = path.join(os.tmpdir(), `wushu-test-failure-${Date.now()}.png`);
      await currentPage.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
      console.error(`Failure screenshot: ${screenshot}`);
    }
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
