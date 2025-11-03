# 🎙️ Audio to Text Transcriber

实时音频捕获和转录系统，使用 Node.js + FFmpeg + Deepgram + BlackHole 实现边采集边转换的语音识别。

## ✨ 特性

- 🔴 **实时转录**：边采集边转换，无延迟处理
- 🎯 **高精度识别**：基于 Deepgram Nova-2 AI 模型
- 🌏 **多语言支持**：支持中文、英文等多种语言
- 💾 **自动保存**：转录结果实时保存到文件
- 📊 **时间戳**：每条转录都带有精确时间戳
- 🎛️ **灵活配置**：通过环境变量轻松自定义

## 📋 前置要求

### 1. 系统要求
- macOS（用于 BlackHole 音频驱动）
- Node.js 18.0.0 或更高版本

### 2. 安装 FFmpeg
```bash
brew install ffmpeg
```

### 3. 安装 BlackHole 音频驱动

BlackHole 是一个 macOS 虚拟音频驱动，允许应用程序将音频传递给其他应用程序。

```bash
brew install blackhole-2ch
```

安装后，在 **系统偏好设置 > 声音** 中将输出设备设置为 BlackHole 2ch。

> 💡 **提示**：如果你想同时听到音频和进行转录，需要创建一个 **多输出设备**：
> 1. 打开 **音频 MIDI 设置**（`/Applications/Utilities/Audio MIDI Setup.app`）
> 2. 点击左下角的 `+` 按钮
> 3. 选择 **创建多输出设备**
> 4. 勾选你的扬声器和 BlackHole 2ch
> 5. 将系统音频输出设置为这个多输出设备

### 4. 获取 Deepgram API Key

