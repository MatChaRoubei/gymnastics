(() => {
  const el = id => document.getElementById(id);
  const panel = el('adventure'), stage = el('adventure-stage');
  const paperField = el('paper-field'), sparField = el('spar-field');
  const startButton = el('adventure-start'), pauseButton = el('adventure-pause');
  const continueButton = el('adventure-continue'), nextButton = el('adventure-next');
  const insightButton = el('insight-button'), resultPanel = el('adventure-result');
  const paperPages = ['高一三班', '场地编号', '搭档名单', '目标拍表', '器材确认', '教师备注', '归还签字'];
  const decoys = ['番茄炒蛋', '今日值日', '失物招领', '社团海报', '空白草稿'];
  const positions = [
    [11, 24, -8], [35, 16, 5], [63, 20, -4], [86, 29, 9], [74, 55, -7],
    [46, 48, 4], [19, 59, -10], [91, 72, 7], [57, 74, -5], [31, 79, 8],
    [8, 82, 4], [82, 12, -6],
  ];
  const settingsByLevel = {
    easy: { paperTotal: 5, decoyTotal: 3, seconds: 36, sparRounds: 5, composure: 4, insight: 2 },
    normal: { paperTotal: 6, decoyTotal: 4, seconds: 31, sparRounds: 6, composure: 3, insight: 1 },
    hard: { paperTotal: 7, decoyTotal: 5, seconds: 26, sparRounds: 7, composure: 3, insight: 0 },
  };
  const tacticLabels = {
    root: { name: '守中', detail: '稳住中心 · 不追虚势' },
    yield: { name: '卸步', detail: '让开正面 · 化直为斜' },
    intercept: { name: '截线', detail: '看清绕侧 · 提前封住' },
  };
  const attacks = [
    { pattern: 'straight', mark: '震', title: '直进压线', text: '嘉豪肩线前沉，脚步直取中线。', answer: 'yield', explain: '直来宜让：卸开正面，让力量从身侧过去。' },
    { pattern: 'bait', mark: '引', title: '虚手引动', text: '嘉豪前手轻晃，重心却没有真正送出。', answer: 'root', explain: '虚引宜守：不追第一下，中心就不会被带走。' },
    { pattern: 'circle', mark: '绕', title: '绕侧探位', text: '嘉豪沿白线横移，视线越过你的肩侧。', answer: 'intercept', explain: '绕侧宜截：先封住路线，再决定下一步。' },
    { pattern: 'straight', mark: '震', title: '踏线催步', text: '鞋底压住白线，嘉豪的身体朝前收紧。', answer: 'yield', explain: '重心已经向前，卸步比硬碰更从容。' },
    { pattern: 'circle', mark: '绕', title: '回身换角', text: '嘉豪脚尖转向外侧，准备从边线换角度。', answer: 'intercept', explain: '角度变化前先截住行进线，别等他绕到身侧。' },
    { pattern: 'bait', mark: '引', title: '停拍试探', text: '嘉豪忽然慢了半拍，手上动作比脚下更明显。', answer: 'root', explain: '刻意放大的动作多半在引你先动，守住即可。' },
    { pattern: 'straight', mark: '震', title: '并步直送', text: '嘉豪双脚距离缩短，下一步只留下向前的空间。', answer: 'yield', explain: '路线变直，顺势让开比抢着阻挡更稳。' },
    { pattern: 'bait', mark: '引', title: '目光借位', text: '嘉豪看向左侧，肩胯却仍停在原处。', answer: 'root', explain: '目光是提示也是烟雾；重心没走，就先守中。' },
    { pattern: 'circle', mark: '绕', title: '沿弧逼近', text: '嘉豪的步点沿着半圆移动，正面距离没有缩短。', answer: 'intercept', explain: '弧线正在寻找侧面，提前截线能拿回主动。' },
  ];
  const modeInfo = {
    paper: { title: '风中名单', kicker: '课间挑战 · 观察', help: '名单和午饭菜单混在风里。按页码从小到大收回名单；点错页会损失时间。' },
    spar: { title: '拆招预演', kicker: '搭档挑战 · 判断', help: '读嘉豪的重心和路线，再选回应。直来宜让、虚引宜守、绕侧宜截；洞察可以揭示一次答案。' },
  };
  const achievementNames = { paper_chaser: '风中接页', stance_reader: '读势入门', all_rounder: '文武全勤' };
  let modeKey = 'paper', levelKey = 'easy', config, options, isMuted = () => false;
  let state = 'ready', resolve, frame, lastStamp, remainingMs = 0, audioContext;
  let score = 0, correct = 0, errors = 0, streak = 0, total = 0, expectedPage = 1;
  let sparDeck = [], round = 0, composure = 3, insight = 0, roundAnswered = false, revealed = false;
  let lastResult = null, runSeed = 0, runRandom = Math.random;

  const feedback = text => { el('adventure-feedback').textContent = text; };
  const setState = next => { state = next; panel.dataset.state = next; };
  const stopClock = () => { cancelAnimationFrame(frame); frame = null; };
  const safeNumber = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

  function tone(frequency, duration = .08) {
    if (!audioContext || audioContext.state !== 'running' || isMuted()) return;
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(.045, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + duration);
    oscillator.connect(gain); gain.connect(audioContext.destination);
    oscillator.start(); oscillator.stop(audioContext.currentTime + duration);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }

  function tactile(milliseconds) {
    if (!isMuted() && navigator.vibrate) navigator.vibrate(milliseconds);
  }

  function updateHud() {
    if (modeKey === 'paper') {
      el('adventure-primary').textContent = correct + ' / ' + total + ' 页';
      el('adventure-secondary').textContent = Math.max(0, Math.ceil(remainingMs / 1000)) + ' 秒';
    } else {
      el('adventure-primary').textContent = Math.min(round + 1, total) + ' / ' + total + ' 回合';
      el('adventure-secondary').textContent = '洞察 ' + insight;
      el('player-composure').textContent = '定力 ' + '◆'.repeat(Math.max(0, composure)) + '◇'.repeat(Math.max(0, config.composure - composure));
    }
    el('adventure-score').textContent = score + ' 分';
  }

  function createRunRandom() {
    const values = new Uint32Array(1);
    if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(values);
    runSeed = values[0] || ((Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0);
    let value = runSeed;
    runRandom = () => {
      value += 0x6D2B79F5;
      let mixed = value;
      mixed = Math.imul(mixed ^ mixed >>> 15, mixed | 1);
      mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61);
      return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
    };
    panel.dataset.seed = String(runSeed);
  }

  function shuffled(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index--) {
      const target = Math.floor(runRandom() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }

  function buildPaperField() {
    paperField.replaceChildren();
    paperField.append(Object.assign(document.createElement('div'), { className: 'paper-wind', textContent: '下一张：第 1 页 · 看页码，不看纸张颜色' }));
    const items = [];
    for (let page = 1; page <= config.paperTotal; page++) items.push({ page, label: paperPages[page - 1] });
    for (let index = 0; index < config.decoyTotal; index++) items.push({ page: 0, label: decoys[index] });
    const shuffledPositions = shuffled(positions);
    shuffled(items).forEach((item, index) => {
      const [x, y, rotation] = shuffledPositions[index % shuffledPositions.length];
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'flying-paper' + (item.page ? '' : ' decoy');
      button.dataset.page = String(item.page);
      button.style.setProperty('--paper-x', x + '%'); button.style.setProperty('--paper-y', y + '%');
      button.style.setProperty('--paper-rotation', rotation + 'deg');
      button.style.setProperty('--paper-speed', (2.15 + index % 4 * .37) + 's');
      button.style.setProperty('--paper-delay', (-index * .21) + 's');
      button.append(
        Object.assign(document.createElement('strong'), { textContent: item.page ? '第 ' + item.page + ' 页' : item.label }),
        Object.assign(document.createElement('span'), { textContent: item.page ? item.label : '不是名单' }),
      );
      button.setAttribute('aria-label', item.page ? '名单第' + item.page + '页，' + item.label : '干扰项，' + item.label);
      button.addEventListener('click', () => choosePaper(button, item));
      paperField.append(button);
    });
  }

  function choosePaper(button, item) {
    if (state !== 'playing' || button.disabled) return;
    if (item.page === expectedPage) {
      button.disabled = true; button.classList.add('captured'); correct++; streak++;
      score += 100 + Math.min(80, streak * 12) + Math.max(0, Math.ceil(remainingMs / 10000));
      expectedPage++; tone(620 + correct * 42); tactile(18);
      if (correct >= total) { finish(); return; }
      paperField.querySelector('.paper-wind').textContent = '下一张：第 ' + expectedPage + ' 页 · 连续接对 ' + streak + ' 张';
      feedback('接住第 ' + item.page + ' 页！下一张是第 ' + expectedPage + ' 页。');
    } else {
      errors++; streak = 0; remainingMs = Math.max(0, remainingMs - (item.page ? 1700 : 2600));
      tone(180, .13); tactile(42);
      button.classList.remove('wrong'); void button.offsetWidth; button.classList.add('wrong');
      feedback(item.page ? '顺序不对：先找第 ' + expectedPage + ' 页。' : '这是“' + item.label + '”，不是名单！');
      window.setTimeout(() => button.classList.remove('wrong'), 380);
    }
    updateHud();
  }

  function paperTick(now) {
    if (state !== 'playing' || modeKey !== 'paper') return;
    remainingMs -= Math.max(0, now - lastStamp); lastStamp = now;
    if (remainingMs <= 0) { remainingMs = 0; updateHud(); finish(); return; }
    updateHud(); frame = requestAnimationFrame(paperTick);
  }

  function buildSparDeck() {
    sparDeck = shuffled(attacks).slice(0, config.sparRounds);
  }

  function renderSparRound() {
    const attack = sparDeck[round];
    roundAnswered = false; revealed = false;
    const cue = el('spar-cue'); cue.dataset.pattern = attack.pattern; cue.dataset.answer = attack.answer;
    el('cue-kind').textContent = attack.mark; el('cue-title').textContent = attack.title; el('cue-text').textContent = attack.text;
    const container = el('tactic-options'); container.replaceChildren();
    Object.entries(tacticLabels).forEach(([key, tactic]) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'tactic-card'; button.dataset.tactic = key;
      button.append(Object.assign(document.createElement('strong'), { textContent: tactic.name }), Object.assign(document.createElement('small'), { textContent: tactic.detail }));
      button.addEventListener('click', () => chooseTactic(key, button)); container.append(button);
    });
    nextButton.hidden = true; nextButton.textContent = round === total - 1 ? '查看结果' : '下一回合';
    insightButton.disabled = insight < 2; insightButton.textContent = '凝神观察（2 洞察）';
    feedback('看“' + attack.title + '”的动作线索，选择你的回应。'); updateHud();
    container.querySelector('button')?.focus({ preventScroll: true });
  }

  function chooseTactic(key, selectedButton) {
    if (state !== 'playing' || modeKey !== 'spar' || roundAnswered) return;
    roundAnswered = true;
    const attack = sparDeck[round], success = key === attack.answer;
    el('tactic-options').querySelectorAll('button').forEach(button => {
      button.disabled = true;
      if (button.dataset.tactic === attack.answer) button.classList.add('correct');
    });
    if (success) {
      correct++; streak++; insight = Math.min(4, insight + 1);
      score += 130 + Math.min(100, streak * 20); tone(720 + streak * 30); tactile(20);
      feedback('判断正确 · ' + attack.explain);
    } else {
      errors++; streak = 0; composure = Math.max(0, composure - 1);
      selectedButton.classList.add('wrong'); score = Math.max(0, score - 20); tone(165, .15); tactile(50);
      feedback('被带开了 · ' + attack.explain);
    }
    insightButton.disabled = true; nextButton.hidden = false; updateHud();
    nextButton.focus({ preventScroll: true });
  }

  function revealAnswer() {
    if (state !== 'playing' || modeKey !== 'spar' || roundAnswered || revealed || insight < 2) return;
    revealed = true; insight -= 2;
    const answer = sparDeck[round].answer;
    el('tactic-options').querySelector('[data-tactic="' + answer + '"]').classList.add('recommended');
    insightButton.disabled = true; insightButton.textContent = '已看清这一势';
    feedback('洞察生效：绿色回应最适合这一势，但本回合得分会少 30 分。');
    score = Math.max(0, score - 30); tone(510); updateHud();
  }

  function nextSparRound() {
    if (!roundAnswered || state !== 'playing') return;
    if (round >= total - 1 || composure <= 0) { finish(); return; }
    round++; renderSparRound();
  }

  function calculateResult() {
    const accuracy = total ? Math.round(correct / total * 100) : 0;
    let grade;
    if (modeKey === 'paper') grade = correct === total && errors === 0 && remainingMs >= config.seconds * 300 ? 'S' : correct === total && errors <= 2 ? 'A' : accuracy >= 65 ? 'B' : 'C';
    else grade = accuracy === 100 ? 'S' : accuracy >= 80 && composure > 0 ? 'A' : accuracy >= 55 ? 'B' : 'C';
    return { mode: modeKey, level: levelKey, score, grade, accuracy, correct, total, errors, success: correct === total, composure, insight, aborted: false };
  }

  function saveResult(result) {
    const save = window.WushuSave.read();
    const storedRecords = save.adventureRecords && typeof save.adventureRecords === 'object' && !Array.isArray(save.adventureRecords) ? save.adventureRecords : {};
    const adventureRecords = { ...storedRecords };
    const old = adventureRecords[levelKey]?.[modeKey];
    const newRecord = !old || result.score > safeNumber(old.score);
    const storedLevel = adventureRecords[levelKey] && typeof adventureRecords[levelKey] === 'object' && !Array.isArray(adventureRecords[levelKey]) ? adventureRecords[levelKey] : {};
    if (newRecord) adventureRecords[levelKey] = { ...storedLevel, [modeKey]: { ...result, date: new Date().toISOString() } };
    const achievements = new Set(Array.isArray(save.achievements) ? save.achievements : []), before = new Set(achievements);
    if (modeKey === 'paper' && result.correct === result.total && result.errors <= 1) achievements.add('paper_chaser');
    if (modeKey === 'spar' && result.correct >= Math.min(5, result.total)) achievements.add('stance_reader');
    const recordsAfter = { ...adventureRecords };
    const hasPaper = Object.values(recordsAfter).some(record => record?.paper);
    const hasSpar = Object.values(recordsAfter).some(record => record?.spar);
    const hasRhythm = save.records && typeof save.records === 'object' && !Array.isArray(save.records) && Object.keys(save.records).length > 0;
    if (hasPaper && hasSpar && hasRhythm) achievements.add('all_rounder');
    const newAchievements = [...achievements].filter(key => !before.has(key));
    const saved = window.WushuSave.write({ adventureRecords, totalChallenges: safeNumber(save.totalChallenges) + 1, achievements: [...achievements] });
    return { newRecord, newAchievements, saved };
  }

  function finish() {
    if (state === 'done') return;
    stopClock(); setState('done');
    paperField.querySelectorAll('button').forEach(button => { button.disabled = true; });
    el('tactic-options').querySelectorAll('button').forEach(button => { button.disabled = true; });
    pauseButton.hidden = true; nextButton.hidden = true; insightButton.disabled = true;
    lastResult = calculateResult(); Object.assign(lastResult, saveResult(lastResult));
    resultPanel.hidden = false; el('adventure-grade').textContent = lastResult.grade;
    el('adventure-result-title').textContent = modeKey === 'paper' ? (correct === total ? '名单全部归位' : '风停之前，先记住这些') : (composure > 0 ? '拆招预演完成' : '定力用尽，也读懂了几势');
    el('adventure-result-summary').textContent = score + ' 分 · 正确 ' + correct + ' / ' + total + ' · 准确率 ' + lastResult.accuracy + '%';
    el('adventure-result-detail').textContent = modeKey === 'paper' ?
      (errors ? '点错 ' + errors + ' 次。先看红色页码，再看纸张内容，会比追着移动最快的纸更稳。' : '页码、内容和移动方向都看清了，没有把午饭菜单贴进分组名单。') :
      (lastResult.accuracy >= 80 ? '你已经能从重心和路线判断意图。下一步，是在不使用洞察时也保持稳定。' : '记住三句：直来宜让、虚引宜守、绕侧宜截。判断不是猜快，而是先看线索。');
    const unlockText = lastResult.newAchievements.map(key => achievementNames[key] || key).join(' / ');
    el('adventure-unlocks').textContent = (lastResult.newRecord ? '本模式新纪录！' : '本模式纪录已保留。') + (unlockText ? ' 新成就 · ' + unlockText : '') + (lastResult.saved ? '' : ' 本次未能保存。');
    feedback('挑战完成 · ' + lastResult.grade + ' 级');
    startButton.hidden = false; startButton.textContent = '再挑战一次'; continueButton.hidden = false;
    continueButton.focus({ preventScroll: true });
  }

  function start() {
    if (!['ready', 'done'].includes(state)) return;
    try { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); audioContext.resume().catch(() => {}); } catch { /* visual feedback remains */ }
    createRunRandom();
    stopClock(); resultPanel.hidden = true; startButton.hidden = true; continueButton.hidden = true; pauseButton.hidden = false;
    score = correct = errors = streak = 0; round = 0; expectedPage = 1; roundAnswered = revealed = false; lastResult = null;
    composure = config.composure; insight = config.insight; total = modeKey === 'paper' ? config.paperTotal : config.sparRounds;
    setState('playing');
    if (modeKey === 'paper') {
      remainingMs = config.seconds * 1000; buildPaperField(); lastStamp = performance.now();
      feedback('先找第 1 页。纸会移动，但页码不会变。'); frame = requestAnimationFrame(paperTick);
    } else {
      buildSparDeck(); renderSparRound();
    }
    updateHud();
  }

  function togglePause() {
    if (state === 'playing') {
      setState('paused'); stopClock(); pauseButton.textContent = '继续挑战'; feedback('已暂停 · 观察和计时都冻结了');
    } else if (state === 'paused') {
      setState('playing'); pauseButton.textContent = '暂停'; feedback('继续挑战');
      if (modeKey === 'paper') { lastStamp = performance.now(); frame = requestAnimationFrame(paperTick); }
    }
  }

  function close(aborted) {
    const done = resolve, result = aborted ? { mode: modeKey, level: levelKey, aborted: true } : lastResult;
    resolve = null; stopClock(); panel.hidden = true; setState('ready');
    paperField.replaceChildren(); el('tactic-options').replaceChildren(); resultPanel.hidden = true;
    done?.(result);
  }

  startButton.addEventListener('click', start);
  pauseButton.addEventListener('click', togglePause);
  insightButton.addEventListener('click', revealAnswer);
  nextButton.addEventListener('click', nextSparRound);
  continueButton.addEventListener('click', () => { if (state === 'done') close(false); });
  el('adventure-exit').addEventListener('click', () => { if (!panel.hidden) close(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && !panel.hidden && state === 'playing') togglePause(); });
  window.addEventListener('keydown', event => {
    if (panel.hidden || event.key !== 'Escape') return;
    // 浮层之上还有原生对话框时（例如设置面板），Esc 应先交给对话框关闭。
    if (document.querySelector('dialog[open]')) return;
    event.preventDefault(); event.stopImmediatePropagation(); if (!event.repeat) togglePause();
  });

  window.wushuAdventure = {
    open(muted, difficulty = 'easy', settings = {}) {
      if (resolve) close(true);
      isMuted = typeof muted === 'function' ? muted : () => Boolean(muted);
      options = settings || {}; modeKey = ['paper', 'spar'].includes(options.mode) ? options.mode : 'paper';
      levelKey = Object.hasOwn(settingsByLevel, difficulty) ? difficulty : 'easy'; config = settingsByLevel[levelKey];
      const info = modeInfo[modeKey]; setState('ready'); panel.hidden = false; panel.dataset.mode = modeKey;
      el('adventure-kicker').textContent = info.kicker + ' · ' + window.WUSHU.difficulties[levelKey].name;
      el('adventure-title').textContent = options.title || info.title; el('adventure-help').textContent = info.help;
      stage.style.setProperty('--adventure-bg', modeKey === 'paper' ? 'url("resources/scene/sight/courtyard_wind_original.webp")' : 'url("resources/scene/sight/stance_court_original.webp")');
      paperField.hidden = modeKey !== 'paper'; sparField.hidden = modeKey !== 'spar'; resultPanel.hidden = true;
      paperField.replaceChildren(); el('tactic-options').replaceChildren();
      score = correct = errors = streak = 0; round = 0; total = modeKey === 'paper' ? config.paperTotal : config.sparRounds;
      remainingMs = config.seconds * 1000; composure = config.composure; insight = config.insight; updateHud();
      feedback(modeKey === 'paper' ? '观察页码和干扰项，准备好再追。' : '先记住三种关系，再读嘉豪的动作线索。');
      startButton.hidden = false; startButton.textContent = '开始挑战'; pauseButton.hidden = continueButton.hidden = true;
      continueButton.textContent = options.continueLabel || '继续剧情'; insightButton.disabled = insight < 2; nextButton.hidden = true;
      startButton.focus({ preventScroll: true }); panel.scrollTop = 0;
      return new Promise(done => { resolve = done; });
    },
  };
})();
