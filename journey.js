const $ = selector => document.querySelector(selector);
const screens = {
  difficulty: $('#difficulty-screen'), character: $('#character-screen'),
  sight: $('#sight-screen'), ending: $('#ending-screen'),
};
const transition = $('#transition');
const menuAudio = $('#menu-audio'), peaceAudio = $('#peace-audio'), voiceAudio = $('#voice-audio');
const musicTracks = {
  menu: menuAudio, school: $('#school-audio'), action: $('#action-audio'),
  comedy: $('#comedy-audio'), suspense: $('#suspense-audio'), ending: $('#ending-audio'),
};
const musicSources = {
  menu: 'resources/sound/music/menu.mp3',
  peace: 'resources/sound/music/peace.mp3',
  school: 'resources/sound/music/download-candidates/schoolday.ogg',
  action: 'resources/sound/music/download-candidates/cinematic-percussion.wav',
  comedy: 'resources/sound/music/download-candidates/happy-clappy.wav',
  suspense: 'resources/sound/music/download-candidates/suspense.ogg',
  ending: 'resources/sound/music/download-candidates/forget-me-not-loop.ogg',
};
const musicToggle = $('#music-toggle'), dialogue = $('#novel-dialogue');
const speaker = $('#speaker'), dialogueText = $('#sight-title');
const jiahaoCharacter = $('#jiahao-character'), chapter = $('#chapter-label');
const choicePanel = $('#story-choice'), infoDialog = $('#info-dialog'), journalDialog = $('#journal-dialog');
const { scenes, story } = window.WushuStory;
const rawSettings = window.WushuSave.read().settings;
const settings = rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings) ? rawSettings : {};
const clamp = (value, min, max, fallback) => Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
let textSpeed = [0, 20, 40, 65].includes(settings.textSpeed) ? settings.textSpeed : 40;
let musicVolume = clamp(settings.musicVolume, 0, .5, .24);
let selectedLevel = 'easy', selectedCharacter = '男同学';
let storyIndex = 0, currentScene = 'gate', history = [], currentLineText = '', branchLine = null;
let gameState = freshState(), typingTimer, epoch = 0;
let isTyping = false, isSceneEventPlaying = false, choosing = false, standalone = false;
let currentMusic = menuAudio, muted = !!settings.muted, journalTab = 'moves', lastSaveSucceeded = true;
const pause = milliseconds => new Promise(resolve => window.setTimeout(resolve, milliseconds));
const reduceMotion = () => document.body.classList.contains('reduce-motion');
let pendingReaction = null;
function clearReaction() {
  pendingReaction = null;
  $('#story-reaction').hidden = true;
  screens.sight.removeAttribute('data-reaction');
}
function showReaction(effect) {
  if (!effect || screens.sight.hidden) return;
  const panel = $('#story-reaction');
  panel.querySelector('.reaction-kicker').textContent = effect.kicker || '';
  panel.querySelector('.reaction-title').textContent = effect.title;
  panel.querySelector('.reaction-caption').textContent = effect.caption || '';
  panel.dataset.kind = effect.kind || 'stamp';
  panel.hidden = false;
  screens.sight.dataset.reaction = panel.dataset.kind;
}

