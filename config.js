// 调参入口：毫秒为单位，动作编排为原创游戏玩法。
window.WUSHU = {
  difficulties: {
    easy: { name: '简单', beatMs: 750, perfect: 130, good: 300, rounds: 12 },
    normal: { name: '普通', beatMs: 600, perfect: 100, good: 220, rounds: 16 },
    hard: { name: '困难', beatMs: 450, perfect: 75, good: 160, rounds: 20 },
  },
  styles: {
    steady: { name: '守势', motto: '先稳再发', tolerance: 70, scoreRate: .9, spiritRate: 1 },
    fierce: { name: '刚势', motto: '一击定拍', tolerance: 0, scoreRate: 1.15, spiritRate: 1 },
    flowing: { name: '游势', motto: '连招生风', tolerance: 20, scoreRate: 1, spiritRate: 1.35 },
  },
  heritageStyles: ['地术拳', '六合门', '虎尊拳', '香店拳', '鸣鹤拳', '檀家拳', '咏春拳', '罗汉拳'],
  moves: [
    {
      name: '抱拳礼', school: '礼', category: '起式', targetBeat: 1,
      heritage: '地术拳意象 · 低势稳根',
      tip: '以礼开场 · 第二拍合拳', memory: '一备 · 二合 · 三停 · 四收',
      description: '喧闹在抱拳的一刻收拢。游戏里的第一道光，从第二拍亮起。',
      sprite: null, voice: null,
    },
    {
      name: '鹤引清风', school: '鹤', category: '轻灵', targetBeat: 2,
      heritage: '鸣鹤拳意象 · 舒展亮掌',
      tip: '舒肩展臂 · 第三拍亮掌', memory: '一听 · 二引 · 三展 · 四落',
      description: '手臂展开时，光迹像一只掠过操场的鹤。前两拍留给风，第三拍留给你。',
      sprite: null, voice: null,
    },
    {
      name: '六合开门', school: '合', category: '开势', targetBeat: 1,
      heritage: '六合门意象 · 起落合劲',
      tip: '上下相随 · 第二拍开架', memory: '一候 · 二开 · 三随 · 四定',
      description: '像推开新教室的门，第二拍让两侧光环同时展开。早到的机会，也需要等准。',
      sprite: null, voice: null,
    },
    {
      name: '虎步撼地', school: '虎', category: '沉稳', targetBeat: 3,
      heritage: '虎尊拳意象 · 沉猛落步',
      tip: '沉肩稳胯 · 第四拍落步', memory: '一蓄 · 二等 · 三等 · 四落',
      description: '前三拍把声响藏住，最后一拍才让地面的光纹荡开。最难的常常是忍住提前。',
      sprite: null, voice: null,
    },
    {
      name: '黑虎掏心', school: '虎', category: '破势', targetBeat: 2,
      heritage: '虎尊拳与民间虎式致意',
      tip: '蓄势待发 · 第三拍出招', memory: '一藏 · 二蓄 · 三破 · 四回',
      description: '借传统招式名写成的一次节拍亮相：第三拍的金色闪光，是这一式的主角。',
      sprite: null, voice: null,
    },
    {
      name: '闽江回潮', school: '流', category: '回环', targetBeat: 1,
      heritage: '香店拳 × 檀家拳致意',
      tip: '先收后放 · 第二拍回身', memory: '一收 · 二回 · 三流 · 四平',
      description: '光带绕回原点，像潮水拐过校园外的河湾。第二拍接住它，让前一式自然流向下一式。',
      sprite: null, voice: null,
    },
    {
      name: '罗汉推山', school: '刚', category: '厚重', targetBeat: 3,
      heritage: '罗汉拳意象 · 沉稳推掌',
      tip: '力从脚起 · 第四拍推出', memory: '一候 · 二蓄 · 三守 · 四推',
      description: '一面层叠的光墙，在第四拍向远处铺开。山只是游戏里的意象，耐心才是这式的考题。',
      sprite: null, voice: null,
    },
    {
      name: '少年归元', school: '定', category: '收式', targetBeat: 2,
      heritage: '咏春拳意象 · 守中归元',
      tip: '气息归一 · 第三拍收势', memory: '一缓 · 二听 · 三收 · 四静',
      description: '光点回到胸前，操场重新听得见风。把第三拍稳稳收好，给整套练习留一个句号。',
      sprite: null, voice: null,
    },
  ],
  achievements: [
    { id: 'first_form', name: '初试身手', description: '完整完成一轮武术操练习。' },
    { id: 'five_chain', name: '五式连环', description: '在同一轮中连续命中至少五式。' },
    { id: 'tiger_heart', name: '黑虎正中', description: '在“黑虎掏心”一式获得一次精准判定。' },
    { id: 'spirit_burst', name: '少年意气', description: '在练习中触发一次意气爆发。' },
    { id: 'hard_clear', name: '难关破阵', description: '完成困难练习，命中率达到70%。' },
    { id: 'paper_chaser', name: '风中接页', description: '在风中名单里按顺序收齐全部名单，且最多点错一次。' },
    { id: 'stance_reader', name: '读势入门', description: '在一次拆招预演中正确判断至少五回合。' },
    { id: 'all_rounder', name: '文武全勤', description: '完成一次节奏练习、风中名单和拆招预演。' },
    { id: 'eight_ways', name: '八式百炼', description: '完成八种操作方式各不相同的动作试炼。' },
    { id: 'all_forms_a', name: '八脉同辉', description: '在同一轮八式百炼中，每一式都达到75分。' },
  ],
  endings: {
    together: { title: '同频之约', subtitle: '明天，还是站你旁边。', description: '你的回应让一次偶遇变成了约定。有人愿意等你半拍，也有人能接住你的下一拍。' },
    lead: { title: '前排预备役', subtitle: '名字还没写上，位置先留好了。', description: '你把主动迈出的那一步，接成了足够稳的一轮。明天的前排，也许真的有你的位置。' },
    steady: { title: '把这一拍记住', subtitle: '第一天，找到自己的落点就很好。', description: '未必每一式都完美，但你已经记住了风声、铃声和自己的节拍。故事从这里继续。' },
  },
};
window.WushuSave = {
  read() {
    try {
      const saved = JSON.parse(localStorage.getItem('wushu-v1'));
      return saved !== null && typeof saved === 'object' && !Array.isArray(saved) &&
        Object.getPrototypeOf(saved) === Object.prototype ? saved : {};
    } catch { return {}; }
  },
  write(update) {
    try { localStorage.setItem('wushu-v1', JSON.stringify({ ...this.read(), ...update })); return true; }
    catch { return false; }
  },
};
