# 武术操挑战 · 可玩原型

纯静态 HTML / CSS / JavaScript，无构建步骤，不需要服务器或账号。
双击 index.html 可玩；也可在当前目录运行 python -m http.server 8000，然后访问 http://localhost:8000。
发布时上传整个目录，保留 resources 的相对路径即可。当前没有自动发布或后端服务。

## 游戏流程

选择难度 → 选择角色 → 校园剧情 → 嘉豪登场 → 操场练习 → 结算 → 继续剧情 → 返回菜单。
勾选“直接练习”可跳过开场。剧情中也可跳到练习。
练习可暂停、退出、重试；网页切到后台自动暂停。每种难度单独记录最高分。

剧情支持点击、空格、回车、左右方向键。回看不会重播语音。
练习只使用空格、回车、出招按钮。每一式的目标拍不同；一次出招最多结算一次。
最高分和设置存储在 localStorage；清理网站数据会丢失记录，不同域名或浏览器之间不互通。
浏览器禁止自动播放时，先点击页面或“开启音乐”。

## 后续修改位置

- config.js：难度、每拍时长、判定窗口、招数、招式名与动作素材。
- story.js：剧情顺序、台词、配音、场景图片和配乐。
- practice.js：计分、节拍、暂停与结算。
- game.js：剧情事件、菜单、设置与音频管理。
- styles.css：全部外观和移动端布局。
- resources：图片、音乐、配音。

### 招式素材

config.js 的每招 sprite 可填透明 PNG 路径，voice 可填 MP3 路径。
招式开始时显示图片并播放语音；空值不请求资源。
当前没有骨骼动画或真实姿态识别，评分依据操作时机，不是实际动作是否标准。
新增动作可添加到 moves，关卡会按数组顺序循环至指定招数。

### 剧情配置

普通台词使用 { speaker: '嘉豪', text: '...', voice: null }。
场景切换使用 { event: 'scene', scene: 'yard' }。
练习入口使用 { event: 'practice' }，嘉豪入场使用 { event: 'jiahaoEntrance' }。
scenes 内 image 为背景相对路径，music 为配乐路径；null 使用现有配乐或校园背景。
动作资料与原创编排边界见“动作参考.md”，生成场景的提示词在 resources/scene/sight/generation-prompts.md。

## 当前原型范围

三个难度均可玩，通过速度、判定窗口和长度区分难度。八式原创编排会改变目标拍。
玩家可选择守势、刚势或游势；三者分别偏向容错、单次得分和意气积累。
精准与连击会解锁五项本地成就；意气蓄满后，随后四招获得爆发加分。
美术仍混用已有角色与生成场景；新增台词多数未配音。动作贴图仍待补充。
没有在线排行榜、账号、联网对战或官方授权标识。

## 验证

node --check config.js
node --check story.js
node --check game.js
node --check practice.js

tests/browser.cjs 是浏览器流程回归脚本，需要 Playwright。
可通过 PLAYWRIGHT_MODULE 指向已安装模块，BROWSER_EXE 指向本机 Chromium/Chrome。
