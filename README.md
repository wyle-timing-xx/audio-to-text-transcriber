# 🎙️ Audio to Text Transcriber

实时音频捕获和转录系统，使用 Node.js + FFmpeg + Deepgram + BlackHole 实现边采集边转换的语音识别，并支持与 AI 实时对话。

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

## ✨ 特性

- 🔴 **实时转录**：边采集边转换，无延迟处理
- 🎯 **高精度识别**：基于 Deepgram Nova-2 AI 模型
- 🌏 **多语言支持**：支持中文、英文等多种语言
- 💬 **AI 对话**：将转录文本发送给 AI（支持 OpenAI/Claude/Deepseek）获取实时回答
- 🌊 **全流式响应**：所有 AI 提供商（包括 Deepseek）均支持流式回答
- ⚡ **即时中断**：在 AI 回答过程中，检测到新音频输入立即中断当前回答
- 💾 **自动保存**：转录结果和 AI 对话实时保存到文件
- 📊 **时间戳**：每条转录都带有精确时间戳
- 🎛️ **灵活配置**：通过环境变量轻松自定义
- 🧩 **模块化架构**：代码重构为模块化设计，便于维护和扩展

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

### 🌊 统一流式处理

最新版本实现了所有 AI 提供商的统一流式处理：

- **OpenAI**: 使用官方流式 API 接收实时 token
- **Claude**: 使用新版 Messages API 进行流式响应
- **Deepseek**: 使用 OpenAI SDK 与流式接口，通过兼容 API 实现流式响应

所有提供商现在使用统一的 `streamCompletion` 架构，提供一致的用户体验。

### ⚡ 增强中断功能

最新版本实现了即时中断功能，大幅提升对话自然度：

- **即时中断**: 检测到任何音频输入立即中断 AI 回答，无需延迟等待
- **视觉反馈**: 中断时提供明显的视觉提示，使用可配置的标记（默认 🔴）
- **冷却机制**: 防止过于频繁的中断，提供更流畅的体验
- **高度可配置**: 灵活调整中断敏感度、视觉反馈、冷却时间等

#### 中断工作流程

1. **音频检测**：系统持续监听新的音频输入
2. **即时响应**：检测到声音立即中断 AI 的回答（如果已启用即时中断）
3. **视觉标记**：显示明显的视觉提示，标记出中断时的用户输入
4. **优雅转换**：中断的回答会被标记，系统会无缝处理新的输入

这种增强的中断机制使对话更加自然流畅，类似于人类之间的对话方式。

### 配置 AI 对话

在 `.env` 文件中设置以下参数：

```env
# 选择 AI 提供商
AI_PROVIDER=openai           # openai | claude | deepseek

# 对应提供商的 API Key
OPENAI_API_KEY=your_openai_key
CLAUDE_API_KEY=your_claude_key
DEEPSEEK_API_KEY=your_deepseek_key
DEEPSEEK_ENDPOINT=https://api.deepseek.com

# AI 模型配置
OPENAI_MODEL=gpt-4o-mini
CLAUDE_MODEL=claude-3-opus-20240229
DEEPSEEK_MODEL=deepseek-chat

# 静默检测时间（毫秒）- 判断用户是否已提问完毕
SILENCE_TIMEOUT_MS=1500

# AI 系统提示词
AI_SYSTEM_PROMPT="你是智能问答助手，请简洁、准确地回答用户问题。"

# 启用增量上报（实时将部分转录发送给 AI）
PARTIAL_SEND=true

# 中断功能配置
ALLOW_INTERRUPTION=true              # 是否允许中断 AI 回答
IMMEDIATE_INTERRUPT=true             # 是否立即中断（无需等待）
INTERRUPTION_DETECTION_MS=300        # 传统中断检测时间（毫秒）
INTERRUPTION_COOLDOWN_MS=500         # 中断冷却时间（毫秒）
INTERRUPT_VISUAL_FEEDBACK=true       # 是否启用中断视觉反馈
INTERRUPT_PREFIX=🔴                   # 中断时的前缀标记
INTERRUPT_SUFFIX=🔴                   # 中断时的后缀标记

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

# Deepgram 模型和设置
MODEL=nova-2
SMART_FORMAT=true
PUNCTUATE=true
INTERIM_RESULTS=true           # 启用中间结果以更快地检测音频
VAD_TURNOFF=500                # 语音活动检测超时（毫秒）

# 音频活动检测配置
AUDIO_ACTIVITY_DETECTION=true   # 是否启用音频活动检测
SILENCE_THRESHOLD_MS=500        # 超过该时间没有输入视为静默（毫秒）
ACTIVITY_CHECK_INTERVAL_MS=200  # 音频活动检测间隔（毫秒）

# 输出文件路径
OUTPUT_FILE=transcripts/output.txt
QA_OUTPUT_FILE=transcripts/qa_output.txt

# 输出配置
SAVE_TO_FILE=true
LOG_TO_CONSOLE=true
HIGHLIGHT_INTERRUPTIONS=true   # 高亮显示中断时的文本

# AI 配置
AI_PROVIDER=openai              # openai | claude | deepseek
OPENAI_API_KEY=your_openai_key
CLAUDE_API_KEY=your_claude_key
DEEPSEEK_API_KEY=your_deepseek_key
DEEPSEEK_ENDPOINT=https://api.deepseek.com

# AI 模型配置
OPENAI_MODEL=gpt-4o-mini
CLAUDE_MODEL=claude-3-opus-20240229
DEEPSEEK_MODEL=deepseek-chat

# AI 行为配置
AI_SYSTEM_PROMPT="你是智能问答助手，请简洁、准确地回答用户问题。如果用户有后续问题，请在结尾提示用户可以继续追问。请注意：用户可能会随时通过说话来中断你的回答，这时候请立即停止并开始处理新的输入。"
SILENCE_TIMEOUT_MS=1500
PARTIAL_SEND=true

# 中断功能配置
ALLOW_INTERRUPTION=true              # 是否允许中断 AI 回答
IMMEDIATE_INTERRUPT=true             # 是否立即中断（无需等待）
INTERRUPTION_DETECTION_MS=300        # 传统中断检测时间（毫秒）
INTERRUPTION_COOLDOWN_MS=500         # 中断冷却时间（毫秒）

# 中断视觉反馈配置
INTERRUPT_VISUAL_FEEDBACK=true       # 是否启用中断视觉反馈
INTERRUPT_USE_COLORS=true            # 使用彩色标记突出显示中断
INTERRUPT_PREFIX=🔴                   # 中断时的前缀标记
INTERRUPT_SUFFIX=🔴                   # 中断时的后缀标记
```