1. 访问 [Deepgram Console](https://console.deepgram.com/)
2. 注册账号（首次注册赠送 $200 额度）
3. 创建一个新的 API Key

## 🚀 快速开始

### 1. 克隆仓库
```bash
git clone https://github.com/wyle-timing-xx/audio-to-text-transcriber.git
cd audio-to-text-transcriber
```

### 2. 安装依赖
```bash
npm install
```

### 3. 配置环境变量
```bash
cp .env.example .env
```

编辑 `.env` 文件，添加你的 Deepgram API Key：
```env
DEEPGRAM_API_KEY=your_deepgram_api_key_here
AUDIO_DEVICE=BlackHole 2ch:1
LANGUAGE=zh
```

### 4. 测试音频设备
```bash
npm test
```

这将列出所有可用的音频设备，并录制 5 秒测试音频。

### 5. 启动转录服务
```bash
npm start
```

现在播放任何音频（音乐、视频、播客等），转录结果将实时显示在控制台并保存到 `transcripts/output.txt`。

按 `Ctrl+C` 停止服务。

## ⚙️ 配置选项

所有配置通过 `.env` 文件管理：

```env
# Deepgram API 密钥（必需）
DEEPGRAM_API_KEY=your_api_key_here

# 音频设备
# 默认：BlackHole 2ch:1
# 运行 npm test 查看可用设备
AUDIO_DEVICE=BlackHole 2ch:1

# 语言设置
# zh: 中文
# en: 英文
# 支持更多语言，查看 Deepgram 文档
LANGUAGE=zh

# AI 模型
# nova-2: 最新最准确的模型（推荐）
# nova: 平衡准确性和速度
# base: 更快但准确性稍低
MODEL=nova-2

# 智能格式化
# 自动添加段落、标点等
SMART_FORMAT=true

# 标点符号
# 自动添加标点符号
PUNCTUATE=true

# 输出文件路径
OUTPUT_FILE=transcripts/output.txt

# 是否保存到文件
SAVE_TO_FILE=true

# 是否在控制台显示
LOG_TO_CONSOLE=true
```

## 📁 项目结构

```
audio-to-text-transcriber/
├── src/
│   ├── index.js           # 主应用程序
│   └── test-audio.js      # 音频设备测试工具
├── transcripts/           # 转录输出目录（自动创建）
├── .env.example          # 环境变量模板
├── .gitignore            # Git 忽略文件
├── package.json          # 项目依赖
└── README.md             # 项目文档
```

## 🔧 工作原理

这个项目就像一条**音频流水线**：

1. **🎵 音频源** → 系统音频输出到 BlackHole 虚拟设备
2. **🎤 FFmpeg** → 从 BlackHole 捕获音频流，转换为 PCM 格式
3. **📡 WebSocket** → 将音频流实时传输到 Deepgram API
4. **🤖 Deepgram AI** → 实时处理音频并返回文字
5. **💾 存储** → 转录结果显示在控制台并保存到文件

### 技术栈

- **Node.js**：JavaScript 运行时
- **FFmpeg**：音频捕获和格式转换
- **BlackHole**：macOS 虚拟音频设备
- **Deepgram SDK**：实时语音识别 API
- **WebSocket**：低延迟双向通信

## 🎯 使用场景

- 📹 **会议转录**：实时转录 Zoom、Teams 等会议
- 🎵 **音乐歌词**：提取歌曲中的歌词
- 🎙️ **播客转录**：将播客内容转换为文字
- 📺 **视频字幕**：为视频生成实时字幕
- 📚 **学习笔记**：记录在线课程的语音内容

## 🐛 故障排除

### 问题：找不到音频设备

**解决方案**：
1. 运行 `npm test` 查看可用设备列表
2. 确认 BlackHole 已正确安装
3. 在 `.env` 中更新 `AUDIO_DEVICE` 为正确的设备名

### 问题：FFmpeg 错误

**解决方案**：
```bash
# 重新安装 FFmpeg
brew reinstall ffmpeg

# 验证安装
ffmpeg -version
```

### 问题：无法转录

**解决方案**：
1. 检查 Deepgram API Key 是否正确
2. 确认网络连接正常
3. 确保系统音频输出设置为 BlackHole 或包含 BlackHole 的多输出设备

### 问题：转录不准确

**解决方案**：
1. 尝试更换模型：在 `.env` 中设置 `MODEL=nova-2`
2. 确认语言设置正确：`LANGUAGE=zh` 或 `LANGUAGE=en`
3. 启用智能格式化：`SMART_FORMAT=true`

## 📊 性能优化

- **采样率**：默认 16kHz，可以提高到 48kHz 以获得更好质量
- **声道**：默认单声道，双声道会增加数据量
- **模型选择**：
  - `nova-2`：最高准确度（推荐）
  - `nova`：平衡性能
  - `base`：最快速度

## 🔒 安全提示

- 🚫 **永远不要**将 `.env` 文件提交到 Git
- 🔑 **保护好**你的 Deepgram API Key
- 📝 使用 `.env.example` 作为配置模板
- 🔐 如果 API Key 泄露，立即在 Deepgram 控制台撤销

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 支持

- 📖 [Deepgram 文档](https://developers.deepgram.com/)
- 🎙️ [BlackHole GitHub](https://github.com/ExistentialAudio/BlackHole)
- 🎬 [FFmpeg 文档](https://ffmpeg.org/documentation.html)

## ⭐ Star History

如果这个项目对你有帮助，请给个 Star ⭐️

---

**Made with ❤️ using Node.js, FFmpeg, Deepgram, and BlackHole**

## 实时语音 -> AI 问答（流式）
新增功能：把实时转录文本流式/增量发送给 AI（支持 OpenAI / Claude / Deepseek），并将 AI 回答输出到控制台及文件（默认 `transcripts/qa_output.txt`）。

### 环境变量（重要）
请在 `.env` 中设置：
- `DEEPGRAM_API_KEY` (必需)
- `AI_PROVIDER` — `openai` | `claude` | `deepseek`（默认 `openai`）
- 对应 provider 的 key：
  - `OPENAI_API_KEY`
  - `CLAUDE_API_KEY`
  - `DEEPSEEK_API_KEY` & `DEEPSEEK_ENDPOINT`
- 其他选项：`SILENCE_TIMEOUT_MS`, `AI_SYSTEM_PROMPT`, `PARTIAL_SEND` 等。

### 运行
```bash
npm install
node src/index.js







说明（重要）

静默判定：我使用 silenceTimeoutMs（默认 1500ms）来判断“用户是否已问完”。这是在没有更复杂语音活动检测（VAD）时较稳定的做法：当转录输入在该时间内没有新的片段到达，就把当前缓冲内容视为一个完整问题并向 AI 发起回答请求。你可以在 .env 调整 SILENCE_TIMEOUT_MS 值（例如 1000 或 2000）来微调灵敏度。

流式 vs 增量：

代码实现了增量上报（partialSend）：每个转录片段都会被推到 AI 管理器做记录（目前大多数 provider 无明显“记录”接口，所以实现为 noop，以后可以在支持的 provider 中扩展）。

最终回答使用 provider 的stream（如果 provider 支持）或一次性调用（Deepseek 假设不支持流）。OpenAI 和 Claude 的流式解析做了基础实现（基于 SSE/text chunks）——但注意：各 provider 的流格式可能发生变化，需要你根据实际 provider SDK/文档调试（尤其 Anthropic/Claude 的 endpoint 与字段）。

AI 提示词（system prompt）：通过 AI_SYSTEM_PROMPT 环境变量可自定义（已设置默认 prompt，包含“需要判断是否问完问题”与回答风格要求）。

输出文件：

转录文本仍写入 OUTPUT_FILE（默认 transcripts/output.txt）。

AI 问答写入 QA_OUTPUT_FILE（默认 transcripts/qa_output.txt）。

两者都追加模式写入，方便保持历史记录。

Deepseek：我把 Deepseek 实现为“通用 HTTP one-shot”。请替换 DEEPSEEK_ENDPOINT 为你真实的 Deepseek API endpoint 并根据其请求/响应格式调整 _callDeepseek。









如何判断“用户说完了”？

使用静默检测：当一定时间（SILENCE_TIMEOUT_MS，默认 1500ms）内没有新转录片段到达，系统认为用户已完成一句话并把当前缓冲文本作为一个完整问题交给 AI 回答。

输出

转录文本：transcripts/output.txt

AI 问答：transcripts/qa_output.txt



## 注意与后续建议（你可能想做的改进）
1. 用 provider 官方 SDK（`openai` / `@anthropic/sdk`）替换手写 `fetch`，能更稳定地支持流式和错误处理。
2. 如果要更精确的“用户结束”判定，接入真实的 VAD（voice activity detection）或利用 Deepgram 的 `is_final` 标志（若 Deepgram live event 有该字段）。
3. 增强会话管理：把会话持久化为 JSON（方便后续分析 / 回溯）。
4. 把 AI key 与 endpoint 的错误处理更健壮，给出重试策略与限流。
5. 在生产环境中，把 QA 文件轮转（按日归档）以免文件过大。

---

如果你希望，我可以：
- 把上面代码转成 TypeScript（带类型与更严格的错误处理）。
- 用官方 SDK（OpenAI / Anthropic）把 streaming 做得更稳健（需要我把你想用的具体 model 与 SDK 告诉我，我会直接写出依赖与代码）。
- 帮你把 `DEEPSEEK_ENDPOINT` 的真实 API 格式接入（如果你贴出 Deepseek 的 API 文档示例，我会把 `_callDeepseek` 完善为流式或正确的请求/解析代码）。

现在我已把核心实现写好并给出 README & Git 操作建议；如果你要我继续把某一 provider 换成官方 SDK 或把部分逻辑改为真正的 SSE/WebSocket 双向流，请直接告诉我你要优先完善的 provider（OpenAI / Claude / Deepseek），我会马上把那一段改成更稳健的实现并给出 `package.json` 需要的精确依赖。
