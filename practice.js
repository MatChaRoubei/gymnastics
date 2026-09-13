(() => {
  const el = (id) => document.getElementById(id);
  const panel = el('practice');
  const startButton = el('practice-start');
  const hitButton = el('practice-hit');
  const pauseButton = el('practice-pause');
  const continueButton = el('practice-continue');
  const moves = window.WUSHU.moves;
  let chart, level, levelKey, beatMs, roundMs, targetMs, style, styleKey;
  let lastResult = null;
  const sprite = el('move-sprite');
  const moveVoice = new Audio();
  function stopMoveVoice() { moveVoice.pause(); moveVoice.removeAttribute('src'); moveVoice.load(); }
  let state = 'ready', round = 0, points = 0, combo = 0, bestCombo = 0, spirit = 0, awakenedHits = 0;
  let spiritBurstUsed = false, tigerPerfect = false;
  let counts, judged, origin, frame, pauseAt, lastBeat, audioContext, resolve;
  let isMuted = () => false;
  const feedback = text => { el('practice-feedback').textContent = text; };
  function stats() {
    el('practice-score').textContent = points + ' 分 · ' + combo + ' 连击 · ' + style.name;
  }
  function updateSpirit() {
    el('spirit-fill').style.width = (awakenedHits ? 100 : spirit) + '%';
    el('spirit-value').textContent = awakenedHits ? '爆发×' + awakenedHits : Math.round(spirit) + '%';
    panel.querySelector('.practice-panel').classList.toggle('awakened', awakenedHits > 0);
  }
  function callout(text) {
    const node = el('combo-callout');
    node.textContent = text;
    node.classList.remove('show');
    void node.offsetWidth;
    node.classList.add('show');
  }
  function cue() {
    judged = false;
    lastBeat = -1;
    el('move-name').textContent = chart[round].name;
    el('move-tip').textContent = chart[round].tip;
    el('practice-progress').textContent = (round + 1) + ' / ' + chart.length + ' 招';
    targetMs = chart[round].targetBeat * beatMs;
    const tolerance = level.good + style.tolerance;
    const width = tolerance * 2 / roundMs * 100;
    const center = targetMs / roundMs * 100;
    panel.querySelector('.beat-window').style.width = width + '%';
    panel.querySelector('.beat-window').style.left = (center - width / 2) + '%';
    panel.querySelectorAll('.beat-labels span').forEach((item, index) => item.classList.toggle('target', index === chart[round].targetBeat));
    sprite.hidden = !chart[round].sprite;
    if (chart[round].sprite) sprite.src = chart[round].sprite;
    stopMoveVoice();
    if (chart[round].voice && !isMuted()) {
      moveVoice.src = chart[round].voice;
      moveVoice.play().catch(() => {});
    }
    feedback('预备……');
  }
  function tickSound(beat) {
    if (!audioContext || audioContext.state !== 'running' || isMuted()) return;
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    oscillator.frequency.value = beat === chart[round].targetBeat ? 880 : 440;
    gain.gain.setValueAtTime(.065, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioContext.currentTime + .06);
    oscillator.connect(gain); gain.connect(audioContext.destination);
    oscillator.start(); oscillator.stop(audioContext.currentTime + .07);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  function judge(label, value) {
    judged = true;
    counts[label]++;
    const wasAwakened = awakenedHits > 0;
    const awarded = Math.round(value * style.scoreRate * (wasAwakened ? 1.5 : 1));
    points += awarded;
    combo = value ? combo + 1 : 0;
    bestCombo = Math.max(bestCombo, combo);
    if (label === '精准' && chart[round].name === '黑虎掏心') tigerPerfect = true;
    if (value) spirit = Math.min(100, spirit + (label === '精准' ? 26 : 13) * style.spiritRate);
    else spirit = Math.max(0, spirit - 18);
    if (wasAwakened) awakenedHits--;
    if (!wasAwakened && spirit >= 100) {
      spirit = 0;
      awakenedHits = 4;
      spiritBurstUsed = true;
      callout('少年意气 · 爆发！');
    } else if (combo > 0 && combo % 5 === 0) {
      callout(combo + ' 连式！');
    }
    feedback(label + (awarded ? ' +' + awarded + (wasAwakened ? ' · 意气加成' : '') : ' · 跟上下一招'));
    const card = panel.querySelector('.practice-panel');
    card.classList.remove('hit-perfect');
    if (label === '精准') { void card.offsetWidth; card.classList.add('hit-perfect'); }
    updateSpirit();
    stats();
    hitButton.disabled = true;
  }
  function result() {
    state = 'done';
    cancelAnimationFrame(frame);
    stopMoveVoice();
    sprite.hidden = true;
    hitButton.hidden = pauseButton.hidden = true;
    startButton.hidden = continueButton.hidden = false;
    panel.querySelectorAll('.style-choice button').forEach(button => { button.disabled = false; });
    startButton.textContent = '再练一次';
    el('practice-title').textContent = '第一组 · 完成';
    el('move-name').textContent = points >= chart.length * 85 ? '少年初成！' : points >= chart.length * 50 ? '渐入佳境！' : '再找一找节奏';
    el('move-tip').textContent = '最高连击 ' + bestCombo + ' · 精准 ' + counts['精准'] + ' · 合格 ' + counts['合格'] + ' · 错过 ' + counts['错过'];
    const accuracy = Math.round((counts['精准'] + counts['合格']) / chart.length * 100);
    lastResult = { points, accuracy, bestCombo, counts: { ...counts }, level: levelKey, style: styleKey };
    const save = window.WushuSave.read();
    const records = save.records || {};
    const previous = records[levelKey];
    if (!previous || points > previous.points) records[levelKey] = { ...lastResult, date: new Date().toISOString() };
    const achievements = new Set(save.achievements || []);
    achievements.add('first_form');
    if (bestCombo >= 5) achievements.add('five_chain');
    if (tigerPerfect) achievements.add('tiger_heart');
    if (spiritBurstUsed) achievements.add('spirit_burst');
    if (levelKey === 'hard' && accuracy >= 70) achievements.add('hard_clear');
    const saved = window.WushuSave.write({ records, achievements: [...achievements], settings: { ...(save.settings || {}), practiceStyle: styleKey } });
    feedback('本轮 ' + points + ' 分 · 命中率 ' + accuracy + '% · 成就 ' + achievements.size + '/5' + (saved ? '' : '（本次未能保存）'));
    continueButton.focus();
  }
  function update(now) {
    if (state !== 'playing') return;
    let elapsed = now - origin;
    while (elapsed >= roundMs) {
      if (!judged) judge('错过', 0);
      round++;
      if (round >= chart.length) { result(); return; }
      origin += roundMs;
      elapsed = now - origin;
      cue();
    }
    const beat = Math.min(3, Math.floor(elapsed / beatMs));
    if (beat !== lastBeat) {
      lastBeat = beat;
      tickSound(beat);
      if (!judged) feedback(['一 · 预备', '二 · 蓄势', '三 · 出招！', '四 · 收势'][beat]);
      panel.querySelectorAll('.beat-labels span').forEach((item, i) => item.classList.toggle('active', i === beat));
    }
    el('beat-dot').style.left = (elapsed / roundMs * 100) + '%';
    if (!judged && elapsed > targetMs + level.good + style.tolerance) judge('错过', 0);
    hitButton.disabled = judged;
    frame = requestAnimationFrame(update);
  }
  function hit() {
    if (state !== 'playing') return;
    // 先推进时钟，避免边界点击被计到上一招。
    cancelAnimationFrame(frame);
    update(performance.now());
    if (state !== 'playing' || judged) return;
    const delta = performance.now() - origin - targetMs;
    const goodWindow = level.good + style.tolerance;
    const perfectWindow = level.perfect + Math.round(style.tolerance * .35);
    if (delta < -goodWindow) { feedback('太早啦，等发光的目标拍！'); return; }
    const error = Math.abs(delta);
    judge(error <= perfectWindow ? '精准' : error <= goodWindow ? '合格' : '错过', error <= perfectWindow ? 100 : error <= goodWindow ? 60 : 0);
  }
  function start() {
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      audioContext.resume().catch(() => {});
    } catch { /* 无音频接口时仍可依据视觉节拍游玩。 */ }
    cancelAnimationFrame(frame);
    lastResult = null;
    round = points = combo = bestCombo = spirit = awakenedHits = 0;
    spiritBurstUsed = tigerPerfect = false;
    counts = { '精准': 0, '合格': 0, '错过': 0 };
    state = 'playing';
    startButton.hidden = continueButton.hidden = true;
    hitButton.hidden = pauseButton.hidden = false;
    pauseButton.textContent = '暂停';
    el('practice-title').textContent = '跟上这一拍';
    panel.querySelectorAll('.style-choice button').forEach(button => { button.disabled = true; });
    updateSpirit();
    stats(); cue();
    origin = performance.now();
    frame = requestAnimationFrame(update);
    hitButton.focus();
  }
  function togglePause() {
    if (state === 'playing') {
      pauseAt = performance.now(); state = 'paused';
      cancelAnimationFrame(frame);
      stopMoveVoice();
      pauseButton.textContent = '继续练习';
      feedback('已暂停');
    } else if (state === 'paused') {
      origin += performance.now() - pauseAt; state = 'playing';
      pauseButton.textContent = '暂停';
      frame = requestAnimationFrame(update);
    }
  }
  el('practice-exit').addEventListener('click', () => {
    cancelAnimationFrame(frame); stopMoveVoice();
    panel.hidden = true; state = 'ready';
    resolve({ aborted: true });
  });
  panel.querySelectorAll('.style-choice button').forEach(button => {
    button.addEventListener('click', () => {
      if (state === 'playing' || state === 'paused') return;
      styleKey = button.dataset.style;
      style = window.WUSHU.styles[styleKey];
      panel.querySelectorAll('.style-choice button').forEach(option => option.classList.toggle('active', option === button));
      el('practice-help').textContent = style.name + ' · ' + style.motto + '。每招目标拍不同，观察金色区域再出招。';
      stats();
    });
  });
  sprite.addEventListener('error', () => { sprite.hidden = true; });
  startButton.addEventListener('click', start);
  hitButton.addEventListener('click', hit);
  pauseButton.addEventListener('click', togglePause);
  continueButton.addEventListener('click', () => {
    panel.hidden = true;
    state = 'ready';
    resolve(lastResult);
  });
  window.addEventListener('keydown', event => {
    if (panel.hidden || ![' ', 'Enter'].includes(event.key)) return;
    if (event.target === pauseButton || event.target.id === 'music-toggle' || event.target.id === 'practice-exit') return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.repeat) return;
    if (state === 'playing') hit();
    else if (state === 'ready') start();
    else if (state === 'paused') togglePause();
    else if (event.target === startButton) start();
    else continueButton.click();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing') togglePause();
  });
  window.wushuPractice = {
    open(muted, difficulty = 'easy') {
      isMuted = muted;
      levelKey = difficulty in window.WUSHU.difficulties ? difficulty : 'easy';
      level = window.WUSHU.difficulties[levelKey];
      const savedStyle = window.WushuSave.read().settings?.practiceStyle;
      styleKey = savedStyle in window.WUSHU.styles ? savedStyle : 'steady';
      style = window.WUSHU.styles[styleKey];
      chart = Array.from({ length: level.rounds }, (_, i) => moves[i % moves.length]);
      beatMs = level.beatMs; roundMs = beatMs * 4; targetMs = beatMs * 2;
      lastResult = null;
      sprite.hidden = true;
      state = 'ready'; panel.hidden = false;
      el('practice-title').textContent = '跟上这一拍';
      el('practice-help').textContent = style.name + ' · ' + style.motto + '。每招目标拍不同，观察金色区域再出招。';
      el('move-name').textContent = '八式巡礼 · 每一式的目标拍不同';
      el('move-tip').textContent = '目标拍会发光，光点进入金色区域时出招。';
      el('practice-progress').textContent = level.name + ' · ' + chart.length + ' 招 · ' + Math.round(chart.length * roundMs / 1000) + ' 秒';
      el('practice-score').textContent = '0 分 · 0 连击';
      panel.querySelectorAll('.style-choice button').forEach(button => {
        button.disabled = false;
        button.classList.toggle('active', button.dataset.style === styleKey);
      });
      spirit = awakenedHits = 0;
      updateSpirit();
      el('beat-dot').style.left = '0%';
      feedback('准备好了就开始吧。');
      startButton.textContent = '开始练习'; startButton.hidden = false;
      hitButton.hidden = pauseButton.hidden = continueButton.hidden = true;
      startButton.focus();
      return new Promise(done => { resolve = done; });
    }
  };
})();
