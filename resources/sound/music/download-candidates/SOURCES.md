# Downloaded music candidates

All tracks below are marked CC0 on their OpenGameArt source pages. Attribution is not required by CC0, but source information is retained for provenance. Files are unmodified downloads.

| Local file | Suggested use | Author | Source / license |
|---|---|---|---|
| `schoolday.mp3` | Gate, schoolyard, forms intro, after-school dialogue | KiluaBoy | [School day / Rain / Sun / Loop](https://opengameart.org/content/school-day-rain-sun-loop) · CC0 |
| `happy-clappy.mp3` | Windblown class-list minigame | OwlishMedia | [Happy Clappy Loop](https://opengameart.org/content/happy-clappy-loop) · CC0 |
| `cinematic-percussion.mp3` | Eight-form practice and relay rhythm challenge | Marwan Antonios | [Cinematic percussion loop](https://opengameart.org/content/cinematic-percussion-loop) · CC0 |
| `suspense.mp3` | Sparring-read minigame | wipics | [Suspense](https://opengameart.org/content/suspense-0) · CC0 |
| `forget-me-not-loop.mp3` | Warm, nostalgic ending | Kistol | [Forget Me Not](https://opengameart.org/content/forget-me-not) · CC0 |

The selected tracks are wired into the game; the existing `menu.mp3` and `peace.mp3` are preserved. These files were downloaded from the original OpenGameArt file links on 2026-09-18. Keep this note and the source pages with the project.

## 2026-09-19 体积优化

- 原始下载是未压缩的 `.wav` 与 `.ogg`（Vorbis 不被 Safari/iOS 支持）。现全部转为 44.1 kHz MP3：音乐 128 kbps，紧张场景 96 kbps。
- 转换命令：`ffmpeg -i <输入> -c:a libmp3lame -b:a 128k -ar 44100 <输出>.mp3`。
- 这五首从 13.3 MiB（未压缩 wav 7.9 MiB + ogg 5.4 MiB）降到 3.9 MiB，并让 Safari/iOS 也能播放场景配乐。
- 原始文件保留在仓库外（不提交、不发布）的 `_source/resources/sound/music/download-candidates/`，需要重新编码时用它们。
