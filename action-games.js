(() => {
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const load = src => { const image = new Image(); image.src = src; return image; };
  const dot = (ctx, x, y, r, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
  function surface(api, title, help, background) {
    const shell = api.gameShell(title, help);
    shell.classList.add('action-game');
    const status = document.createElement('p'); status.className = 'action-status';
    const canvas = document.createElement('canvas'); canvas.width = 720; canvas.height = 360;
    canvas.className = 'action-canvas'; canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', title + '。' + help);
    canvas.style.backgroundImage = `url("resources/scene/sight/${background}")`;
    const controls = document.createElement('div'); controls.className = 'action-controls';
    shell.append(status, canvas, controls);
    canvas.focus({ preventScroll: true });
    return { shell, status, canvas, controls, ctx: canvas.getContext('2d') };
  }
  function button(parent, text, action) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = text;
    if (action) b.addEventListener('click', action);
    parent.append(b); return b;
  }
  function hold(button, down, up) {
    button.addEventListener('pointerdown', e => { e.preventDefault(); button.setPointerCapture(e.pointerId); down(); });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture', 'blur']) button.addEventListener(event, up);
    button.addEventListener('keydown', e => { if (['Enter', ' '].includes(e.key)) { e.preventDefault(); if (!e.repeat) down(); } });
    button.addEventListener('keyup', e => { if (['Enter', ' '].includes(e.key)) { e.preventDefault(); up(); } });
  }

  function tide(api) {
    const { status, canvas, controls, ctx } = surface(api, '回潮 · 风中穿行', '方向键 / WASD 移动，Shift 慢移；手机拖动画面。只判中心白点，X 清场一次。', 'tide_court_v1.webp');
    let x = 360, y = 290, bullets = [], time = 0, nextWave = 1500, wave = 0, hits = 0, graze = 0, immune = 0, used = false;
    const keys = new Set(); let pointer = null;
    const seconds = 18, speed = api.level === 'easy' ? 78 : api.level === 'normal' ? 100 : 125;
    const clear = button(controls, '回潮清场 · X（1）', () => {
      if (!api.playing() || used) return;
      used = true; bullets = []; immune = 1600; clear.disabled = true; clear.textContent = '清场已用';
      api.feedback('这叫回身，不叫开大。至少老师是这么说的。'); api.tone(630);
    });
    const slow = button(controls, '按住慢移');
    hold(slow, () => keys.add('shift'), () => keys.delete('shift'));
    function target(e) {
      const rect = canvas.getBoundingClientRect();
      pointer = { x: clamp((e.clientX - rect.left) / rect.width * 720, 12, 708), y: clamp((e.clientY - rect.top) / rect.height * 360, 65, 348) };
    }
    canvas.addEventListener('pointerdown', e => { if (!api.playing()) return; canvas.setPointerCapture(e.pointerId); target(e); });
    canvas.addEventListener('pointermove', e => { if (api.playing() && canvas.hasPointerCapture(e.pointerId)) target(e); });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, () => { pointer = null; });
    function resetInput() { keys.clear(); pointer = null; }
    canvas.addEventListener('blur', resetInput);
    function draw() {
      ctx.clearRect(0, 0, 720, 360);
      ctx.fillStyle = '#06182b66'; ctx.fillRect(0, 0, 720, 360);
      for (const b of bullets) { dot(ctx, b.x, b.y, 8, '#0b253a'); dot(ctx, b.x, b.y, 5, b.color); }
      ctx.strokeStyle = immune > 0 ? '#a2f8df' : '#82dced'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, keys.has('shift') ? 18 : 13, 0, Math.PI * 2); ctx.stroke();
      dot(ctx, x, y, 5, '#13263c'); dot(ctx, x, y, 3, '#ffffff');
      ctx.fillStyle = '#f6e5b8'; ctx.font = 'bold 16px sans-serif'; ctx.fillText('回潮 · 第 ' + wave + ' 波', 18, 27);
      status.textContent = `剩余 ${Math.max(0, Math.ceil(seconds - time / 1000))} 秒 · 擦弹 ${graze} · 被击 ${hits} / 5`;
      canvas.dataset.hits = hits; canvas.dataset.graze = graze;
    }
    function finish() { api.complete(clamp(75 + Math.min(25, graze * 3) - hits * 15 - (time < seconds * 1000 ? 15 : 0), 0, 100), `穿过 ${wave} 波潮珠，擦弹 ${graze} 次，被击 ${hits} 次。判定只看白点；清场可以留给最挤的时候。`); }
    api.setRuntime({
      duration: seconds * 1000,
      update(delta) {
        time += delta; immune = Math.max(0, immune - delta);
        const step = (keys.has('shift') ? 105 : 245) * delta / 1000;
        let dx = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
        let dy = Number(keys.has('s') || keys.has('arrowdown')) - Number(keys.has('w') || keys.has('arrowup'));
        if (pointer) { dx = pointer.x - x; dy = pointer.y - y; }
        const distance = Math.hypot(dx, dy);
        if (distance) { const move = pointer ? Math.min(step, distance) : step; x = clamp(x + dx / distance * move, 12, 708); y = clamp(y + dy / distance * move, 65, 348); }
        if (time >= nextWave) {
          wave++; nextWave = time + (api.level === 'hard' ? 850 : 1150);
          const source = 120 + api.random() * 480;
          const aim = Math.atan2(y - 18, x - source);
          const count = api.level === 'easy' ? 7 : 11;
          const gap = Math.floor(api.random() * count);
          for (let i = 0; i < count; i++) {
            if (i === gap) continue;
            const angle = aim + (i - (count - 1) / 2) * .19;
            bullets.push({ x: source, y: 18, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, grazed: false, color: wave % 2 ? '#ffe397' : '#82eff2' });
          }
        }
        for (const b of bullets) {
          b.x += b.vx * delta / 1000; b.y += b.vy * delta / 1000;
          const dist = Math.hypot(b.x - x, b.y - y);
          if (dist < 9 && immune === 0) { hits++; immune = 1100; b.y = 999; api.tone(180); api.feedback('擦到白点了。身体其余部分不用管，放心挪。'); }
          else if (dist >= 9 && dist < 25 && !b.grazed && immune === 0) { b.grazed = true; graze++; }
        }
        bullets = bullets.filter(b => b.y < 380 && b.x > -20 && b.x < 740).slice(-120);
        draw(); if (hits >= 5) finish();
      },
      onKeyDown(key) { if (key === 'x') clear.click(); else { pointer = null; keys.add(key); } },
      onKeyUp: key => keys.delete(key), onPause: resetInput, timeout: finish,
    });
    draw();
  }

  function fight(api) {
    const { status, canvas, controls, ctx } = surface(api, '黑虎 · 木人攻防', '先看预兆，再防守反击。J 轻拳，按住 K 防守，L 重拳（消耗 50 气）。', 'training_arena_v1.webp');
    const hero = load('resources/character/jiahao_front_start.webp');
    const dummy = load('resources/character/training_dummy_v1.webp');
    let health = 100, enemy = 100, energy = 0, guard = 100, guarding = false, guardSince = 0;
    let time = 0, phase = 'ready', phaseLeft = 1000, cooldown = 0, recoil = 0, combo = 0, best = 0, parries = 0;
    const windup = api.level === 'easy' ? 1000 : api.level === 'normal' ? 780 : 600;
    const labels = { ready: '观察 · 等待起势', windup: '木臂将至 · 防守！', recovery: '出现破绽 · 反击！' };
    function finish() { api.complete((100 - enemy) * .7 + health * .3, `击破 ${100 - enemy}% · 最高 ${best} 连击 · 精准防守 ${parries} 次。木人：申请调休。`); }
    function attack(heavy) {
      if (!api.playing() || cooldown > 0) return;
      if (heavy && energy < 50) { api.feedback('重拳需要 50 气，先防住一招或用轻拳攒气。'); return; }
      if (heavy) energy -= 50;
      guarding = false; cooldown = heavy ? 650 : 330; recoil = 150;
      if (phase !== 'recovery') { health = Math.max(0, health - 8); combo = 0; api.feedback('抢招被木臂挡回来了。等“反击”提示！'); api.tone(150); }
      else {
        const damage = heavy ? 24 : 9; enemy = Math.max(0, enemy - damage); energy = Math.min(100, energy + (heavy ? 0 : 12));
        combo++; best = Math.max(best, combo); api.tone(heavy ? 170 : 530);
        api.feedback(heavy ? '黑虎掏心！木人：这也算体育课？' : `${combo} 连击！抓紧硬直，可以接重拳。`);
      }
      draw(); if (!enemy || !health) finish();
    }
    const jab = button(controls, '轻拳 · J', () => attack(false));
    const block = button(controls, '按住防守 · K');
    const heavy = button(controls, '重拳 · L', () => attack(true));
    function defend() { if (api.playing() && !guarding && cooldown <= 0 && guard > 10) { guarding = true; guardSince = time; } }
    hold(block, defend, () => { guarding = false; });
    function bar(x, y, value, color) { ctx.fillStyle = '#10263d'; ctx.fillRect(x, y, 245, 16); ctx.fillStyle = color; ctx.fillRect(x, y, 245 * value / 100, 16); }
    function draw() {
      ctx.clearRect(0, 0, 720, 360);
      ctx.fillStyle = '#071b3466'; ctx.fillRect(0, 0, 720, 360);
      bar(22, 35, health, '#81e3c0'); bar(453, 35, enemy, '#f59a76');
      ctx.fillStyle = '#fff4dd'; ctx.font = 'bold 17px sans-serif'; ctx.fillText('我方架势', 22, 25); ctx.fillText('木人耐久', 453, 25);
      const offset = recoil > 0 ? 24 : 0;
      if (hero.complete && hero.naturalWidth) ctx.drawImage(hero, 150 + offset, 105, 145, 225);
      else { ctx.fillStyle = '#81e3c0'; ctx.fillRect(190, 155, 65, 170); }
      if (dummy.complete && dummy.naturalWidth) ctx.drawImage(dummy, 445 - (phase === 'windup' ? 16 : 0), 95, 160, 240);
      else { ctx.fillStyle = '#ce9357'; ctx.fillRect(485, 130, 75, 190); }
      if (guarding) { ctx.strokeStyle = '#9bfbef'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(226, 220, 78, -.9, .9); ctx.stroke(); }
      if (recoil > 0 && phase === 'recovery') { ctx.strokeStyle = '#ffe297'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(300, 210); ctx.lineTo(475, 195); ctx.stroke(); }
      ctx.textAlign = 'center'; ctx.font = 'bold 22px sans-serif'; ctx.fillStyle = phase === 'recovery' ? '#a3ffe3' : '#fff0b8'; ctx.fillText(labels[phase], 360, 83); ctx.textAlign = 'left';
      status.textContent = `架势 ${health} · 木人 ${enemy} · 气 ${energy} / 100 · 防守耐力 ${Math.ceil(guard)} · ${combo} 连击`;
      canvas.dataset.phase = phase; canvas.dataset.enemy = enemy; canvas.dataset.health = health;
      heavy.disabled = energy < 50; jab.disabled = cooldown > 0; block.classList.toggle('active', guarding);
    }
    api.setRuntime({
      duration: 24000,
      update(delta) {
        time += delta; cooldown = Math.max(0, cooldown - delta); recoil = Math.max(0, recoil - delta);
        guard = clamp(guard + delta * (guarding ? -.065 : .035), 0, 100);
        if (!guard) guarding = false;
        phaseLeft -= delta;
        if (phaseLeft <= 0) {
          if (phase === 'ready') { phase = 'windup'; phaseLeft = windup; }
          else if (phase === 'windup') {
            if (guarding && guard > 0 && cooldown === 0) {
              const perfect = time - guardSince < 300;
              energy = Math.min(100, energy + (perfect ? 35 : 22)); if (perfect) parries++;
              api.feedback(perfect ? '精准格挡！现在可以反击。' : '防住了！木臂收回前抓紧反击。'); api.tone(680);
            } else { health = Math.max(0, health - (api.level === 'hard' ? 23 : 17)); combo = 0; api.feedback('吃到木臂了。看黄色预兆，按住防守。'); api.tone(180); }
            phase = 'recovery'; phaseLeft = api.level === 'hard' ? 900 : 1250;
          } else { phase = 'ready'; phaseLeft = 500 + api.random() * 650; }
        }
        draw(); if (!health) finish();
      },
      onKeyDown(key) { if (key === 'j') attack(false); if (key === 'l') attack(true); if (key === 'k') defend(); },
      onKeyUp(key) { if (key === 'k') guarding = false; },
      onPause() { guarding = false; }, timeout: finish,
    });
    canvas.addEventListener('blur', () => { guarding = false; });
    draw();
  }
  window.WushuActionGames = { tide, fight };
})();
