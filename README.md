# 武术操挑战 · 同频少年

纯静态 HTML / CSS / JavaScript，无构建步骤，不需要服务器或账号。
双击 index.html 可玩；也可在当前目录运行 python -m http.server 8000，然后访问 http://localhost:8000。
发布时上传整个目录，保留 resources 的相对路径即可。当前版本完全在浏览器中运行。

## 游戏流程

选择难度 → 选择角色 → 六章校园剧情 → 八式百炼 → 风中名单 → 拆招预演 → 嘉豪接拍 → 三种结局。
剧情有三次选择，会影响后续回应与最终回忆，不改变练习判定。
“初学 · 找到节拍”提供四式慢速教学；“直接挑战”可单独进入八式百炼、八式节奏、嘉豪接拍、风中名单或拆招预演。
“八式百炼”让八个动作分别采用左右对拍、风门瞄准、双侧合劲、蓄力落步、拳靶反应、圆势回身、稳定推力和呼吸收势，形成连续的运动类短游戏。
“风中名单”是观察与点选挑战，要在风停前避开干扰项并按页码收齐名单；“拆招预演”是回合制判断，不用听鼓点，要从重心和路线选择守中、卸步或截线。
练习可倒数、暂停、退出、重试；网页切到后台会自动暂停。难度和模式分别记录最高分。

剧情支持点击、空格、回车、左右方向键。回看不会重播语音，配音播放时不会误翻页。
八式节奏使用空格、回车或出招按钮；八式百炼会依动作改用左右键、长按、连按、滑杆、九宫格与时机点击，画面中的操作区也都能直接触摸。
剧情、选择、最高分、招式熟练度、成就、结局和设置存储在 localStorage；刷新页面可继续故事。
清理网站数据会丢失记录，不同域名或浏览器之间不互通。浏览器禁止自动播放时，先点击页面或“开启声音”。

## 后续修改位置

- config.js：难度、每拍时长、判定窗口、招数、招式名与动作素材。
- story.js：剧情顺序、台词、选择、配音、场景和练习入口。
- practice.js：三种练习模式、计分、倒数、暂停、评级、熟练度与结算。
- adventure.js：风中名单、拆招预演、校园挑战计分、暂停、记录与结算。
- forms.js：八式百炼的八种操作、动作切换、评分、暂停、记录与结算。
- journey.js：剧情事件、分支、自动存档、手记、结局、菜单与音频管理。
- styles.css / journey.css / practice-extra.css / adventure.css / forms.css：基础、剧情、练习、校园挑战、八式百炼与移动端布局。
- resources：图片、音乐、配音。

### 配乐

菜单继续使用 `resources/sound/music/menu.mp3`。剧情场景、八式百炼、风中名单、拆招预演、嘉豪接拍和结尾使用 `resources/sound/music/download-candidates/` 中按 CC0 授权下载的配乐；切换挑战时降低音量，挑战结束后恢复当前场景音乐。曲目来源、作者与许可证记录在该目录的 `SOURCES.md`。

### 招式素材

config.js 的每招 sprite 可填透明 PNG 路径，voice 可填 MP3 路径。
招式开始时显示图片并播放语音；空值不请求资源。
当前没有骨骼动画或真实姿态识别，评分依据操作时机，不是实际动作是否标准。
新增动作可添加到 moves，关卡会按数组顺序循环至指定招数。

### 剧情配置

普通台词使用 `{ speaker: '嘉豪', text: '...', voice: null }`。
场景切换使用 `{ event: 'scene', scene: 'yard' }`。
练习入口使用 `{ event: 'practice', mode: 'standard' }`，嘉豪入场使用 `{ event: 'jiahaoEntrance' }`。
八式百炼使用 `{ event: 'forms', title: '八式百炼' }`。
校园挑战使用 `{ event: 'adventure', mode: 'paper' }` 或 `{ event: 'adventure', mode: 'spar' }`。
选择使用 `{ event: 'choice', id, prompt, options }`；选项可以增加 rapport、courage 或 focus。
scenes 内 image 为背景相对路径，music 为配乐路径；null 使用现有配乐或校园背景。
动作资料与原创编排边界见“动作参考.md”，生成场景的提示词在 resources/scene/sight/generation-prompts.md。

## 当前版本范围

三个难度均可玩，通过速度、判定窗口、目标数量和稳定时长区分难度。八式百炼与节奏练习各自保存纪录。
八式巡礼以致敬方式直接呈现地术拳、六合门、虎尊拳、香店拳、鸣鹤拳、檀家拳、咏春拳、罗汉拳八种福州本土拳种；动作顺序与判定仍为游戏化编排，不作为官方复刻或教学标准。
玩家可选择守势、刚势或游势；三者分别偏向容错、单次得分和意气积累。
练习和校园挑战结束都会给出 S/A/B/C 评级。精准、连击、观察、读势和八式百炼会解锁十项本地成就；意气蓄满后，随后四招获得爆发加分。
“习武手记”包含八式图鉴、节奏与校园挑战记录、熟练度、成就和三种校园回忆。
美术仍混用已有角色与生成场景；新增台词多数未配音。动作贴图仍待补充。
没有在线排行榜、账号、联网对战或官方授权标识。

## GitHub Pages 目录

保留 `games/武术操/index.html` 与同级 JS、CSS、resources 目录。所有资源都是相对路径，主站发布后可直接访问 `/games/武术操/`。
也可以把本目录单独作为一个仓库上传，此时 index.html 已位于发布根目录，无需构建命令。

## 验证

node --check config.js
node --check story.js
node --check journey.js
node --check practice.js
node --check adventure.js
node --check forms.js

tests/browser.cjs、tests/adventure.cjs 与 tests/forms.cjs 是浏览器流程回归脚本，需要 Playwright。
可通过 PLAYWRIGHT_MODULE 指向已安装模块，BROWSER_EXE 指向本机 Chromium/Chrome。
测试覆盖男女开场与配音、嘉豪转身、三档难度、教程、节奏模式、八种动作游戏、观察与读势挑战、暂停与结算、剧情续玩、全部选择与结局，以及 320px 手机布局。
