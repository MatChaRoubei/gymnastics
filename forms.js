(() => {
  const el = id => document.getElementById(id);
  const panel = el('forms'), stage = el('forms-stage'), playfield = el('forms-playfield');
  const startButton = el('forms-start'), nextButton = el('forms-next');
  const pauseButton = el('forms-pause'), continueButton = el('forms-continue');
  const roundResult = el('forms-round-result'), finalPanel = el('forms-final');
  const moves = window.WUSHU.moves;
  const games = ['salute', 'crane', 'union', 'tigerstep', 'tigerstrike', 'tide', 'push', 'breath'];
  const instructions = [
    '按提示左右交替，像节奏对拍一样完成抱拳礼。',
    '移动风羽对准金圈，再亮掌穿过三道风门。',
    '让左右两掌尽量同时点亮，三次合劲开门。',
    '按住蓄力，在力量进入金色区域时松开落步。',
    '木人攻防：看预兆防守，抓硬直反击，攒气打出黑虎重拳。',
    '回潮身法：移动白点穿过弹幕，擦弹得分，危急时清场一次。',
    '连续推掌维持力量，让推力稳定停在金色区间。',
    '跟随光环呼吸，在扩张与收拢的顶点完成归元。',
  ];
  const difficulty = {
    easy: { name: '简单', duration: 1.25, tolerance: 1.35 },
    normal: { name: '普通', duration: 1, tolerance: 1 },
    hard: { name: '困难', duration: .82, tolerance: .72 },
  };
  const achievementNames = { eight_ways: '八式百炼', all_forms_a: '八脉同辉', first_form: '初试身手' };
  let levelKey = 'easy', config = difficulty.easy, options = {}, isMuted = () => false;
  let state = 'ready', resolve, frame, lastStamp = 0, runtime = null, audioContext;
  let moveIndex = 0, points = 0, scores = [], formDetails = [], lastResult = null;
  let runSeed = 0, runRandom = Math.random;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const safeNumber = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  const objectValue = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

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

  const randomBetween = (min, max) => min + runRandom() * (max - min);

  function setState(next) {
    state = next; panel.dataset.state = next;
  }

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

  function tactile(pattern) {
    if (!isMuted() && navigator.vibrate) navigator.vibrate(pattern);
  }

  function feedback(text) {
    el('forms-feedback').textContent = text;
  }

  function stopClock() {
    cancelAnimationFrame(frame); frame = null;
  }

  function updateHud() {
    el('forms-step').textContent = '第 ' + Math.min(moveIndex + 1, moves.length) + ' / ' + moves.length + ' 式';
    el('forms-score').textContent = points + ' 分';
    el('forms-time').textContent = runtime && state === 'playing' ? Math.max(0, Math.ceil((runtime.duration - runtime.elapsed) / 1000)) + ' 秒' : state === 'paused' ? '暂停' : state === 'between' ? '本式完成' : state === 'done' ? '完成' : '准备';
    el('forms-progress-fill').style.width = ((moveIndex + (state === 'between' || state === 'done' ? 1 : 0)) / moves.length * 100) + '%';
  }

  function setRuntime(runtimeConfig) {
    runtime = { elapsed: 0, ...runtimeConfig };
    lastStamp = performance.now();
    stopClock(); frame = requestAnimationFrame(tick);
  }

  function tick(now) {
    if (state !== 'playing' || !runtime) return;
    const delta = Math.min(80, Math.max(0, now - lastStamp));
    lastStamp = now; runtime.elapsed += delta;
    runtime.update?.(delta);
    updateHud();
    if (state !== 'playing') return;
    if (runtime.elapsed >= runtime.duration) {
      runtime.timeout?.();
      if (state === 'playing') completeRound(0, '时间到。先看清这一式的发力逻辑，下次会更稳。');
      return;
    }
    frame = requestAnimationFrame(tick);
  }

  function gameShell(title, note) {
    const shell = make('div', 'forms-game');
    shell.append(make('h4', '', title), make('p', '', note));
    playfield.replaceChildren(shell);
    return shell;
  }

  function completeRound(rawScore, detail) {
    if (state !== 'playing') return;
    stopClock();
    const score = Math.round(clamp(rawScore, 0, 100));
    scores.push(score); points += score * 12;
    formDetails.push({ name: moves[moveIndex].name, game: games[moveIndex], score });
    const mark = score >= 90 ? '精准' : score >= 72 ? '合格' : score >= 50 ? '接住' : '再练';
    setState('between'); runtime = null;
    roundResult.hidden = false; finalPanel.hidden = true;
    el('forms-round-mark').textContent = mark;
    el('forms-round-title').textContent = moves[moveIndex].name + ' · ' + score + ' 分';
    el('forms-round-detail').textContent = detail;
    feedback(mark + ' · ' + (score >= 72 ? '这一式的感觉记住了。' : '下一轮还有新的操作，不必困在这一式。'));
    pauseButton.hidden = true; nextButton.hidden = false;
    nextButton.textContent = moveIndex === moves.length - 1 ? '查看总评' : '下一式 · ' + moves[moveIndex + 1].name;
    updateHud(); tone(score >= 72 ? 720 : 230, .13); tactile(score >= 72 ? 20 : [20, 35, 20]);
    nextButton.focus({ preventScroll: true });
  }

  function renderSalute() {
    const shell = gameShell('左右合礼', '跟随方向提示完成连拍。键盘可用 A / D 或左右方向键。');
    const length = levelKey === 'easy' ? 4 : levelKey === 'normal' ? 6 : 8;
    const sequence = [];
    while (sequence.length < length) {
      const previous = sequence.at(-1), beforePrevious = sequence.at(-2);
      sequence.push(previous && previous === beforePrevious ? (previous === 'left' ? 'right' : 'left') : (runRandom() < .5 ? 'left' : 'right'));
    }
    const sequenceRow = make('div', 'salute-sequence');
    const tokens = sequence.map(side => make('span', '', side === 'left' ? '左' : '右'));
    tokens.forEach(token => sequenceRow.append(token)); tokens[0].classList.add('current');
    const pads = make('div', 'forms-pads');
    const left = make('button', '', '左掌　A / ←'), right = make('button', '', '右拳　D / →');
    left.type = right.type = 'button'; pads.append(left, right); shell.append(sequenceRow, pads);
    let index = 0, errors = 0;
    const press = side => {
      if (state !== 'playing') return;
      if (side === sequence[index]) {
        tokens[index].className = 'done'; index++; tone(470 + index * 45); tactile(12);
        if (index >= sequence.length) {
          const speedLoss = runtime.elapsed / runtime.duration * 15;
          completeRound(100 - errors * 13 - speedLoss, errors ? '方向有过几次错位，但最终把左右拳掌合到了一起。' : '左右节拍没有抢拍，抱拳礼干净利落。');
          return;
        }
        tokens[index].classList.add('current');
      } else {
        errors++; tone(170); feedback('方向反了：下一下是' + (sequence[index] === 'left' ? '左掌' : '右拳') + '。');
      }
    };
    left.addEventListener('click', () => press('left')); right.addEventListener('click', () => press('right'));
    setRuntime({
      duration: 9000 * config.duration,
      onKeyDown: key => ['a', 'arrowleft'].includes(key) ? press('left') : ['d', 'arrowright'].includes(key) ? press('right') : undefined,
      timeout: () => completeRound(index / sequence.length * 72 - errors * 8, '完成了 ' + index + ' / ' + sequence.length + ' 次合拍。'),
    });
    left.focus({ preventScroll: true });
  }

  function renderCrane() {
    const shell = gameShell('风门引掌', '拖动风羽对准金圈，按“亮掌”确认。键盘可用方向键微调。');
    const gateCount = levelKey === 'hard' ? 4 : 3;
    const targetValues = [];
    while (targetValues.length < gateCount) {
      let target;
      do target = Math.round(randomBetween(12, 88));
      while (targetValues.some(value => Math.abs(value - target) < 18));
      targetValues.push(target);
    }
    const track = make('div', 'crane-track'), target = make('i', 'crane-target'), cursor = make('i', 'crane-cursor');
    track.append(target, cursor);
    const range = document.createElement('input');
    range.type = 'range'; range.min = '0'; range.max = '100'; range.value = '50'; range.className = 'crane-range'; range.setAttribute('aria-label', '调整风羽位置');
    const confirm = make('button', '', '亮掌 · 确认'); confirm.type = 'button';
    shell.append(track, range, confirm);
    let gate = 0, scoreSum = 0;
    const paint = () => { cursor.style.left = range.value + '%'; target.style.left = targetValues[gate] + '%'; };
    const judge = () => {
      if (state !== 'playing') return;
      const distance = Math.abs(Number(range.value) - targetValues[gate]);
      const allowed = 12 * config.tolerance;
      scoreSum += clamp(100 - distance * (100 / Math.max(18, allowed * 1.8)), 0, 100);
      feedback(distance <= allowed ? '穿过第 ' + (gate + 1) + ' 道风门！' : '偏开了金圈，但风羽仍在向前。');
      gate++; tone(distance <= allowed ? 650 : 220);
      if (gate >= targetValues.length) {
        completeRound(scoreSum / targetValues.length, '风羽穿过 ' + targetValues.length + ' 道风门；越靠近金圈中心，鹤势越舒展。');
        return;
      }
      range.value = '50'; paint();
    };
    range.addEventListener('input', paint); confirm.addEventListener('click', judge); paint();
    setRuntime({
      duration: 15000 * config.duration,
      onKeyDown: key => {
        if (['arrowleft', 'a'].includes(key)) range.value = String(clamp(Number(range.value) - 4, 0, 100));
        else if (['arrowright', 'd'].includes(key)) range.value = String(clamp(Number(range.value) + 4, 0, 100));
        else if ([' ', 'enter'].includes(key)) judge();
        paint();
      },
      timeout: () => completeRound(gate ? scoreSum / targetValues.length : 0, '时间内穿过了 ' + gate + ' / ' + targetValues.length + ' 道风门。'),
    });
    range.focus({ preventScroll: true });
  }

  function renderUnion() {
    const shell = gameShell('六合同启', '先后点亮左右掌，间隔越短，合劲越完整。键盘可用 A / D。');
    const pads = make('div', 'union-pads');
    const left = make('button', '', '左合 · A'), center = make('span', 'union-center', '合'), right = make('button', '', '右合 · D');
    left.type = right.type = 'button'; pads.append(left, center, right); shell.append(pads);
    let first = null, firstTime = 0, pair = 0, errors = 0, scoreSum = 0;
    const press = (side, button) => {
      if (state !== 'playing') return;
      button.classList.add('lit'); window.setTimeout(() => button.classList.remove('lit'), 180);
      if (!first) { first = side; firstTime = runtime.elapsed; feedback('另一掌，合！'); tone(480); return; }
      if (first === side) { errors++; firstTime = runtime.elapsed; feedback('同一侧重复了，另一掌还没跟上。'); tone(180); return; }
      const delta = Math.abs(runtime.elapsed - firstTime), windowMs = 850 * config.tolerance;
      scoreSum += clamp(105 - delta / windowMs * 75, 15, 100); pair++; first = null;
      feedback('第 ' + pair + ' 次合劲 · 相差 ' + Math.round(delta) + ' 毫秒'); tone(620 + pair * 55); tactile(18);
      if (pair >= 3) completeRound(scoreSum / 3 - errors * 8, '左右三次合启完成。最短的间隔，最接近“一处发力”。');
    };
    left.addEventListener('click', () => press('left', left)); right.addEventListener('click', () => press('right', right));
    setRuntime({
      duration: 12000 * config.duration,
      onKeyDown: key => ['a', 'arrowleft'].includes(key) ? press('left', left) : ['d', 'arrowright'].includes(key) ? press('right', right) : undefined,
      timeout: () => completeRound(scoreSum / 3 - errors * 8, '完成了 ' + pair + ' / 3 次合劲。'),
    });
    left.focus({ preventScroll: true });
  }

  function renderTigerStep() {
    const shell = gameShell('蓄势落步', '按住蓄力，力量进入金色区域时松开。空格键同样支持按住与松开。');
    const meter = make('div', 'power-meter'), fill = make('i'), label = make('span', '', '0%');
    const half = levelKey === 'easy' ? 14 : levelKey === 'normal' ? 10 : 7;
    const center = Math.round(randomBetween(57 + half, 94 - half));
    meter.style.setProperty('--zone-left', (center - half) + '%');
    meter.style.setProperty('--zone-width', (half * 2) + '%');
    meter.append(fill, label);
    const hold = make('button', 'hold-button', '按住蓄势'); hold.type = 'button'; shell.append(meter, hold);
    let power = 0, holding = false, attempts = 0, scoreSum = 0;
    const paint = () => { meter.style.setProperty('--power', power + '%'); label.textContent = Math.round(power) + '%'; hold.classList.toggle('active', holding); };
    const begin = () => { if (state === 'playing') { holding = true; hold.textContent = '松开落步！'; } };
    const release = () => {
      if (state !== 'playing' || !holding) return;
      holding = false; const distance = Math.abs(power - center);
      scoreSum += clamp(100 - distance * (100 / Math.max(25, half * 2.2)), 0, 100); attempts++;
      feedback(distance <= half ? '落点震住了！' : power < center ? '力还没蓄满，下一步再沉一点。' : '冲过头了，试着早一点落步。');
      tone(distance <= half ? 145 : 205, .16); tactile(distance <= half ? 42 : 20);
      if (attempts >= 3) { completeRound(scoreSum / 3, '三次落步完成；金色区域代表“蓄而不僵、落而不散”。'); return; }
      power = 0; hold.textContent = '按住蓄势'; paint();
    };
    hold.addEventListener('pointerdown', event => { event.preventDefault(); hold.setPointerCapture?.(event.pointerId); begin(); });
    hold.addEventListener('pointerup', release); hold.addEventListener('pointercancel', release);
    hold.addEventListener('keydown', event => { if (event.code === 'Space' && !event.repeat) { event.preventDefault(); begin(); } });
    hold.addEventListener('keyup', event => { if (event.code === 'Space') { event.preventDefault(); release(); } });
    setRuntime({
      duration: 15000 * config.duration,
      update: delta => { if (holding) { power += delta * (levelKey === 'hard' ? .055 : .043); if (power > 100) power = 0; paint(); } },
      onKeyDown: key => { if (key === ' ') begin(); }, onKeyUp: key => { if (key === ' ') release(); },
      onPause: () => { holding = false; hold.textContent = '按住蓄势'; paint(); },
      timeout: () => completeRound(scoreSum / 3, '时间内完成了 ' + attempts + ' / 3 次落步。'),
    });
    paint(); hold.focus({ preventScroll: true });
  }

  function renderTigerStrike() {
    const shell = gameShell('黑虎寻隙', '击中亮起的拳靶。键盘可按九宫格对应的数字 1—9。');
    const grid = make('div', 'target-grid');
    const buttons = Array.from({ length: 9 }, (_, index) => {
      const button = make('button', '', String(index + 1)); button.type = 'button'; button.dataset.index = String(index);
      button.addEventListener('click', () => strike(index)); grid.append(button); return button;
    });
    shell.append(grid);
    const total = levelKey === 'easy' ? 5 : levelKey === 'normal' ? 6 : 7;
    const period = levelKey === 'easy' ? 1500 : levelKey === 'normal' ? 1100 : 850;
    let active = -1, previous = -1, age = 0, resolved = 0, hits = 0, scoreSum = 0;
    const spawn = () => {
      buttons.forEach(button => { button.classList.remove('target'); button.textContent = String(Number(button.dataset.index) + 1); });
      if (resolved >= total) { completeRound(scoreSum / total, '命中 ' + hits + ' / ' + total + ' 个拳靶。黑虎要快，也要先找准空隙。'); return; }
      do active = Math.floor(runRandom() * 9); while (active === previous);
      previous = active; age = 0;
      buttons[active].classList.add('target'); buttons[active].textContent = '击';
    };
    const miss = () => { scoreSum += 0; resolved++; tone(170); feedback('拳影散了，下一处！'); spawn(); };
    function strike(index) {
      if (state !== 'playing') return;
      if (index === active) {
        hits++; resolved++; scoreSum += clamp(100 - age / period * 52, 42, 100); tone(760); tactile(18); feedback('命中！寻找下一处空隙。'); spawn();
      } else {
        scoreSum = Math.max(0, scoreSum - 10); tone(160); feedback('那里没有拳靶，先看亮光再出手。');
      }
    }
    spawn();
    setRuntime({
      duration: (period * total + 2500) * config.duration,
      update: delta => { age += delta; if (age >= period * config.duration) miss(); },
      onKeyDown: key => { const number = Number(key); if (number >= 1 && number <= 9) strike(number - 1); },
      timeout: () => completeRound(scoreSum / total, '命中 ' + hits + ' / ' + total + ' 个拳靶。'),
    });
  }

  function renderTide() {
    const shell = gameShell('闽江回潮', '潮珠经过金门时按“回身”。空格键也可以收势。');
    const dial = make('div', 'tide-dial'), bead = make('i', 'tide-bead'), gate = make('i', 'tide-gate');
    dial.append(bead, gate); const button = make('button', '', '回身 · 空格'); button.type = 'button'; shell.append(dial, button);
    const gateCount = levelKey === 'hard' ? 4 : 3;
    const startAngle = Math.round(randomBetween(15, 110));
    const spacing = 360 / gateCount;
    const gates = Array.from({ length: gateCount }, (_, index) => Math.round((startAngle + index * spacing + randomBetween(-18, 18) + 360) % 360));
    let angle = 0, gateIndex = 0, scoreSum = 0;
    const paint = () => { bead.style.setProperty('--angle', angle + 'deg'); gate.style.setProperty('--gate-angle', gates[gateIndex] + 'deg'); };
    const turn = () => {
      if (state !== 'playing') return;
      const difference = Math.abs(((angle - gates[gateIndex] + 540) % 360) - 180);
      scoreSum += clamp(100 - difference * (levelKey === 'easy' ? 2 : levelKey === 'normal' ? 2.7 : 3.4), 0, 100);
      feedback(difference <= 18 * config.tolerance ? '潮珠入门，回身接住了。' : '回身偏开了一点，继续跟住圆势。');
      tone(difference <= 18 * config.tolerance ? 610 : 210); gateIndex++;
      if (gateIndex >= gates.length) { completeRound(scoreSum / gates.length, '沿圆势完成 ' + gates.length + ' 次回身；不是追最快，而是等潮珠回到门前。'); return; }
      paint();
    };
    button.addEventListener('click', turn); paint();
    setRuntime({
      duration: 15000 * config.duration,
      update: delta => { angle = (angle + delta * (levelKey === 'hard' ? .1 : levelKey === 'normal' ? .075 : .055)) % 360; paint(); },
      onKeyDown: key => { if ([' ', 'enter'].includes(key)) turn(); },
      timeout: () => completeRound(scoreSum / gates.length, '完成了 ' + gateIndex + ' / ' + gates.length + ' 次回身。'),
    });
    button.focus({ preventScroll: true });
  }

  function renderPush() {
    const shell = gameShell('罗汉推山', '连续推掌把力量送进金色区间，并稳定保持。空格键可连续发力。');
    const meter = make('div', 'power-meter'), fill = make('i'), label = make('span', '', '30%');
    meter.style.setProperty('--zone-left', '55%'); meter.style.setProperty('--zone-width', '22%'); meter.append(fill, label);
    const status = make('div', 'push-status'); status.append(make('span', '', '稳定 '), make('strong', '', '0.0 秒'));
    const button = make('button', '', '推掌 · 空格'); button.type = 'button'; shell.append(meter, status, button);
    let power = 30, stable = 0, overshoots = 0; const needed = levelKey === 'easy' ? 1500 : levelKey === 'normal' ? 2100 : 2700;
    const paint = () => { meter.style.setProperty('--power', power + '%'); label.textContent = Math.round(power) + '%'; status.querySelector('strong').textContent = (stable / 1000).toFixed(1) + ' 秒'; };
    const push = () => {
      if (state !== 'playing') return;
      const before = power; power = clamp(power + (levelKey === 'hard' ? 9 : 12), 0, 100);
      if (before <= 82 && power > 82) overshoots++; tone(power <= 80 ? 460 : 190); paint();
    };
    button.addEventListener('click', push);
    setRuntime({
      duration: 13000 * config.duration,
      update: delta => {
        power = Math.max(0, power - delta * (levelKey === 'hard' ? .014 : .011));
        if (power >= 55 && power <= 77) stable += delta; else stable = Math.max(0, stable - delta * .32);
        paint();
        if (stable >= needed) completeRound(100 - overshoots * 8 - runtime.elapsed / runtime.duration * 12, '推力稳定了 ' + (stable / 1000).toFixed(1) + ' 秒；持续控制比一下推满更重要。');
      },
      onKeyDown: key => { if ([' ', 'enter'].includes(key)) push(); },
      timeout: () => completeRound(stable / needed * 80 - overshoots * 6, '稳定了 ' + (stable / 1000).toFixed(1) + ' / ' + (needed / 1000).toFixed(1) + ' 秒。'),
    });
    paint(); button.focus({ preventScroll: true });
  }

  function renderBreath() {
    const shell = gameShell('少年归元', '光环最大时吸、最小时呼；按提示在顶点收住。空格键同样有效。');
    const orb = make('div', 'breath-orb', '吸'), button = make('button', '', '在顶点收势 · 空格'); button.type = 'button'; shell.append(orb, button);
    const targets = [0.25, 0.75, 0.25], labels = ['吸', '呼', '吸'];
    const cycle = levelKey === 'easy' ? 3000 : levelKey === 'normal' ? 2400 : 1900;
    let phase = 0, targetIndex = 0, scoreSum = 0;
    const paint = () => {
      const wave = Math.sin(phase * Math.PI * 2) * .5 + .5;
      orb.style.setProperty('--breath-scale', (.84 + wave * .26).toFixed(3));
      orb.style.setProperty('--breath-ring', Math.round(12 + wave * 27) + 'px');
      orb.textContent = labels[targetIndex];
    };
    const settle = () => {
      if (state !== 'playing') return;
      const difference = Math.abs(((phase - targets[targetIndex] + 1.5) % 1) - .5);
      scoreSum += clamp(100 - difference * (levelKey === 'easy' ? 260 : levelKey === 'normal' ? 340 : 430), 0, 100);
      feedback(difference <= .09 * config.tolerance ? labels[targetIndex] + '息正好，气归中线。' : '呼吸还差一点到顶，下一次放慢。');
      tone(difference <= .09 * config.tolerance ? 530 : 220); targetIndex++;
      if (targetIndex >= targets.length) { completeRound(scoreSum / targets.length, '三次呼吸完成。最后一式不比力量，只比能不能安静收住。'); return; }
      button.textContent = '在“' + labels[targetIndex] + '”的顶点收势'; paint();
    };
    button.addEventListener('click', settle);
    setRuntime({
      duration: 14000 * config.duration,
      update: delta => { phase = (phase + delta / cycle) % 1; paint(); },
      onKeyDown: key => { if ([' ', 'enter'].includes(key)) settle(); },
      timeout: () => completeRound(scoreSum / targets.length, '完成了 ' + targetIndex + ' / ' + targets.length + ' 次归元呼吸。'),
    });
    paint(); button.focus({ preventScroll: true });
  }

  const actionAPI = () => ({ gameShell, setRuntime, complete: completeRound, feedback, tone, level: levelKey, random: runRandom, playing: () => state === 'playing' });
  const renderers = [renderSalute, renderCrane, renderUnion, renderTigerStep,
    () => window.WushuActionGames.fight(actionAPI()), () => window.WushuActionGames.tide(actionAPI()), renderPush, renderBreath];

  function showMove(index) {
    moveIndex = index; const move = moves[index];
    setState('playing'); stage.dataset.game = games[index];
    roundResult.hidden = finalPanel.hidden = true; nextButton.hidden = continueButton.hidden = true;
    pauseButton.hidden = false; pauseButton.textContent = '暂停'; startButton.hidden = true;
    el('forms-seal').textContent = move.school;
    el('forms-heritage').textContent = move.heritage || '八闽武脉致意';
    el('forms-move').textContent = move.name; el('forms-instruction').textContent = instructions[index];
    feedback(instructions[index]); updateHud(); renderers[index]();
  }

  function startSession() {
    if (!['ready', 'done'].includes(state)) return;
    try { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); audioContext.resume().catch(() => {}); } catch { /* visual game remains */ }
    createRunRandom();
    points = 0; scores = []; formDetails = []; lastResult = null; moveIndex = 0;
    el('forms-progress-fill').style.width = '0%'; showMove(0);
  }

  function nextMove() {
    if (state !== 'between') return;
    if (moveIndex >= moves.length - 1) { finishSession(); return; }
    showMove(moveIndex + 1);
  }

  function calculateCombo() {
    let combo = 0, best = 0;
    scores.forEach(score => { combo = score >= 70 ? combo + 1 : 0; best = Math.max(best, combo); });
    return best;
  }

  function saveResult(result) {
    const save = window.WushuSave.read();
    const stored = objectValue(save.formRecords), formRecords = { ...stored };
    const previous = objectValue(formRecords[levelKey]);
    const newRecord = !Number.isFinite(previous.points) || result.points > previous.points;
    if (newRecord) formRecords[levelKey] = { ...result, date: new Date().toISOString() };
    const mastery = { ...objectValue(save.mastery) };
    result.forms.forEach((form, index) => {
      const old = objectValue(mastery[moves[index].name]);
      mastery[moves[index].name] = {
        ...old,
        attempts: safeNumber(old.attempts) + 1,
        perfect: safeNumber(old.perfect) + (form.score >= 90 ? 1 : 0),
      };
    });
    const achievements = new Set(Array.isArray(save.achievements) ? save.achievements : []), before = new Set(achievements);
    achievements.add('first_form'); achievements.add('eight_ways');
    if (result.forms.every(form => form.score >= 75)) achievements.add('all_forms_a');
    const newAchievements = [...achievements].filter(key => !before.has(key));
    const saved = window.WushuSave.write({
      formRecords, mastery, achievements: [...achievements],
      totalRuns: safeNumber(save.totalRuns) + 1, totalFormRuns: safeNumber(save.totalFormRuns) + 1,
    });
    return { newRecord, newAchievements, saved };
  }

  function finishSession() {
    stopClock(); setState('done'); moveIndex = moves.length - 1;
    roundResult.hidden = true; playfield.replaceChildren();
    const accuracy = Math.round(scores.reduce((sum, score) => sum + score, 0) / Math.max(1, scores.length));
    const grade = accuracy >= 90 ? 'S' : accuracy >= 78 ? 'A' : accuracy >= 60 ? 'B' : 'C';
    lastResult = {
      mode: 'forms', level: levelKey, points, score: points, grade, accuracy,
      bestCombo: calculateCombo(), style: 'mixed', forms: formDetails, aborted: false,
    };
    Object.assign(lastResult, saveResult(lastResult));
    finalPanel.hidden = false; el('forms-grade').textContent = grade;
    el('forms-final-summary').textContent = points + ' 分 · 八式掌握度 ' + accuracy + '% · 连续稳定 ' + lastResult.bestCombo + ' 式';
    el('forms-score-grid').replaceChildren();
    formDetails.forEach(form => {
      const item = make('span'); item.append(make('strong', '', form.score + ' 分'), document.createTextNode(form.name)); el('forms-score-grid').append(item);
    });
    const unlocks = lastResult.newAchievements.map(key => achievementNames[key] || key).join(' / ');
    el('forms-unlocks').textContent = (lastResult.newRecord ? '八式百炼新纪录！' : '历史纪录已保留。') + (unlocks ? ' 新成就 · ' + unlocks : '') + (lastResult.saved ? '' : ' 本次未能保存。');
    feedback('百炼完成 · ' + grade + ' 级');
    nextButton.hidden = pauseButton.hidden = true; startButton.hidden = false; startButton.textContent = '再练八式'; continueButton.hidden = false;
    updateHud(); tone(820, .18); continueButton.focus({ preventScroll: true });
  }

  function togglePause() {
    if (state === 'playing') {
      runtime?.onPause?.(); setState('paused'); stopClock(); pauseButton.textContent = '继续'; feedback('八式百炼已暂停'); updateHud();
    } else if (state === 'paused') {
      setState('playing'); lastStamp = performance.now(); frame = requestAnimationFrame(tick); pauseButton.textContent = '暂停'; feedback(instructions[moveIndex]);
    }
  }

  function close(aborted) {
    const done = resolve, result = aborted ? { mode: 'forms', level: levelKey, aborted: true } : lastResult;
    resolve = null; stopClock(); runtime = null; panel.hidden = true; setState('ready');
    playfield.replaceChildren(); roundResult.hidden = finalPanel.hidden = true;
    done?.(result);
  }

  startButton.addEventListener('click', startSession);
  nextButton.addEventListener('click', nextMove);
  pauseButton.addEventListener('click', togglePause);
  continueButton.addEventListener('click', () => { if (state === 'done') close(false); });
  el('forms-exit').addEventListener('click', () => { if (!panel.hidden) close(true); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && !panel.hidden && state === 'playing') togglePause(); });
  window.addEventListener('keydown', event => {
    if (panel.hidden) return;
    if (event.key === 'Escape') {
      // 浮层之上还有原生对话框时（例如设置面板），Esc 应先交给对话框关闭。
      if (document.querySelector('dialog[open]')) return;
      event.preventDefault(); event.stopImmediatePropagation(); if (!event.repeat) togglePause(); return;
    }
    if (state !== 'playing' || event.target.closest?.('input, select, textarea, a')) return;
    const key = event.key.toLowerCase();
    if (event.target.closest?.('button') && [' ', 'enter'].includes(key)) return;
    if (runtime?.onKeyDown) { event.preventDefault(); if (!event.repeat || games[moveIndex] === 'tigerstep') runtime.onKeyDown(key); }
  });
  window.addEventListener('keyup', event => {
    if (panel.hidden || state !== 'playing' || event.target.closest?.('input, select, textarea, a')) return;
    if (event.target.closest?.('button') && [' ', 'enter'].includes(event.key.toLowerCase())) return;
    if (runtime?.onKeyUp) { event.preventDefault(); runtime.onKeyUp(event.key.toLowerCase()); }
  });

  window.wushuForms = {
    open(muted, selectedDifficulty = 'easy', settings = {}) {
      if (resolve) close(true);
      isMuted = typeof muted === 'function' ? muted : () => Boolean(muted);
      options = settings || {}; levelKey = Object.hasOwn(difficulty, selectedDifficulty) ? selectedDifficulty : 'easy'; config = difficulty[levelKey];
      setState('ready'); panel.hidden = false; panel.dataset.level = levelKey;
      el('forms-title').textContent = options.title || '八式百炼';
      startButton.hidden = false; startButton.textContent = '开始百炼'; nextButton.hidden = pauseButton.hidden = continueButton.hidden = true;
      continueButton.textContent = options.continueLabel || '继续剧情'; roundResult.hidden = finalPanel.hidden = true; playfield.replaceChildren();
      points = 0; scores = []; formDetails = []; moveIndex = 0; runtime = null;
      el('forms-seal').textContent = moves[0].school; el('forms-move').textContent = moves[0].name;
      el('forms-heritage').textContent = moves[0].heritage; el('forms-instruction').textContent = instructions[0];
      feedback('八式会使用八种不同的操作方式。准备好后开始。'); updateHud();
      startButton.focus({ preventScroll: true }); panel.scrollTop = 0;
      return new Promise(done => { resolve = done; });
    },
  };
})();
