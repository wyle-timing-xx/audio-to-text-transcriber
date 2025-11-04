# 🎙️ Audio to Text Transcriber

实时音频捕获和转录系统，使用 Node.js + FFmpeg + Deepgram + BlackHole 实现边采集边转换的语音识别，并支持与 AI 实时对话。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

[English](./README_EN.md) | 中文

## ✨ 特性

- 🔴 **实时转录**：边采集边转换，无延迟处理
- 🎯 **高精度识别**：基于 Deepgram Nova-2 AI 模型
- 🌏 **多语言支持**：支持中文、英文等多种语言
- 💬 **AI 对话**：将转录文本发送给 AI（支持 OpenAI/Claude/Deepseek）获取实时回答
- 💾 **自动保存**：转录结果和 AI 对话实时保存到文件
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

### 4. 获取必要的 API Key

#### Deepgram API Key (必需)
1. 访问 [Deepgram Console](https://console.deepgram.com/)
2. 注册账号（首次注册赠送 $200 额度）
3. 创建一个新的 API Key

#### AI 提供商 API Key (可选，用于 AI 对话功能)
根据你选择的 AI 提供商，获取相应的 API Key：
- [OpenAI API Key](https://platform.openai.com/account/api-keys)
- [Anthropic Claude API Key](https://console.anthropic.com/)
- [Deepseek API Key](https://platform.deepseek.ai/)

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

编辑 `.env` 文件，添加你的 API Key：
```env
# 必填项
DEEPGRAM_API_KEY=your_deepgram_api_key_here
AUDIO_DEVICE=BlackHole 2ch:1
LANGUAGE=zh

# AI 对话功能（可选）
AI_PROVIDER=openai           # 选择: openai | claude | deepseek
OPENAI_API_KEY=your_openai_key
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

## 🤖 AI 对话功能

本项目支持将实时转录的语音转为文字后，自动发送给 AI 进行问答。支持三种主流 AI 提供商：

- OpenAI (GPT-4o)
- Anthropic (Claude)
- Deepseek

### 工作原理

1. 系统捕获并转录你的语音
2. 当检测到静默（默认 1.5 秒无语音）时，认为你的问题已完成
3. 将完整问题发送给 AI 处理
4. AI 的回答会实时流式显示在控制台并保存到文件

### 配置 AI 对话

在 `.env` 文件中设置以下参数：

```env
# 选择 AI 提供商
AI_PROVIDER=openai           # openai | claude | deepseek

# 对应提供商的 API Key
OPENAI_API_KEY=your_openai_key
CLAUDE_API_KEY=your_claude_key
DEEPSEEK_API_KEY=your_deepseek_key
DEEPSEEK_ENDPOINT=https://api.deepseek.your/qa

# 静默检测时间（毫秒）- 判断用户是否已提问完毕
SILENCE_TIMEOUT_MS=1500

# AI 系统提示词
AI_SYSTEM_PROMPT="你是智能问答助理，请简洁、准确地回答用户问题。"

# 启用增量上报（实时将部分转录发送给 AI）
PARTIAL_SEND=true

# AI 对话输出文件
QA_OUTPUT_FILE=transcripts/qa_output.txt
```

## ⚙️ 完整配置选项

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
QA_OUTPUT_FILE=transcripts/qa_output.txt

# 是否保存到文件
SAVE_TO_FILE=true

# 是否在控制台显示
LOG_TO_CONSOLE=true

# AI 配置
AI_PROVIDER=openai           # openai | claude | deepseek
OPENAI_API_KEY=your_openai_key
CLAUDE_API_KEY=your_claude_key
DEEPSEEK_API_KEY=your_deepseek_key
DEEPSEEK_ENDPOINT=https://api.deepseek.your/qa

AI_SYSTEM_PROMPT="你是智能问答助理，请简洁、准确地回答用户问题。"
SILENCE_TIMEOUT_MS=1500
PARTIAL_SEND=true
```

## 📁 项目结构

```
audio-to-text-transcriber/
├── src/
│   ├── index.js           # 主应用程序（转录+AI对话）
│   └── test-audio.js      # 音频设备测试工具
├── transcripts/           # 转录输出目录（自动创建）
├── .env.example          # 环境变量模板
├── .gitignore            # Git 忽略文件
├── package.json          # 项目依赖
└── README.md             # 项目文档
```

## 🔧 工作原理

### 语音转录流程

1. **🎵 音频源** → 系统音频输出到 BlackHole 虚拟设备
2. **🎤 FFmpeg** → 从 BlackHole 捕获音频流，转换为 PCM 格式
3. **📡 WebSocket** → 将音频流实时传输到 Deepgram API
4. **🤖 Deepgram AI** → 实时处理音频并返回文字
5. **💾 存储** → 转录结果显示在控制台并保存到文件

### AI 对话流程

1. **🎙️ 语音输入** → 用户说话被转录为文字
2. **⏱️ 静默检测** → 检测到用户停顿（默认 1.5 秒）判定为问题结束
3. **🧠 AI 处理** → 将问题发送给选定的 AI 提供商（OpenAI/Claude/Deepseek）
4. **💬 流式回答** → AI 回答实时流式显示在控制台
5. **📝 记录保存** → 问答对话保存到文件（默认 `transcripts/qa_output.txt`）

### 技术栈

- **Node.js**：JavaScript 运行时
- **FFmpeg**：音频捕获和格式转换
- **BlackHole**：macOS 虚拟音频设备
- **Deepgram SDK**：实时语音识别 API
- **WebSocket**：低延迟双向通信
- **OpenAI/Claude/Deepseek API**：AI 对话能力

## 🎯 使用场景

- 📹 **会议转录**：实时转录 Zoom、Teams 等会议
- 🎵 **音乐歌词**：提取歌曲中的歌词
- 🎙️ **播客转录**：将播客内容转换为文字
- 📺 **视频字幕**：为视频生成实时字幕
- 📚 **学习笔记**：记录在线课程的语音内容
- 💬 **AI 语音助手**：通过语音与 AI 进行自然对话
- 🗣️ **翻译助手**：将外语音频实时转录并理解

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

### 问题：AI 不回答或响应缓慢

**解决方案**：
1. 检查相应的 API Key 是否正确
2. 增加 `SILENCE_TIMEOUT_MS` 值（例如设为 2000）让系统有更多时间判断你的问题是否结束
3. 检查网络连接和防火墙设置
4. 切换到不同的 AI 提供商尝试

## 📊 性能优化

- **采样率**：默认 16kHz，可以提高到 48kHz 以获得更好质量
- **声道**：默认单声道，双声道会增加数据量
- **模型选择**：
  - `nova-2`：最高准确度（推荐）
  - `nova`：平衡性能
  - `base`：最快速度
- **静默检测**：调整 `SILENCE_TIMEOUT_MS` 值（1000-2500ms）以优化问答体验
- **部分上报**：设置 `PARTIAL_SEND=false` 可减少网络请求量

## 🔒 安全提示

- 🚫 **永远不要**将 `.env` 文件提交到 Git
- 🔑 **保护好**你的 API Key
- 📝 使用 `.env.example` 作为配置模板
- 🔐 如果 API Key 泄露，立即在对应平台上撤销

## 后续改进方向

1. **TypeScript 重构**：增加类型安全和代码可维护性
2. **官方 SDK 集成**：替换自定义 HTTP 请求，使用官方 SDK（如 `openai`、`@anthropic/sdk`）
3. **更精确的 VAD**：集成真实的语音活动检测（Voice Activity Detection）
4. **会话管理**：持久化对话历史，支持上下文理解
5. **日志轮转**：自动按日期归档日志，避免文件过大
6. **Web 界面**：添加简单的 Web UI，便于使用和配置
7. **多平台支持**：扩展对 Windows 和 Linux 的支持

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 支持与文档

- 📖 [Deepgram 文档](https://developers.deepgram.com/)
- 🎙️ [BlackHole GitHub](https://github.com/ExistentialAudio/BlackHole)
- 🎬 [FFmpeg 文档](https://ffmpeg.org/documentation.html)
- 🤖 [OpenAI API 文档](https://platform.openai.com/docs/)
- 🧠 [Claude API 文档](https://docs.anthropic.com/claude/reference/)

## ⭐ Star History

如果这个项目对你有帮助，请给个 Star ⭐️

---

**Made with ❤️ using Node.js, FFmpeg, Deepgram, and BlackHole**
