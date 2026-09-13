const $ = (selector) => document.querySelector(selector);
const screens = { difficulty: $('#difficulty-screen'), character: $('#character-screen'), sight: $('#sight-screen') };
const transition = $('#transition');
const menuAudio = $('#menu-audio');
const peaceAudio = $('#peace-audio');
const voiceAudio = $('#voice-audio');
const musicToggle = $('#music-toggle');
const dialogue = $('#novel-dialogue');
const speaker = $('#speaker');
const dialogueText = $('#sight-title');
const jiahaoCharacter = $('#jiahao-character');
const chapter = $('#chapter-label');
const settings = window.WushuSave.read().settings || {};
let textSpeed = Number.isFinite(settings.textSpeed) ? settings.textSpeed : 40;
let musicVolume = Number.isFinite(settings.musicVolume) ? settings.musicVolume : .24;
let selectedLevel = 'easy';
let history = [];
let currentLineText = '';
const gameState = { practiceResult: null };
const infoDialog = $('#info-dialog');

const { scenes, story } = window.WushuStory;
let storyIndex = 0;
let typingTimer;
let isTyping = false;
let isSceneEventPlaying = false;
let currentMusic = menuAudio;
let muted = !!settings.muted;
let selectedCharacter = '男同学';
const pause = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

function showScreen(name) {
  Object.entries(screens).forEach(([key, screen]) => { screen.hidden = key !== name; });
  if (name === 'difficulty') {
    const save = window.WushuSave.read();
    const records = save.records || {};
    $('#personal-best').textContent = Object.entries(window.WUSHU.difficulties).map(([key, level]) =>
      level.name + '：' + (records[key] ? records[key].points + ' 分' : '未挑战')).join(' · ');
    $('#achievement-summary').textContent = '成就：' + (save.achievements || []).length + ' / 5';
  }
}
function refreshMusicLabel() {
  musicToggle.textContent = muted ? '音乐：关' : currentMusic.paused ? '开启音乐' : '音乐：开';
  musicToggle.setAttribute('aria-pressed', String(!muted && !currentMusic.paused));
}
function tryMusic() {
  if (muted) return;
  currentMusic.play().then(refreshMusicLabel).catch(refreshMusicLabel);
}
function useMusic(audio) {
  if (currentMusic !== audio) {
    currentMusic.pause();
    currentMusic.currentTime = 0;
    currentMusic = audio;
  }
  currentMusic.volume = musicVolume;
  currentMusic.muted = muted;
  tryMusic();
}
function stopVoice() {
  voiceAudio.pause();
  voiceAudio.removeAttribute('src');
  voiceAudio.load();
  currentMusic.volume = musicVolume;
}
function playVoice(source) {
  stopVoice();
  if (!source) return;
  currentMusic.volume = musicVolume * .38;
  voiceAudio.src = source;
  voiceAudio.muted = muted;
  voiceAudio.play().catch(() => { currentMusic.volume = musicVolume; });
}
function finishCurrentLine() {
  clearInterval(typingTimer);
  dialogueText.textContent = currentLineText;
  isTyping = false;
  dialogue.classList.remove('is-typing');
}
function renderLine() {
  const line = story[storyIndex];
  currentLineText = typeof line.text === 'function' ? line.text(gameState) : line.text;
  history.push((line.speaker || '旁白') + '：' + currentLineText);
  clearInterval(typingTimer);
  speaker.textContent = line.speaker || '旁白';
  dialogueText.textContent = '';
  dialogue.hidden = false;
  playVoice(line.voice);
  isTyping = true;
  dialogue.classList.add('is-typing');
  dialogue.classList.toggle('is-last', storyIndex === story.length - 1);
  let index = 0;
  if (textSpeed === 0) { finishCurrentLine(); return; }
  typingTimer = setInterval(() => {
    dialogueText.textContent += currentLineText[index++];
    if (index >= currentLineText.length) finishCurrentLine();
  }, textSpeed);
}
function setScene(name) {
  const scene = scenes[name];
  chapter.textContent = scene.title;
  const image = scene.image || 'resources/scene/physics/background_school.jpg';
  screens.sight.style.setProperty('--scene-image', 'url("' + image + '")');
  screens.sight.classList.toggle('is-still', name !== 'gate');
  if (scene.music) {
    peaceAudio.src = scene.music;
    useMusic(peaceAudio);
  }
}
async function playEvent(line) {
  isSceneEventPlaying = true;
  dialogue.hidden = true;
  stopVoice();
  document.querySelectorAll('.story-tools button').forEach(button => { button.disabled = true; });
  if (line.event === 'practice') {
    currentMusic.pause();
    const result = await window.wushuPractice.open(() => muted, selectedLevel);
    document.querySelectorAll('.story-tools button').forEach(button => { button.disabled = false; });
    if (result?.aborted) { isSceneEventPlaying = false; goHome(); return; }
    gameState.practiceResult = result;
    tryMusic();
  } else if (line.event === 'jiahaoEntrance') {
    jiahaoCharacter.className = 'jiahao-character enter';
    await pause(1050);
    jiahaoCharacter.className = 'jiahao-character arrived';
    await pause(1150);
    jiahaoCharacter.classList.add('turn');
    await pause(405);
    jiahaoCharacter.classList.add('show-front');
    await pause(495);
    jiahaoCharacter.classList.remove('turn');
  } else {
    transition.classList.remove('play');
    void transition.offsetWidth;
    transition.classList.add('play');
    await pause(500);
    jiahaoCharacter.className = 'jiahao-character';
    setScene(line.scene);
    await pause(550);
  }
  isSceneEventPlaying = false;
  document.querySelectorAll('.story-tools button').forEach(button => { button.disabled = false; });
  storyIndex += 1;
  if (storyIndex < story.length) renderLine();
}
function advanceStory() {
  if (screens.sight.hidden || isSceneEventPlaying || infoDialog.open) return;
  if (isTyping) { finishCurrentLine(); return; }
  // 有配音的句子说完后，才能继续；点击补全文字不会打断配音。
  if (!voiceAudio.paused && !voiceAudio.ended) return;
  if (storyIndex === story.length - 1) {
    stopVoice();
    jiahaoCharacter.className = 'jiahao-character';
    showScreen('difficulty');
    useMusic(menuAudio);
    $('#easy-button').focus();
    return;
  }
  storyIndex += 1;
  if (story[storyIndex].event) playEvent(story[storyIndex]);
  else renderLine();
}
function beginStory() {
  storyIndex = 0;
  history = [];
  gameState.practiceResult = null;
  jiahaoCharacter.className = 'jiahao-character';
  setScene('gate');
  renderLine();
}
document.querySelectorAll('[data-level]').forEach(button => {
  button.addEventListener('click', () => {
    selectedLevel = button.dataset.level;
    $('#selected-level').textContent = window.WUSHU.difficulties[selectedLevel].name + '模式';
    showScreen('character');
  });
});
$('#back-button').addEventListener('click', () => showScreen('difficulty'));
document.querySelectorAll('.character-card').forEach((card) => {
  card.addEventListener('click', async () => {
    if (isSceneEventPlaying) return;
    isSceneEventPlaying = true;
    selectedCharacter = card.dataset.character;
    screens.sight.dataset.character = selectedCharacter;
    // 在点击回调内启动音频，兼容需要用户操作才允许播放的浏览器。
    useMusic(peaceAudio);
    transition.classList.remove('play');
    void transition.offsetWidth;
    transition.classList.add('play');
    await pause(500);
    showScreen('sight');
    isSceneEventPlaying = false;
    if ($('#quick-mode').checked) {
      history = [];
      storyIndex = story.findIndex(line => line.event === 'practice');
      setScene('exercise');
      playEvent(story[storyIndex]);
    } else beginStory();
    dialogue.focus({ preventScroll: true });
  });
});
screens.sight.addEventListener('click', event => {
  if (!event.target.closest('.story-tools')) advanceStory();
});
window.addEventListener('keydown', (event) => {
  if (screens.sight.hidden || infoDialog.open || event.target.closest('.story-tools') || event.target === musicToggle ||
      !['Enter', ' ', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
  event.preventDefault();
  if (!event.repeat) advanceStory();
});
musicToggle.addEventListener('click', () => {
  if (currentMusic.paused && !muted && $('#practice').hidden) tryMusic();
  else {
    muted = !muted;
    [menuAudio, peaceAudio, voiceAudio].forEach((audio) => { audio.muted = muted; });
    if (!muted && $('#practice').hidden) tryMusic();
  }
  refreshMusicLabel();
  saveSettings();
});
['pointerdown', 'keydown'].forEach((event) => {
  document.addEventListener(event, () => { if ($('#practice').hidden && currentMusic.paused && !muted) tryMusic(); });
});
['ended', 'error'].forEach((event) => {
  voiceAudio.addEventListener(event, () => { currentMusic.volume = musicVolume; });
});
function goHome() {
  clearInterval(typingTimer);
  isTyping = false;
  stopVoice();
  jiahaoCharacter.className = 'jiahao-character';
  showScreen('difficulty');
  useMusic(menuAudio);
}
function saveSettings() {
  window.WushuSave.write({ settings: { textSpeed, musicVolume, muted, reduceMotion: $('#motion-toggle').checked } });
}
$('#story-home').addEventListener('click', goHome);
$('#story-skip').addEventListener('click', () => {
  clearInterval(typingTimer); isTyping = false;
  stopVoice();
  jiahaoCharacter.className = 'jiahao-character';
  storyIndex = story.findIndex(line => line.event === 'practice');
  setScene('exercise');
  playEvent(story[storyIndex]);
});
function openInfo(title, body, controls) {
  $('#info-title').textContent = title;
  $('#info-body').textContent = body;
  $('#settings-controls').hidden = !controls;
  infoDialog.showModal();
}
$('#story-log').addEventListener('click', () => openInfo('对话回看', history.join('\n\n'), false));
$('#help-button').addEventListener('click', () => openInfo('玩法与设置',
  '剧情：点击屏幕、空格或回车，补全当前句，再按一次继续。\n练习：目标拍会变化，等光点到金色区中心再出招。每招只结算一次。\n守势判定宽，刚势得分高，游势聚气快。意气蓄满后，接下来四招获得爆发加分。\n成就：初试身手、五式连环、黑虎正中、少年意气、难关破阵。\n简单 / 普通 / 困难会加快节拍、缩小判定范围并增加招数。支持暂停，成绩保存在当前浏览器。', true));
$('#text-speed').value = String(textSpeed);
$('#music-volume').value = String(musicVolume * 100);
$('#motion-toggle').checked = !!settings.reduceMotion;
document.body.classList.toggle('reduce-motion', !!settings.reduceMotion);
$('#text-speed').addEventListener('change', event => { textSpeed = Number(event.target.value); saveSettings(); });
$('#music-volume').addEventListener('input', event => {
  musicVolume = Number(event.target.value) / 100;
  currentMusic.volume = musicVolume;
  saveSettings();
});
$('#motion-toggle').addEventListener('change', event => {
  document.body.classList.toggle('reduce-motion', event.target.checked);
  saveSettings();
});
showScreen('difficulty');
useMusic(menuAudio);