function freshState() {
  return {
    character: selectedCharacter, practiceResult: null, practiceResults: {}, adventureResults: {},
    rapport: 0, courage: 0, focus: 0, choices: {},
  };
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function makeNode(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function validCheckpoint(value) {
  return [2, 3].includes(value?.version) && Number.isInteger(value.index) && value.index >= 0 &&
    value.index < (value.version === 2 ? window.WushuStory.legacyIndices.length : story.length) &&
    Object.hasOwn(scenes, value.scene) && Object.hasOwn(window.WUSHU.difficulties, value.level) &&
    ['男同学', '女同学'].includes(value.character) && value.state && typeof value.state === 'object';
}

function updateStoryStatus() {
  $('#bond-status').textContent = gameState.rapport >= 2 ? '同窗 · 默契渐成' : gameState.rapport >= 1 ? '同窗 · 熟络起来' : '同窗 · 初识';
  $('#chapter-progress').textContent = lastSaveSucceeded ? '剧情已自动保存' : '本次无法存档 · 可继续游玩';
}

function saveCheckpoint() {
  if (standalone || screens.sight.hidden) return;
  lastSaveSucceeded = window.WushuSave.write({
    checkpoint: {
      version: 3, index: storyIndex, scene: currentScene, character: selectedCharacter,
      level: selectedLevel, state: gameState, history: history.slice(-120), branchLine,
      jiahao: jiahaoCharacter.classList.contains('show-front'), date: new Date().toISOString(),
    },
  });
  updateStoryStatus();
}

function showScreen(name) {
  clearReaction();
  Object.entries(screens).forEach(([key, screen]) => {
    screen.hidden = key !== name;
    if (key === name) screen.inert = false;
  });
  document.title = name === 'difficulty' ? '武术操挑战 · 同频少年' :
    '同频少年 · ' + (name === 'ending' ? '校园第一日完成' : '武术操挑战');
  if (name !== 'difficulty') return;
  const save = window.WushuSave.read();
  const records = plainObject(save.records), formRecords = plainObject(save.formRecords);
  $('#personal-best').textContent = Object.entries(window.WUSHU.difficulties).map(([key, level]) => {
    const rhythmPoints = records[key]?.points, formPoints = formRecords[key]?.points;
    const points = Math.max(Number.isFinite(rhythmPoints) ? rhythmPoints : -1, Number.isFinite(formPoints) ? formPoints : -1);
    const label = points === formPoints ? '百炼' : '节奏';
    return level.name + '：' + (points >= 0 ? points + ' 分·' + label : '未挑战');
  }).join(' · ');
  const achieved = new Set(Array.isArray(save.achievements) ? save.achievements : []);
  const endings = new Set(Array.isArray(save.endings) ? save.endings : []);
  $('#achievement-summary').textContent = '成就 ' + window.WUSHU.achievements.filter(item => achieved.has(item.id)).length +
    ' / ' + window.WUSHU.achievements.length + ' · 校园回忆 ' + endings.size + ' / ' + endingEntries().length;
  const checkpoint = save.checkpoint;
  $('#resume-button').hidden = !validCheckpoint(checkpoint);
  if (validCheckpoint(checkpoint)) {
    $('#resume-button').textContent = '继续 · ' + scenes[checkpoint.scene].title.replace(/^第.章\s*·\s*/, '');
    $('#save-status').textContent = checkpoint.character + ' · ' + window.WUSHU.difficulties[checkpoint.level].name +
      ' · 已有故事存档；重新选难度会开始新故事。';
  } else {
    $('#save-status').textContent = lastSaveSucceeded ? '剧情自动存档 · 挑战随时可重来' : '当前浏览器无法保存进度';
  }
}

function refreshMusicLabel() {
  musicToggle.textContent = muted ? '声音：关' : (!$('#practice').hidden || !$('#adventure').hidden || !$('#forms').hidden || !currentMusic.paused ? '声音：开' : '开启声音');
  musicToggle.setAttribute('aria-pressed', String(!muted));
}

function tryMusic() {
  if (muted || !$('#practice').hidden || !$('#adventure').hidden || !$('#forms').hidden) return;
  currentMusic.play().then(refreshMusicLabel).catch(refreshMusicLabel);
}

function musicLevel() {
  return musicVolume * (!$('#forms').hidden ? .42 : !$('#adventure').hidden ? .55 : 1) * (!voiceAudio.paused && !voiceAudio.ended ? .38 : 1);
}

function useMusic(audio) {
  if (!audio) audio = peaceAudio;
  const trackName = Object.keys(musicTracks).find(name => musicTracks[name] === audio);
  const source = musicSources[trackName] || (audio === peaceAudio ? musicSources.peace : null);
  if (source && audio.getAttribute('src') !== source) audio.src = source;
  if (currentMusic !== audio) {
    currentMusic.pause(); currentMusic.currentTime = 0; currentMusic = audio;
  }
  currentMusic.volume = musicLevel(); currentMusic.muted = muted;
  tryMusic(); refreshMusicLabel();
}

function useSceneMusic() {
  const trackName = scenes[currentScene]?.music || 'peace';
  const audio = musicTracks[trackName] || peaceAudio;
  if (musicSources[trackName] && audio.getAttribute('src') !== musicSources[trackName]) audio.src = musicSources[trackName];
  useMusic(audio);
}

function stopVoice() {
  voiceAudio.pause();
  if (voiceAudio.hasAttribute('src')) { voiceAudio.removeAttribute('src'); voiceAudio.load(); }
  currentMusic.volume = musicLevel();
}

function playVoice(source) {
  stopVoice();
  if (!source || muted) return;
  currentMusic.volume = musicVolume * .38;
  voiceAudio.src = source; voiceAudio.muted = muted;
  voiceAudio.play().catch(() => { currentMusic.volume = musicLevel(); });
}

function finishCurrentLine() {
  clearInterval(typingTimer);
  dialogueText.textContent = currentLineText;
  isTyping = false; dialogue.classList.remove('is-typing');
  updateDialogueHint();
  if (pendingReaction) { showReaction(pendingReaction); pendingReaction = null; }
}

function renderLine(line = branchLine || story[storyIndex], record = true) {
  if (!line || line.event) return;
  clearReaction();
  pendingReaction = typeof line.effect === 'function' ? line.effect(gameState) : line.effect || null;
  currentLineText = String(typeof line.text === 'function' ? line.text(gameState) : line.text || '');
  if (record) history.push((line.speaker || '旁白') + '：' + currentLineText);
  clearInterval(typingTimer);
  choicePanel.hidden = true; choosing = false;
  speaker.textContent = line.speaker || '旁白'; dialogueText.textContent = '';
  dialogue.hidden = false; playVoice(line.voice);
  isTyping = true; dialogue.classList.add('is-typing'); dialogue.classList.remove('is-last');
  updateDialogueHint();
  let index = 0;
  if (textSpeed === 0 || currentLineText.length === 0) finishCurrentLine();
  else typingTimer = setInterval(() => {
    dialogueText.textContent += currentLineText[index++];
    if (index >= currentLineText.length) finishCurrentLine();
  }, textSpeed);
  saveCheckpoint();
}

function setScene(name) {
  currentScene = Object.hasOwn(scenes, name) ? name : 'gate';
  const scene = scenes[currentScene];
  chapter.textContent = scene.title;
  screens.sight.style.setProperty('--scene-image', 'url("' + (scene.image || 'resources/scene/physics/background_school.webp') + '")');
  screens.sight.classList.toggle('is-still', currentScene !== 'gate');
  useSceneMusic();
}

function lockStoryTools(locked) {
  ['story-log', 'story-settings', 'story-skip'].forEach(id => { $('#' + id).disabled = locked; });
}

function showChoice(line) {
  stopVoice(); clearInterval(typingTimer); isTyping = false; isSceneEventPlaying = false;
  dialogue.hidden = true; choicePanel.hidden = false; choosing = true;
  $('#choice-prompt').textContent = line.prompt;
  $('#choice-options').replaceChildren();
  line.options.forEach(option => {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.option = option.id;
    button.append(makeNode('strong', option.label), makeNode('span', option.detail || ''));
    button.addEventListener('click', () => {
      if (!choosing) return;
      choosing = false; choicePanel.hidden = true;
      gameState.choices[line.id] = option.id;
      ['rapport', 'courage', 'focus'].forEach(key => {
        gameState[key] += clamp(option.effects?.[key], -2, 2, 0);
      });
      history.push('我的选择：' + option.label);
      branchLine = option.reply ? {
        speaker: option.reply.speaker || '嘉豪',
        text: typeof option.reply.text === 'function' ? option.reply.text(gameState) : option.reply.text,
        effect: typeof option.reply.effect === 'function' ? option.reply.effect(gameState) : option.reply.effect || null,
      } : null;
      if (branchLine) renderLine();
      else { storyIndex++; runCurrent(); }
      dialogue.focus({ preventScroll: true });
    });
    $('#choice-options').append(button);
  });
  saveCheckpoint();
  $('#choice-options button')?.focus({ preventScroll: true });
}

function runCurrent() {
  while (storyIndex < story.length && story[storyIndex].when && !story[storyIndex].when(gameState)) storyIndex++;
  if (storyIndex >= story.length) { showEnding(); return; }
  const line = story[storyIndex];
  if (line.event) void playEvent(line);
  else renderLine();
}

function playEvent(line) {
  clearReaction();
  if (line.event === 'choice') { showChoice(line); return Promise.resolve(); }
  if (line.event === 'ending') { showEnding(); return Promise.resolve(); }
  return playTimedEvent(line);
}

async function playTimedEvent(line) {
  const token = epoch;
  isSceneEventPlaying = true; choosing = false; choicePanel.hidden = true; dialogue.hidden = true;
  clearInterval(typingTimer); isTyping = false; stopVoice(); lockStoryTools(true); saveCheckpoint();
  if (line.event === 'practice') {
    if (line.mode === 'relay') useMusic(musicTracks.action);
    currentMusic.pause(); screens.sight.inert = true;
    const result = await window.wushuPractice.open(() => muted, selectedLevel, {
      mode: line.mode || 'standard', title: line.title,
      continueLabel: standalone ? '返回菜单' : '继续剧情',
    });
    screens.sight.inert = false;
    if (token !== epoch) return;
    isSceneEventPlaying = false; lockStoryTools(false);
    if (result?.aborted || standalone) { goHome(); return; }
    gameState.practiceResult = result;
    gameState.practiceResults[line.id || line.mode || 'standard'] = result;
    useSceneMusic();
  } else if (line.event === 'forms') {
    useMusic(musicTracks.action);
    currentMusic.volume = musicVolume * .42; screens.sight.inert = true;
    const result = await window.wushuForms.open(() => muted, selectedLevel, {
      title: line.title || '八式百炼', continueLabel: standalone ? '返回菜单' : '继续剧情',
    });
    screens.sight.inert = false;
    if (token !== epoch) return;
    isSceneEventPlaying = false; lockStoryTools(false);
    if (result?.aborted || standalone) { goHome(); return; }
    gameState.practiceResult = result;
    gameState.practiceResults[line.id || 'standard'] = result;
    useSceneMusic();
  } else if (line.event === 'adventure') {
    useMusic(line.mode === 'spar' ? musicTracks.suspense : musicTracks.comedy);
    currentMusic.volume = musicVolume * .55; screens.sight.inert = true;
    const result = await window.wushuAdventure.open(() => muted, selectedLevel, {
      mode: line.mode || 'paper', title: line.title,
      continueLabel: standalone ? '返回菜单' : '继续剧情',
    });
    screens.sight.inert = false;
    if (token !== epoch) return;
    isSceneEventPlaying = false; lockStoryTools(false);
    if (result?.aborted || standalone) { goHome(); return; }
    gameState.adventureResults[line.id || line.mode || 'paper'] = result;
    useSceneMusic();
  } else if (line.event === 'jiahaoEntrance') {
    const front = $('.jiahao-front');
    if (front.decode) front.decode().catch(() => {});
    jiahaoCharacter.className = 'jiahao-character enter';
    await pause(reduceMotion() ? 0 : 1050);
    if (token !== epoch) return;
    jiahaoCharacter.className = 'jiahao-character arrived';
    await pause(reduceMotion() ? 120 : 1050);
    if (token !== epoch) return;
    jiahaoCharacter.classList.add('turn');
    await pause(reduceMotion() ? 0 : 405);
    if (token !== epoch) return;
    jiahaoCharacter.classList.add('show-front');
    await pause(reduceMotion() ? 0 : 495);
    if (token !== epoch) return;
    jiahaoCharacter.classList.remove('turn');
  } else if (line.event === 'scene') {
    transition.classList.remove('play'); void transition.offsetWidth; transition.classList.add('play');
    await pause(reduceMotion() ? 0 : 500);
    if (token !== epoch) return;
    jiahaoCharacter.className = 'jiahao-character'; setScene(line.scene);
    await pause(reduceMotion() ? 0 : 550);
    if (token !== epoch) return;
    transition.classList.remove('play');
  }
  isSceneEventPlaying = false; lockStoryTools(false); storyIndex++;
  runCurrent();
}

function advanceStory() {
  if (screens.sight.hidden || !$('#practice').hidden || !$('#adventure').hidden || !$('#forms').hidden || isSceneEventPlaying || choosing || infoDialog.open || journalDialog.open) return;
  if (isTyping) { finishCurrentLine(); return; }
  if (!voiceAudio.paused && !voiceAudio.ended && !muted) return;
  branchLine = null; storyIndex++; runCurrent();
}

function beginStory() {
  standalone = false; storyIndex = 0; history = []; branchLine = null;
  gameState = freshState(); jiahaoCharacter.className = 'jiahao-character';
  setScene('gate'); runCurrent();
}

async function selectCharacter(card) {
  if (isSceneEventPlaying) return;
  const token = ++epoch;
  isSceneEventPlaying = true; selectedCharacter = card.dataset.character;
  screens.sight.dataset.character = selectedCharacter;
  useMusic(peaceAudio);
  transition.classList.remove('play'); void transition.offsetWidth; transition.classList.add('play');
  await pause(reduceMotion() ? 0 : 500);
  if (token !== epoch) return;
  transition.classList.remove('play'); showScreen('sight'); isSceneEventPlaying = false;
  if ($('#quick-mode').checked) {
    const mode = $('#practice-mode').value;
    standalone = true; setScene(mode === 'relay' || mode === 'spar' ? 'relay' : mode === 'paper' ? 'lunch' : 'exercise');
    jiahaoCharacter.className = 'jiahao-character';
    void playEvent({ event: mode === 'forms' ? 'forms' : ['paper', 'spar'].includes(mode) ? 'adventure' : 'practice', mode });
  } else {
    beginStory(); dialogue.focus({ preventScroll: true });
  }
}

function resumeStory() {
  const checkpoint = window.WushuSave.read().checkpoint;
  if (!validCheckpoint(checkpoint)) { showScreen('difficulty'); return; }
  ++epoch; standalone = false; choosing = isSceneEventPlaying = false; lockStoryTools(false);
  selectedCharacter = checkpoint.character; selectedLevel = checkpoint.level;
  gameState = { ...freshState(), ...checkpoint.state, character: selectedCharacter };
  gameState.choices = plainObject(gameState.choices);
  gameState.practiceResults = plainObject(gameState.practiceResults);
  gameState.adventureResults = plainObject(gameState.adventureResults);
  ['rapport', 'courage', 'focus'].forEach(key => { gameState[key] = clamp(gameState[key], 0, 20, 0); });
  storyIndex = checkpoint.version === 2 ? window.WushuStory.legacyIndices[checkpoint.index] : checkpoint.index;
  history = Array.isArray(checkpoint.history) ? checkpoint.history.filter(value => typeof value === 'string').slice(-120) : [];
  branchLine = checkpoint.branchLine && typeof checkpoint.branchLine.text === 'string' ? checkpoint.branchLine : null;
  showScreen('sight'); setScene(checkpoint.scene); screens.sight.dataset.character = selectedCharacter;
  jiahaoCharacter.className = 'jiahao-character' + (checkpoint.jiahao ? ' arrived show-front' : '');
  if (branchLine || !story[storyIndex].event) renderLine(branchLine || story[storyIndex], false);
  else runCurrent();
  if (!choosing && !isSceneEventPlaying) dialogue.focus({ preventScroll: true });
}

function goHome() {
  ++epoch; clearInterval(typingTimer);
  isTyping = choosing = isSceneEventPlaying = false; standalone = false; branchLine = null;
  choicePanel.hidden = true; stopVoice(); transition.classList.remove('play');
  jiahaoCharacter.className = 'jiahao-character'; lockStoryTools(false);
  showScreen('difficulty'); useMusic(menuAudio);
  ($('#resume-button').hidden ? $('#easy-button') : $('#resume-button')).focus({ preventScroll: true });
}

function startQuickPractice(mode) {
  ++epoch; standalone = true; showScreen('sight');
  setScene(mode === 'relay' || mode === 'spar' ? 'relay' : mode === 'paper' ? 'lunch' : 'exercise');
  if (mode === 'relay') useMusic(musicTracks.action);
  else if (mode === 'spar') useMusic(musicTracks.suspense);
  jiahaoCharacter.className = 'jiahao-character';
  void playEvent({ event: mode === 'forms' ? 'forms' : ['paper', 'spar'].includes(mode) ? 'adventure' : 'practice', mode });
}

function endingEntries() {
  const data = window.WUSHU.endings;
  if (Array.isArray(data)) return data;
  return Object.entries(plainObject(data)).map(([id, ending]) => ({ id, name: ending.title, ...ending }));
}

function showEnding() {
  stopVoice(); clearInterval(typingTimer);
  isTyping = choosing = isSceneEventPlaying = false;
  const relay = gameState.practiceResults.relay || gameState.practiceResult;
  const key = gameState.rapport >= 2 ? 'together' : gameState.courage >= 2 && relay?.accuracy >= 70 ? 'lead' : 'steady';
  const ending = endingEntries().find(item => item.id === key) || endingEntries()[0];
  const save = window.WushuSave.read();
  const unlocked = new Set(Array.isArray(save.endings) ? save.endings : []);
  const isNew = !unlocked.has(key); unlocked.add(key);
  lastSaveSucceeded = window.WushuSave.write({ checkpoint: null, endings: [...unlocked], lastEnding: key });
  showScreen('ending'); useMusic(musicTracks.ending);
  $('#ending-title').textContent = ending.name || ending.title;
  $('#ending-description').textContent = ending.description;
  $('.ending-seal').textContent = key === 'together' ? '合' : key === 'lead' ? '勇' : '定';
  $('#ending-stats').replaceChildren();
  [['standard', '八式百炼'], ['relay', '嘉豪接拍']].forEach(([mode, label]) => {
    const result = gameState.practiceResults[mode];
    const card = makeNode('div', '', 'ending-stat');
    const detail = result
      ? result.mode === 'forms'
        ? '掌握 ' + result.accuracy + '% · 连成 ' + result.bestCombo + ' 式'
        : '命中 ' + result.accuracy + '% · 最长 ' + result.bestCombo + ' 连式'
      : '下次再来试试';
    card.append(
      makeNode('span', label),
      makeNode('strong', result ? (result.grade || 'C') + ' · ' + result.points + ' 分' : '尚未练习'),
      makeNode('small', detail),
    );
    $('#ending-stats').append(card);
  });
  [['paper', '风中名单'], ['spar', '拆招预演']].forEach(([mode, label]) => {
    const result = gameState.adventureResults[mode];
    const card = makeNode('div', '', 'ending-stat');
    const detail = mode === 'paper'
      ? (result ? '收回 ' + result.correct + ' / ' + result.total + ' 页 · 点错 ' + result.errors + ' 次' : '下次再来试试')
      : (result ? '判断 ' + result.correct + ' / ' + result.total + ' · 剩余定力 ' + result.composure : '下次再来试试');
    card.append(
      makeNode('span', label),
      makeNode('strong', result ? (result.grade || 'C') + ' · ' + result.score + ' 分' : '尚未挑战'),
      makeNode('small', detail),
    );
    $('#ending-stats').append(card);
  });
  $('#ending-quote').textContent = '“' + ending.subtitle + '”——嘉豪';
  $('#ending-unlock').textContent = (isNew ? '新回忆已收录' : '又一次走完了校园第一日') +
    ' · ' + unlocked.size + ' / ' + endingEntries().length + (lastSaveSucceeded ? '' : '（本次未能保存）');
  $('#ending-home').focus({ preventScroll: true });
}

function saveSettings() {
  const previous = plainObject(window.WushuSave.read().settings);
  window.WushuSave.write({
    settings: { ...previous, textSpeed, musicVolume, muted, reduceMotion: $('#motion-toggle').checked },
  });
}

function openInfo(title, body, controls) {
  $('#info-title').textContent = title; $('#info-body').textContent = body;
  $('#settings-controls').hidden = !controls;
  if (!infoDialog.open) infoDialog.showModal();
}

function openHelp() {
  openInfo('玩法与设置',
    '剧情：点击屏幕、空格或回车补全当前句，再按一次继续。选项请直接点击，或用 Tab 选择后回车。配音结束后可翻页。\n\n' +
    '校园挑战：风中名单要按页码依次接住纸张，点错会损失时间；拆招预演不用跟节拍，要从嘉豪的重心和路线选择守中、卸步或截线。\n\n' +
    '八式百炼：八个动作对应八种短游戏，包括左右对拍、风门瞄准、双侧合劲、蓄力落步、拳靶反应、圆势回身、稳定推力和呼吸收势。每关约十几秒，手机与键盘都能玩。\n\n' +
    '节奏练习：每式的目标拍不同。看金色标记，光点到中心时按空格、Enter 或点击“出招”。先试“初学 · 找到节拍”，再挑战八式巡礼与嘉豪接拍。\n\n' +
    '守势判定宽，刚势得分高，游势聚气快。意气蓄满后，随后四招有爆发加分。评级看精准和命中，不受拳风分数倍率影响。\n\n' +
    '故事与选择自动保存在当前浏览器。练习中刷新，会从这一轮的预备页继续。直接练习不会覆盖故事存档。\n\n' +
    '键盘、鼠标或手机都可以玩；拆招依据选择，练习依据按键时机，全程无需摄像头。', true);
}

function openJournal() {
  renderJournal(journalTab);
  if (!journalDialog.open) journalDialog.showModal();
}

function renderJournal(tab) {
  journalTab = tab;
  const save = window.WushuSave.read(), content = $('#journal-content');
  const mastery = plainObject(save.mastery), records = plainObject(save.records), modeRecords = plainObject(save.modeRecords);
  const formRecords = plainObject(save.formRecords);
  const adventureRecords = plainObject(save.adventureRecords);
  const earned = new Set(Array.isArray(save.achievements) ? save.achievements : []);
  $('#journal-summary').textContent = '已练 ' + Math.max(0, Number(save.totalRuns) || 0) + ' 轮 · 已完成 ' +
    Math.max(0, Number(save.totalChallenges) || 0) + ' 次校园挑战 · 所有记录保存在当前浏览器';
  document.querySelectorAll('[data-journal]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.journal === tab));
  });
  content.replaceChildren();
  if (tab === 'moves') {
    content.className = 'move-grid';
    window.WUSHU.moves.forEach((move, index) => {
      const progress = plainObject(mastery[move.name]);
      const perfect = Math.max(0, Number(progress.perfect) || 0);
      const card = makeNode('article', '', 'move-card');
      const top = makeNode('div', '', 'move-card-heading');
      top.append(makeNode('span', move.school, 'move-stamp'), makeNode('span', String(index + 1).padStart(2, '0') + ' / 八式', 'move-number'));
      const beats = makeNode('div', '', 'codex-beats');
      beats.setAttribute('aria-label', '第' + (move.targetBeat + 1) + '拍出招');
      ['一', '二', '三', '四'].forEach((beat, beatIndex) => beats.append(makeNode('span', beat, beatIndex === move.targetBeat ? 'target' : '')));
      card.append(
        top, makeNode('h3', move.name), makeNode('p', move.heritage || '八闽武脉游戏化致意', 'move-heritage'),
        makeNode('p', move.description || move.tip), beats,
        makeNode('p', move.memory || move.tip, 'move-memory'),
        makeNode('small', (perfect >= 10 ? '炉火渐青' : perfect >= 3 ? '渐入佳境' : perfect >= 1 ? '初窥门径' : '等待第一拍') +
          ' · 精准 ' + perfect + ' 次 / 尝试 ' + (Math.max(0, Number(progress.attempts)) || 0) + ' 次'),
      );
      content.append(card);
    });
  } else if (tab === 'records') {
    content.className = 'record-list';
    const table = document.createElement('table');
    table.append(makeNode('caption', '个人最佳 · 各难度独立记录'));
    const head = document.createElement('thead'), headerRow = document.createElement('tr');
    ['难度', '八式百炼', '八式节奏', '嘉豪接拍', '风中名单', '拆招预演'].forEach(text => headerRow.append(makeNode('th', text)));
    head.append(headerRow); table.append(head);
    const body = document.createElement('tbody');
    Object.entries(window.WUSHU.difficulties).forEach(([key, level]) => {
      const row = document.createElement('tr'); row.append(makeNode('th', level.name));
      const formRecord = formRecords[key];
      row.append(makeNode('td', formRecord && Number.isFinite(formRecord.points) ? (formRecord.grade ? formRecord.grade + ' · ' : '') + formRecord.points + ' 分' : '待挑战'));
      ['standard', 'relay'].forEach(mode => {
        const record = plainObject(modeRecords[key])[mode] || (mode === 'standard' ? records[key] : null);
        row.append(makeNode('td', record && Number.isFinite(record.points) ? (record.grade ? record.grade + ' · ' : '') + record.points + ' 分' : '待挑战'));
      });
      ['paper', 'spar'].forEach(mode => {
        const record = plainObject(adventureRecords[key])[mode];
        row.append(makeNode('td', record && Number.isFinite(record.score) ? (record.grade ? record.grade + ' · ' : '') + record.score + ' 分' : '待挑战'));
      });
      body.append(row);
    });
    table.append(body); content.append(table, makeNode('h3', '成就印章'));
    window.WUSHU.achievements.forEach(achievement => {
      const card = makeNode('article', '', 'achievement-card' + (earned.has(achievement.id) ? ' unlocked' : ''));
      card.append(makeNode('strong', (earned.has(achievement.id) ? '已达成 · ' : '未达成 · ') + achievement.name), makeNode('p', achievement.description));
      content.append(card);
    });
  } else {
    content.className = 'memory-list';
    const unlocked = new Set(Array.isArray(save.endings) ? save.endings : []);
    endingEntries().forEach(ending => {
      const card = makeNode('article', '', 'memory-card' + (unlocked.has(ending.id) ? ' unlocked' : ''));
      const hint = ending.id === 'together' ? '试着多接住同伴递过来的话。' : ending.id === 'lead' ? '把主动站出来的勇气，落在接拍成绩上。' : '给自己一点时间，慢慢记住今天。';
      card.append(makeNode('span', unlocked.has(ending.id) ? '已收录' : '待发现', 'memory-tag'), makeNode('h3', ending.name || ending.title), makeNode('p', unlocked.has(ending.id) ? ending.description : hint));
      content.append(card);
    });
  }
}

document.querySelectorAll('[data-level]').forEach(button => button.addEventListener('click', () => {
  selectedLevel = button.dataset.level;
  $('#selected-level').textContent = window.WUSHU.difficulties[selectedLevel].name + '模式';
  $('#character-subtitle').textContent = $('#quick-mode').checked ? '直接进入所选挑战。故事存档会为你保留。' : '同一个操场，两种开场白。招式与判定相同。';
  showScreen('character'); $('#back-button').focus({ preventScroll: true });
}));
$('#back-button').addEventListener('click', goHome);
document.querySelectorAll('.character-card').forEach(card => card.addEventListener('click', () => void selectCharacter(card)));
function updateModeDescription() {
  const quick = $('#quick-mode').checked;
  $('#practice-mode-label').hidden = !quick;
  $('.difficulty-caption').textContent = quick ? '01 / 选个难度，直接开练' : '01 / 选个难度，去学校报到';
  const descriptions = {
    forms: '八式百炼：八种动作、八种操作。瞄准、蓄力、反应与平衡都要试试。',
    standard: '八式巡礼：看准目标拍出招，可选守势、刚势或游势。',
    relay: '嘉豪接拍：先看他示范，再接自己的回合。不要抢戏。',
    paper: '风中名单：按页码收回名单，别把午饭菜单捡进去。',
    spar: '拆招预演：观察脚步和重心，选择守、让或截。无需跟音乐。',
  };
  $('#mode-description').textContent = quick ? descriptions[$('#practice-mode').value] : '第一次来？从故事开始，边认识嘉豪边学动作。';
}
function updateDialogueHint() {
  $('#dialogue-hint').textContent = isTyping ? '点击可显示整句' : !voiceAudio.paused && !voiceAudio.ended && !muted ? '配音播放中 · 播完后继续' : '点击 / 空格 / Enter 继续';
}
['playing', 'ended', 'pause', 'error'].forEach(name => voiceAudio.addEventListener(name, updateDialogueHint));
$('#quick-mode').addEventListener('change', updateModeDescription);
$('#practice-mode').addEventListener('change', updateModeDescription);
updateModeDescription();
$('#resume-button').addEventListener('click', resumeStory);
$('#tutorial-button').addEventListener('click', () => { selectedLevel = 'easy'; startQuickPractice('tutorial'); });
$('#journal-button').addEventListener('click', openJournal);
$('#help-button').addEventListener('click', openHelp);
$('#story-settings').addEventListener('click', openHelp);
$('#story-home').addEventListener('click', goHome);
$('#story-log').addEventListener('click', () => openInfo('对话回看', history.join('\n\n') || '故事还没开始。', false));
$('#story-skip').addEventListener('click', () => {
  clearInterval(typingTimer); isTyping = false; branchLine = null; choosing = false; stopVoice();
  jiahaoCharacter.className = 'jiahao-character';
  const next = story.findIndex((line, index) => index >= storyIndex && ['forms', 'practice'].includes(line.event));
  if (next < 0) { startQuickPractice('relay'); return; }
  storyIndex = next; setScene(story[next].mode === 'relay' ? 'relay' : 'exercise'); runCurrent();
});
screens.sight.addEventListener('click', event => {
  if (!event.target.closest('.story-tools, .story-choice')) advanceStory();
});
window.addEventListener('keydown', event => {
  if (event.defaultPrevented || screens.sight.hidden || !$('#practice').hidden || !$('#adventure').hidden || !$('#forms').hidden || infoDialog.open || journalDialog.open || choosing ||
      event.target.closest?.('button, input, select, textarea, a') || !['Enter', ' ', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault(); if (!event.repeat) advanceStory();
});
musicToggle.addEventListener('click', () => {
  if (currentMusic.paused && !muted && $('#practice').hidden && $('#adventure').hidden && $('#forms').hidden) tryMusic();
  else {
    muted = !muted;
    [...Object.values(musicTracks), peaceAudio, voiceAudio].forEach(audio => { audio.muted = muted; });
    if (muted) stopVoice(); else tryMusic();
  }
  refreshMusicLabel(); saveSettings();
});
['pointerdown', 'keydown'].forEach(eventName => document.addEventListener(eventName, event => {
  if (event.target.closest?.('#music-toggle')) return;
  if ($('#practice').hidden && $('#adventure').hidden && $('#forms').hidden && currentMusic.paused && !muted) tryMusic();
}));
['ended', 'error'].forEach(eventName => voiceAudio.addEventListener(eventName, () => { currentMusic.volume = musicLevel(); }));

$('#text-speed').value = String(textSpeed);
$('#music-volume').value = String(musicVolume * 100);
$('#motion-toggle').checked = typeof settings.reduceMotion === 'boolean' ? settings.reduceMotion : matchMedia('(prefers-reduced-motion: reduce)').matches;
document.body.classList.toggle('reduce-motion', $('#motion-toggle').checked);
$('#text-speed').addEventListener('change', event => {
  textSpeed = Number(event.target.value);
  if (textSpeed === 0 && isTyping) finishCurrentLine();
  saveSettings();
});
$('#music-volume').addEventListener('input', event => {
  musicVolume = Number(event.target.value) / 100; currentMusic.volume = musicLevel(); saveSettings();
});
$('#motion-toggle').addEventListener('change', event => {
  document.body.classList.toggle('reduce-motion', event.target.checked); saveSettings();
});
document.querySelectorAll('[data-journal]').forEach(button => button.addEventListener('click', () => renderJournal(button.dataset.journal)));
$('#ending-home').addEventListener('click', goHome);
$('#ending-journal').addEventListener('click', openJournal);
$('#ending-relay').addEventListener('click', () => startQuickPractice('relay'));

showScreen('difficulty');
useMusic(menuAudio);
