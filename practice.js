(() => {
  const el = id => document.getElementById(id);
  const panel = el('practice'), card = panel.querySelector('.practice-panel');
  const startButton = el('practice-start'), hitButton = el('practice-hit');
  const pauseButton = el('practice-pause'), continueButton = el('practice-continue');
  const sprite = el('move-sprite'), moveVoice = new Audio();
  const moves = window.WUSHU.moves, beatNames = ['一', '二', '三', '四'];
  const modes = {
    standard: { title: '八式巡礼', introduction: '完整练习八式，积攒少年意气，挑战自己的最高分。' },
    tutorial: { title: '四式入门课', introduction: '嘉豪陪你慢练四式：看招名 → 找目标拍 → 光点到中心时出招。' },
    relay: { title: '嘉豪 · 接拍试炼', introduction: '嘉豪打乱了八式顺序！提前看下一招，在不同目标拍间接力。' },
  };
  const achievementNames = { first_form: '初次成式', five_chain: '五式相连', tiger_heart: '虎心一击', spirit_burst: '少年意气', hard_clear: '迎难而上' };
  let chart, level, levelKey, modeKey, options, beatMs, roundMs, targetMs, style, styleKey;
  let state = 'ready', pausedState = null, round = 0, points = 0, combo = 0, bestCombo = 0;
  let spirit = 0, awakenedHits = 0, spiritBurstUsed = false, tigerPerfect = false;
  let counts, timings, runMastery, judged, origin, frame, pauseAt, lastBeat, audioContext, resolve;
  let lastResult = null, earlyThisRound = false, isMuted = () => false;
  const nonnegative = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

  // Keep the original page and public API usable without a framework.
  const brief = document.createElement('div');
  brief.className = 'practice-brief';
  brief.innerHTML = '<div><span class="practice-label">本招目标</span><strong id="practice-target">看准金色拍点</strong></div><div><span class="practice-label">下一招</span><strong id="practice-next">准备后揭晓</strong></div>';
  el('move-tip').after(brief);
  const countdown = document.createElement('div');
  countdown.id = 'practice-countdown';
  countdown.hidden = true;
  countdown.setAttribute('aria-live', 'polite');
  countdown.innerHTML = '<span>跟着拍子呼吸</span><strong id="countdown-number">3</strong><small>倒数结束后，光点从第一拍出发</small>';
  brief.before(countdown);
  const summary = document.createElement('section');
  summary.id = 'practice-result';
  summary.hidden = true;
  summary.setAttribute('aria-label', '本轮练习结算');
  summary.innerHTML = '<div class="result-heading"><strong id="result-grade"></strong><div><p id="result-heading"></p><span id="result-record"></span></div></div><div class="result-metrics"><div><strong id="result-perfect">0</strong><span>精准</span></div><div><strong id="result-good">0</strong><span>合格</span></div><div><strong id="result-missed">0</strong><span>错过</span></div><div><strong id="result-combo">0</strong><span>最高连击</span></div></div><p id="result-advice"></p><p id="result-unlocks"></p>';
  el('practice-feedback').after(summary);

  const feedback = text => { el('practice-feedback').textContent = text; };
  function setState(next) { state = next; panel.dataset.state = next; }
  function stopMoveVoice() {
    moveVoice.pause();
    if (moveVoice.hasAttribute('src')) { moveVoice.removeAttribute('src'); moveVoice.load(); }
  }
  function stopClock() { cancelAnimationFrame(frame); frame = null; }
  function stats() { el('practice-score').textContent = points + ' 分 · ' + combo + ' 连击 · ' + style.name; }
  function updateSpirit() {
    el('spirit-fill').style.width = (awakenedHits ? 100 : spirit) + '%';
    el('spirit-value').textContent = awakenedHits ? '爆发×' + awakenedHits : Math.round(spirit) + '%';
    card.classList.toggle('awakened', awakenedHits > 0);
  }
  function callout(text) {
    const node = el('combo-callout');
    node.textContent = text; node.classList.remove('show');
    void node.offsetWidth;
    node.classList.add('show');
  }
  function resetRun() {
    stopClock(); stopMoveVoice();
    round = points = combo = bestCombo = spirit = awakenedHits = 0;
    spiritBurstUsed = tigerPerfect = false;
    judged = false; pausedState = null; lastResult = null;
    counts = { '精准': 0, '合格': 0, '错过': 0 };
    timings = { early: 0, late: 0, onTime: 0, totalOffset: 0, samples: 0, earlyAttempts: 0 };
    runMastery = {};
    card.classList.remove('awakened', 'hit-perfect');
    el('combo-callout').classList.remove('show'); el('combo-callout').textContent = '';
    panel.querySelectorAll('.beat-labels span').forEach(item => item.classList.remove('active', 'target'));
    el('beat-dot').style.left = '0%';
    sprite.hidden = countdown.hidden = summary.hidden = true;
    hitButton.disabled = false;
    updateSpirit(); stats();
  }
  function updateHelp() {
    el('practice-help').textContent = modes[modeKey].introduction + ' ' + style.name + ' · ' + style.motto + '。按空格、Enter 或「出招」。';
  }
  function updateTargetWindow() {
    const width = (level.good + style.tolerance) * 2 / roundMs * 100;
    const center = targetMs / roundMs * 100;
    panel.querySelector('.beat-window').style.width = width + '%';
    panel.querySelector('.beat-window').style.left = (center - width / 2) + '%';
  }
  function cue(playVoice = true) {
    const move = chart[round];
    judged = false; earlyThisRound = false; lastBeat = -1;
    el('move-name').textContent = move.name;
    el('move-tip').textContent = (move.heritage ? move.heritage + ' · ' : '') + move.tip;
    el('practice-progress').textContent = modes[modeKey].title + ' · ' + (round + 1) + ' / ' + chart.length + ' 招';
    targetMs = move.targetBeat * beatMs;
    updateTargetWindow();
    panel.querySelectorAll('.beat-labels span').forEach((item, index) => {
      item.classList.toggle('target', index === move.targetBeat); item.classList.remove('active');
      item.textContent = beatNames[index] + (index === move.targetBeat ? ' · 出招' : '');
    });
    el('practice-target').textContent = '第' + beatNames[move.targetBeat] + '拍 · ' + move.name;
    const next = chart[round + 1];
    el('practice-next').textContent = next ? next.name + ' · 第' + beatNames[next.targetBeat] + '拍' : '抱拳收礼 · 本组结束';
    sprite.hidden = !move.sprite;
    if (move.sprite) sprite.src = move.sprite;
    stopMoveVoice();
    if (playVoice && move.voice && !isMuted()) { moveVoice.src = move.voice; moveVoice.play().catch(() => {}); }
    feedback('第' + beatNames[move.targetBeat] + '拍出招，先听预备拍。');
  }
  function tickSound(accent = false) {
    if (!audioContext || audioContext.state !== 'running' || isMuted()) return;
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    oscillator.frequency.value = accent ? 880 : 440;
    gain.gain.setValueAtTime(.065, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .06);
    oscillator.connect(gain); gain.connect(audioContext.destination);
    oscillator.start(); oscillator.stop(audioContext.currentTime + .07);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  function judge(label, value, offset) {
    if (judged) return;
    judged = true; counts[label]++;
    const move = chart[round];
    const mastery = runMastery[move.name] ||= { attempts: 0, hits: 0, perfect: 0 };
    mastery.attempts++;
    if (value) mastery.hits++;
    if (label === '精准') mastery.perfect++;
    if (value && Number.isFinite(offset)) {
      timings.samples++; timings.totalOffset += offset;
      timings[offset < -35 ? 'early' : offset > 35 ? 'late' : 'onTime']++;
    }
    const wasAwakened = awakenedHits > 0;
    const awarded = Math.round(value * style.scoreRate * (wasAwakened ? 1.5 : 1));
    points += awarded; combo = value ? combo + 1 : 0; bestCombo = Math.max(bestCombo, combo);
    if (label === '精准' && move.name === '黑虎掏心') tigerPerfect = true;
    if (value) spirit = Math.min(100, spirit + (label === '精准' ? 26 : 13) * style.spiritRate);
    else spirit = Math.max(0, spirit - 18);
    if (wasAwakened) awakenedHits--;
    if (!wasAwakened && spirit >= 100) {
      spirit = 0; awakenedHits = 4; spiritBurstUsed = true; callout('少年意气 · 爆发！');
    } else if (combo > 0 && combo % 5 === 0) callout(combo + ' 连式！');
    const direction = value && Math.abs(offset) > 35 ? (offset < 0 ? ' · 稍早' : ' · 稍晚') : '';
    feedback(label + (awarded ? ' +' + awarded + direction + (wasAwakened ? ' · 意气加成' : '') : ' · 看下一招的目标拍'));
    card.classList.remove('hit-perfect');
    if (label === '精准') { void card.offsetWidth; card.classList.add('hit-perfect'); }
    updateSpirit(); stats(); hitButton.disabled = true;
  }
  function makeResult(aborted = false) {
    const rate = (counts['精准'] + counts['合格']) / chart.length;
    const precision = counts['精准'] / chart.length;
    const grade = rate === 1 && precision >= .8 ? 'S' : rate >= .85 && precision >= .5 ? 'A' : rate >= .6 ? 'B' : 'C';
    return {
      points, accuracy: Math.round(rate * 100), bestCombo, counts: { ...counts },
      level: levelKey, style: styleKey, mode: modeKey, grade, aborted,
      timing: { early: timings.early, late: timings.late, onTime: timings.onTime, meanOffsetMs: timings.samples ? Math.round(timings.totalOffset / timings.samples) : 0, earlyAttempts: timings.earlyAttempts },
    };
  }
  function advice() {
    if (!timings.samples) return '嘉豪：先盯住写着「出招」的目标拍，光点碰到金色中心线时按一次。试试四式入门课。';
    if (timings.earlyAttempts > chart.length / 3) return '嘉豪：你有些抢拍。招名出现只是预告，等光点进入金色区再出招。';
    const average = timings.totalOffset / timings.samples;
    if (average < -40) return '嘉豪：整体偏早约 ' + Math.abs(Math.round(average)) + ' 毫秒。手指稍等一下，向金色中心靠拢。';
    if (average > 40) return '嘉豪：整体偏晚约 ' + Math.round(average) + ' 毫秒。提前看下一招，让手指跟着拍子走。';
    if (counts['错过']) return '嘉豪：出手时机挺稳！换招时先看「下一招」，留意第二、三、四拍的切换。';
    return '嘉豪：稳稳接住了！保持这个节奏，再挑战不同风格或接拍试炼。';
  }
  function finish() {
    if (state === 'done') return;
    setState('done'); stopClock(); stopMoveVoice();
    sprite.hidden = countdown.hidden = hitButton.hidden = pauseButton.hidden = true;
    startButton.hidden = continueButton.hidden = false;
    card.classList.remove('awakened', 'hit-perfect'); el('combo-callout').classList.remove('show');
    panel.querySelectorAll('.style-choice button').forEach(button => { button.disabled = false; });
    startButton.textContent = '再练一次';
    el('practice-title').textContent = (options.title || modes[modeKey].title) + ' · 完成';
    lastResult = makeResult();
    const save = window.WushuSave.read();
    const records = { ...(save.records || {}) }, modeRecords = { ...(save.modeRecords || {}) };
    const previousMode = modeRecords[levelKey]?.[modeKey];
    const previousStandard = modeKey === 'standard' ? records[levelKey] : null;
    const previousPoints = Math.max(nonnegative(previousMode?.points), nonnegative(previousStandard?.points));
    const newRecord = modeKey !== 'tutorial' && ((!previousMode && !previousStandard) || points > previousPoints);
    if (modeKey !== 'tutorial') {
      const record = { ...lastResult, date: new Date().toISOString() };
      if (!previousMode || points > nonnegative(previousMode.points)) modeRecords[levelKey] = { ...(modeRecords[levelKey] || {}), [modeKey]: record };
      if (modeKey === 'standard' && (!previousStandard || points > nonnegative(previousStandard.points))) records[levelKey] = record;
      if (modeKey === 'standard' && nonnegative(records[levelKey]?.points) > nonnegative(modeRecords[levelKey]?.standard?.points)) {
        modeRecords[levelKey] = { ...(modeRecords[levelKey] || {}), standard: { ...records[levelKey], mode: 'standard' } };
      }
    }
    const achievements = new Set(Array.isArray(save.achievements) ? save.achievements : []), before = new Set(achievements);
    if (modeKey !== 'tutorial') {
      achievements.add('first_form');
      if (bestCombo >= 5) achievements.add('five_chain');
      if (tigerPerfect) achievements.add('tiger_heart');
      if (spiritBurstUsed) achievements.add('spirit_burst');
      if (levelKey === 'hard' && lastResult.accuracy >= 70) achievements.add('hard_clear');
    }
    const newAchievements = [...achievements].filter(key => !before.has(key));
    const mastery = { ...(save.mastery || {}) };
    for (const [name, increment] of Object.entries(runMastery)) {
      const old = mastery[name] || {};
      mastery[name] = { attempts: nonnegative(old.attempts) + increment.attempts, hits: nonnegative(old.hits) + increment.hits, perfect: nonnegative(old.perfect) + increment.perfect };
    }
    const saved = window.WushuSave.write({
      records, modeRecords, mastery, totalRuns: nonnegative(save.totalRuns) + 1,
      achievements: [...achievements], settings: { ...(save.settings || {}), practiceStyle: styleKey },
    });
    Object.assign(lastResult, { newRecord, newAchievements, saved });
    el('move-name').textContent = { S: '一气呵成！', A: '少年初成！', B: '渐入佳境！', C: '下次会更稳' }[lastResult.grade];
    el('move-tip').textContent = '评级看命中与精准，不受风格得分加成影响。';
    el('result-grade').textContent = lastResult.grade; summary.dataset.grade = lastResult.grade;
    el('result-heading').textContent = points + ' 分 · 命中率 ' + lastResult.accuracy + '%';
    el('result-record').textContent = modeKey === 'tutorial' ? '入门课完成 · 已练习的招式计入熟练度' : newRecord ? '本模式个人新高分！' : '本模式历史最高 ' + previousPoints + ' 分';
    el('result-perfect').textContent = counts['精准']; el('result-good').textContent = counts['合格'];
    el('result-missed').textContent = counts['错过']; el('result-combo').textContent = bestCombo;
    el('result-advice').textContent = advice();
    el('result-unlocks').textContent = newAchievements.length ? '新成就 · ' + newAchievements.map(key => achievementNames[key] || key).join(' / ') : modeKey === 'tutorial' ? '入门课不刷新正式成绩。准备好后，去八式巡礼试试。' : '八式熟练度已更新 · 再练一次，找到自己的节奏。';
    feedback('本轮 ' + points + ' 分 · 命中率 ' + lastResult.accuracy + '%' + (saved ? '' : '（本次未能保存，请检查浏览器存储）'));
    summary.hidden = false; continueButton.focus({ preventScroll: true });
    if (!saved) el('result-record').textContent = '本次浏览器保存失败；成绩尚未记录';
  }
  function update(now) {
    if (state === 'countdown') {
      const elapsed = now - origin;
      if (elapsed < 3 * beatMs) {
        const beat = Math.floor(elapsed / beatMs);
        if (beat !== lastBeat) { lastBeat = beat; el('countdown-number').textContent = 3 - beat; tickSound(); }
        frame = requestAnimationFrame(update); return;
      }
      origin += 3 * beatMs; setState('playing'); countdown.hidden = true; cue(); hitButton.disabled = false;
    }
    if (state !== 'playing') return;
    let elapsed = now - origin;
    while (elapsed >= roundMs) {
      if (!judged) judge('错过', 0);
      round++;
      if (round >= chart.length) { finish(); return; }
      origin += roundMs; elapsed = now - origin; cue();
    }
    const beat = Math.min(3, Math.floor(elapsed / beatMs));
    if (beat !== lastBeat) {
      lastBeat = beat;
      const target = chart[round].targetBeat;
      tickSound(beat === target);
      if (!judged) feedback(beatNames[beat] + (beat === target ? ' · 出招！' : beat < target ? ' · 预备，等第' + beatNames[target] + '拍' : ' · 收势'));
      panel.querySelectorAll('.beat-labels span').forEach((item, index) => item.classList.toggle('active', index === beat));
    }
    el('beat-dot').style.left = (elapsed / roundMs * 100) + '%';
    if (!judged && elapsed > targetMs + level.good + style.tolerance) judge('错过', 0);
    hitButton.disabled = judged; frame = requestAnimationFrame(update);
  }
  function hit() {
    if (state !== 'playing') return;
    const now = performance.now();
    stopClock(); update(now);
    if (state !== 'playing' || judged) return;
    const delta = now - origin - targetMs, goodWindow = level.good + style.tolerance;
    const perfectWindow = level.perfect + Math.round(style.tolerance * .35);
    if (delta < -goodWindow) {
      if (!earlyThisRound) { timings.earlyAttempts++; earlyThisRound = true; }
      feedback('太早啦，等第' + beatNames[chart[round].targetBeat] + '拍的金色中心线！'); return;
    }
    const error = Math.abs(delta);
    judge(error <= perfectWindow ? '精准' : error <= goodWindow ? '合格' : '错过', error <= perfectWindow ? 100 : error <= goodWindow ? 60 : 0, delta);
  }
  function start() {
    if (state !== 'ready' && state !== 'done') return;
    try { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); audioContext.resume().catch(() => {}); }
    catch { /* Visual beats remain available without audio support. */ }
    resetRun(); setState('countdown');
    startButton.hidden = continueButton.hidden = true; hitButton.hidden = pauseButton.hidden = false; hitButton.disabled = true;
    pauseButton.textContent = '暂停'; el('practice-title').textContent = options.title || modes[modeKey].title;
    panel.querySelectorAll('.style-choice button').forEach(button => { button.disabled = true; });
    cue(false); countdown.hidden = false; el('countdown-number').textContent = '3';
    feedback('先跟三拍倒数，之后开始第一招。');
    origin = performance.now(); frame = requestAnimationFrame(update); panel.focus({ preventScroll: true });
  }
  function togglePause() {
    if (state === 'playing' || state === 'countdown') {
      pauseAt = performance.now(); pausedState = state; setState('paused'); stopClock(); stopMoveVoice();
      hitButton.disabled = true; pauseButton.textContent = '继续练习';
      feedback('已暂停 · 节拍已冻结，点「继续练习」接着来');
    } else if (state === 'paused') {
      origin += performance.now() - pauseAt; setState(pausedState); pausedState = null;
      pauseButton.textContent = '暂停';
      feedback(state === 'countdown' ? '继续倒数……' : '继续 · 本招第' + beatNames[chart[round].targetBeat] + '拍出招');
      hitButton.disabled = state === 'countdown' || judged;
      frame = requestAnimationFrame(update); panel.focus({ preventScroll: true });
    }
  }
  function close(aborted) {
    const result = aborted ? makeResult(true) : lastResult, done = resolve;
    resolve = null; stopClock(); stopMoveVoice(); panel.hidden = true; resetRun(); setState('ready'); done?.(result);
  }
  el('practice-exit').addEventListener('click', () => { if (!panel.hidden) close(true); });
  panel.querySelectorAll('.style-choice button').forEach(button => {
    button.addEventListener('click', () => {
      if (!['ready', 'done'].includes(state)) return;
      styleKey = button.dataset.style; style = window.WUSHU.styles[styleKey];
      panel.querySelectorAll('.style-choice button').forEach(option => option.classList.toggle('active', option === button));
      const save = window.WushuSave.read();
      window.WushuSave.write({ settings: { ...(save.settings || {}), practiceStyle: styleKey } });
      updateHelp();
      if (state === 'ready') { updateTargetWindow(); stats(); }
    });
  });
  panel.tabIndex = -1;
  sprite.addEventListener('error', () => { sprite.hidden = true; });
  startButton.addEventListener('click', start); hitButton.addEventListener('click', hit);
  pauseButton.addEventListener('click', togglePause);
  continueButton.addEventListener('click', () => { if (state === 'done') close(false); });
  window.addEventListener('keydown', event => {
    if (panel.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopImmediatePropagation();
      if (!event.repeat) togglePause();
      return;
    }
    if (![' ', 'Enter'].includes(event.key)) return;
    const control = event.target.closest?.('button, input, select, textarea, a, [contenteditable="true"]');
    // Native buttons retain Enter/Space activation, especially the three style choices.
    if (control && control !== hitButton) { event.stopImmediatePropagation(); return; }
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.repeat) return;
    if (state === 'playing') hit();
    else if (state === 'ready') start();
    else if (state === 'paused') togglePause();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !panel.hidden && ['playing', 'countdown'].includes(state)) togglePause();
  });
  window.wushuPractice = {
    open(muted, difficulty = 'easy', settings = {}) {
      if (resolve) close(true);
      isMuted = typeof muted === 'function' ? muted : () => Boolean(muted); options = settings || {};
      modeKey = Object.hasOwn(modes, options.mode) ? options.mode : 'standard';
      levelKey = Object.hasOwn(window.WUSHU.difficulties, difficulty) ? difficulty : 'easy';
      level = { ...window.WUSHU.difficulties[levelKey] };
      const savedStyle = window.WushuSave.read().settings?.practiceStyle;
      styleKey = Object.hasOwn(window.WUSHU.styles, savedStyle) ? savedStyle : 'steady'; style = window.WUSHU.styles[styleKey];
      if (modeKey === 'tutorial') {
        chart = [0, 1, 4, 7].map(index => moves[index % moves.length]);
        level.beatMs = Math.max(950, level.beatMs); level.good = Math.max(350, level.good); level.perfect = Math.max(150, level.perfect);
      } else if (modeKey === 'relay') chart = [0, 3, 1, 5, 6, 4, 2, 7].map(index => moves[index % moves.length]);
      else chart = Array.from({ length: level.rounds }, (_, index) => moves[index % moves.length]);
      beatMs = level.beatMs; roundMs = beatMs * 4; resetRun(); setState('ready'); panel.hidden = false; panel.dataset.mode = modeKey;
      el('practice-title').textContent = options.title || modes[modeKey].title;
      panel.querySelector('.eyebrow').textContent = '武术操 · ' + (modeKey === 'tutorial' ? '慢速入门' : level.name + '挑战');
      updateHelp(); cue(false);
      el('practice-progress').textContent = (modeKey === 'tutorial' ? '慢速' : level.name) + ' · ' + chart.length + ' 招 · 约 ' + Math.round((chart.length * roundMs + beatMs * 3) / 1000) + ' 秒';
      panel.querySelectorAll('.style-choice button').forEach(button => {
        button.disabled = false; button.classList.toggle('active', button.dataset.style === styleKey);
      });
      feedback('选好风格后开始，先倒数三拍。'); startButton.textContent = '开始练习'; startButton.hidden = false;
      continueButton.textContent = options.continueLabel || '继续剧情';
      hitButton.hidden = pauseButton.hidden = continueButton.hidden = true;
      startButton.focus({ preventScroll: true }); panel.scrollTop = 0;
      return new Promise(done => { resolve = done; });
    },
  };
})();