## 📁 项目结构

本项目采用模块化架构，使代码更易于维护和扩展。

```
audio-to-text-transcriber/
├── src/                    # 源代码目录
│   ├── index.js            # 主入口文件
│   ├── config/             # 配置模块
│   │   ├── index.js        # 配置加载和验证
│   │   └── defaults.js     # 默认配置值
│   ├── ai/                 # AI 模块
│   │   ├── index.js        # AI 模块导出
│   │   ├── ai-manager.js   # AI 对话管理
│   │   ├── interruption.js # 中断控制器
│   │   └── providers/      # AI 提供商实现
│   │       ├── index.js        # 提供商工厂
│   │       ├── base-provider.js # AI 提供商基类
│   │       ├── openai.js        # OpenAI 实现
│   │       ├── claude.js        # Claude 实现
│   │       └── deepseek.js      # Deepseek 实现
│   ├── utils/              # 工具模块
│   │   ├── index.js        # 工具函数导出
│   │   └── stream-utils.js # 流处理工具
│   └── transcription/      # 转录模块
│       ├── index.js        # 转录模块导出
│       └── audio-transcriber.js # 音频转录器
├── transcripts/            # 转录输出目录（自动创建）
├── .env.example            # 环境变量模板
├── .gitignore              # Git 忽略文件
├── package.json            # 项目依赖
└── README.md               # 项目文档
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
4. **💬 流式回答** → AI 回答实时流式显示在控制台（所有提供商均支持）
5. **⚡ 中断检测** → 持续监听新的音频输入，检测到语音立即中断 AI 回答
6. **📝 记录保存** → 问答对话保存到文件（默认 `transcripts/qa_output.txt`）

### 中断机制详解

中断机制使用户能够在 AI 回答过程中随时插入新问题，类似于真实人类对话中的交互方式：

1. **音频活动监测**: 
   - 使用 Deepgram 的实时转录功能和 `interimResults` 选项实现快速音频检测
   - 系统持续监控音频输入，即使 AI 正在回答

2. **即时中断策略**:
   - `IMMEDIATE_INTERRUPT=true`: 检测到任何音频输入立即中断当前 AI 回答
   - `IMMEDIATE_INTERRUPT=false`: 使用传统延迟中断机制，等待确认后中断

3. **冷却机制**:
   - 防止意外或过于频繁的中断，可配置 `INTERRUPTION_COOLDOWN_MS`
   - 在一次中断后的冷却期内，系统会忽略新的中断请求

4. **可视化反馈**:
   - 中断时的输入会使用特殊标记突出显示（默认 🔴）
   - 控制台显示状态信息，指示中断发生

这种增强的中断机制大幅提升了对话的自然流畅度，用户可以像与真人交流一样随时插入问题或纠正，无需等待 AI 完成整个回答。

### 技术栈

- **Node.js**：JavaScript 运行时
- **FFmpeg**：音频捕获和格式转换
- **BlackHole**：macOS 虚拟音频设备
- **Deepgram SDK**：实时语音识别 API
- **WebSocket**：低延迟双向通信
- **OpenAI SDK**：用于 OpenAI 和 Deepseek（通过兼容 API）调用
- **Fetch API**：用于 Claude API 调用
- **AbortController**：用于中断 AI 回答流

## 🎯 使用场景

- 📹 **会议转录**：实时转录 Zoom、Teams 等会议
- 🎵 **音乐歌词**：提取歌曲中的歌词
- 🎙️ **播客转录**：将播客内容转换为文字
- 📺 **视频字幕**：为视频生成实时字幕
- 📚 **学习笔记**：记录在线课程的语音内容
- 💬 **AI 语音助手**：通过语音与 AI 进行自然对话，可以随时打断 AI
- 🗣️ **翻译助手**：将外语音频实时转录并理解
- 🎓 **教育辅助**：学生可以在 AI 解释概念时随时提问或请求澄清
- 👥 **多人对话**：模拟真实对话中的即时反馈和打断机制

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
5. 确认 AI 提供商的 API 端点是否正确（特别是 Deepseek）

### 问题：中断功能不工作

**解决方案**：
1. 确认 `.env` 中 `ALLOW_INTERRUPTION=true` 设置正确
2. 如果要使用即时中断，确认 `IMMEDIATE_INTERRUPT=true`
3. 检查 `AUDIO_ACTIVITY_DETECTION=true` 和相关音频检测设置
4. 调整 `INTERRUPTION_DETECTION_MS` 和 `SILENCE_THRESHOLD_MS` 值以获得更灵敏的中断体验
5. 确保麦克风工作正常，能够捕获你的语音
6. 检查 Deepgram 的 `interimResults` 选项是否启用，以获得更快的音频检测

### 问题：中断太过灵敏或不够灵敏

**解决方案**：
1. **过于灵敏**：
   - 增加 `INTERRUPTION_COOLDOWN_MS` 值（例如 1000ms）
   - 设置 `IMMEDIATE_INTERRUPT=false` 使用传统延迟中断
   - 增加 `SILENCE_THRESHOLD_MS` 值

2. **不够灵敏**：
   - 设置 `IMMEDIATE_INTERRUPT=true` 启用即时中断
   - 减少 `INTERRUPTION_DETECTION_MS` 值（例如 100ms）
   - 减少 `SILENCE_THRESHOLD_MS` 值
   - 增加 `ACTIVITY_CHECK_INTERVAL_MS` 频率（例如 100ms）

## 📊 性能优化

- **采样率**：默认 16kHz，可以提高到 48kHz 以获得更好质量
- **声道**：默认单声道，双声道会增加数据量
- **模型选择**：
  - `nova-2`：最高准确度（推荐）
  - `nova`：平衡性能
  - `base`：最快速度
- **静默检测**：调整 `SILENCE_TIMEOUT_MS` 值（1000-2500ms）以优化问答体验
- **中断敏感度**：
  - `IMMEDIATE_INTERRUPT=true` 提供最快的响应
  - 调整 `INTERRUPTION_DETECTION_MS` 值（100-500ms）以获得更灵敏或更稳定的中断体验
  - 设置适当的 `INTERRUPTION_COOLDOWN_MS` 值（300-1000ms）防止误触发
- **部分上报**：设置 `PARTIAL_SEND=false` 可减少网络请求量
- **AI 模型选择**：
  - 通过 `OPENAI_MODEL`、`CLAUDE_MODEL` 和 `DEEPSEEK_MODEL` 环境变量调整模型

## 🔒 安全提示

- 🚫 **永远不要**将 `.env` 文件提交到 Git
- 🔑 **保护好**你的 API Key
- 📝 使用 `.env.example` 作为配置模板
- 🔐 如果 API Key 泄露，立即在对应平台上撤销

## 后续改进方向

1. **TypeScript 重构**：增加类型安全和代码可维护性
2. **官方 SDK 集成**：替换自定义 HTTP 请求，使用官方 SDK（如 `@anthropic/sdk`）
3. **更精确的 VAD**：集成真实的语音活动检测（Voice Activity Detection）
4. **会话管理**：持久化对话历史，支持上下文理解
5. **日志轮转**：自动按日期归档日志，避免文件过大
6. **Web 界面**：添加简单的 Web UI，便于使用和配置
7. **多平台支持**：扩展对 Windows 和 Linux 的支持
8. **语音合成**：集成 TTS 将 AI 回答转换为语音输出
9. **中断动作定制**：允许自定义中断后的行为（如重新提问、继续上一回答等）
10. **情绪分析**：根据语音特征调整 AI 响应风格

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
- 🔍 [Deepseek API 文档](https://platform.deepseek.ai/docs)

## ⭐ Star History

如果这个项目对你有帮助，请给个 Star ⭐️

---

**Made with ❤️ using Node.js, FFmpeg, Deepgram, and BlackHole**