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
  moves: [
    { name: '抱拳礼', school: '礼', targetBeat: 1, tip: '以礼开场 · 第二拍合拳', sprite: null, voice: null },
    { name: '鹤引清风', school: '鹤', targetBeat: 2, tip: '舒肩展臂 · 第三拍亮掌', sprite: null, voice: null },
    { name: '六合开门', school: '合', targetBeat: 1, tip: '上下相随 · 第二拍开架', sprite: null, voice: null },
    { name: '虎步撼地', school: '虎', targetBeat: 3, tip: '沉肩稳胯 · 第四拍落步', sprite: null, voice: null },
    { name: '黑虎掏心', school: '虎', targetBeat: 2, tip: '蓄势待发 · 第三拍出招', sprite: null, voice: null },
    { name: '闽江回潮', school: '流', targetBeat: 1, tip: '先收后放 · 第二拍回身', sprite: null, voice: null },
    { name: '罗汉推山', school: '刚', targetBeat: 3, tip: '力从脚起 · 第四拍推出', sprite: null, voice: null },
    { name: '少年归元', school: '定', targetBeat: 2, tip: '气息归一 · 第三拍收势', sprite: null, voice: null },
  ],
};
window.WushuSave = {
  read() {
    try { return JSON.parse(localStorage.getItem('wushu-v1')) || {}; } catch { return {}; }
  },
  write(update) {
    try { localStorage.setItem('wushu-v1', JSON.stringify({ ...this.read(), ...update })); return true; }
    catch { return false; }
  },
};
