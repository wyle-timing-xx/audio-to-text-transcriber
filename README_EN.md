# 🎙️ Audio to Text Transcriber

A real-time audio capture and transcription system using Node.js + FFmpeg + Deepgram + BlackHole for seamless speech-to-text conversion with AI conversation capabilities.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

English | [中文](./README.md)

## ✨ Features

- 🔴 **Real-time Transcription**: Capture and convert audio with near-zero latency
- 🎯 **High Accuracy Recognition**: Powered by Deepgram Nova-2 AI models
- 🌏 **Multi-language Support**: Works with Chinese, English, and many other languages
- 💬 **AI Conversation**: Send transcribed text to AI (OpenAI/Claude/Deepseek) for instant responses
- 💾 **Automatic Saving**: Transcripts and AI conversations saved to files in real-time
- 📊 **Timestamps**: Each transcription includes precise timestamps
- 🎛️ **Flexible Configuration**: Easy customization through environment variables

## 📋 Prerequisites

### 1. System Requirements
- macOS (required for BlackHole audio driver)
- Node.js 18.0.0 or higher

### 2. Install FFmpeg
```bash
brew install ffmpeg
```

### 3. Install BlackHole Audio Driver

BlackHole is a macOS virtual audio driver that allows applications to pass audio to other applications.

```bash
brew install blackhole-2ch
```

After installation, set your output device to BlackHole 2ch in **System Preferences > Sound**.

> 💡 **Tip**: If you want to hear the audio while transcribing, create a **Multi-Output Device**:
> 1. Open **Audio MIDI Setup** (`/Applications/Utilities/Audio MIDI Setup.app`)
> 2. Click the `+` button in the bottom left
> 3. Select **Create Multi-Output Device**
> 4. Check both your speakers and BlackHole 2ch
> 5. Set your system audio output to this multi-output device

### 4. Obtain Required API Keys

#### Deepgram API Key (Required)
1. Visit the [Deepgram Console](https://console.deepgram.com/)
2. Register an account (new registrations get $200 free credit)
3. Create a new API Key

#### AI Provider API Keys (Optional, for AI conversation feature)
Based on your chosen AI provider, obtain the corresponding API Key:
- [OpenAI API Key](https://platform.openai.com/account/api-keys)
- [Anthropic Claude API Key](https://console.anthropic.com/)
- [Deepseek API Key](https://platform.deepseek.ai/)

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/wyle-timing-xx/audio-to-text-transcriber.git
cd audio-to-text-transcriber
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
```bash
cp .env.example .env
```

Edit the `.env` file, adding your API Keys:
```env
# Required
DEEPGRAM_API_KEY=your_deepgram_api_key_here
AUDIO_DEVICE=BlackHole 2ch:1
LANGUAGE=en

# AI Conversation Feature (Optional)
AI_PROVIDER=openai           # Choose: openai | claude | deepseek
OPENAI_API_KEY=your_openai_key
```

### 4. Test Audio Device
```bash
npm test
```

This will list all available audio devices and record a 5-second test audio sample.

### 5. Start the Transcription Service
```bash
npm start
```

Now play any audio (music, videos, podcasts, etc.), and the transcription will appear in real-time in the console and be saved to `transcripts/output.txt`.

Press `Ctrl+C` to stop the service.

## 🤖 AI Conversation Feature

This project supports automatically sending transcribed speech to an AI for conversation. It supports three major AI providers:

- OpenAI (GPT-4o)
- Anthropic (Claude)
- Deepseek

### How It Works

1. The system captures and transcribes your speech
2. When silence is detected (default 1.5 seconds of no speech), your question is considered complete
3. The complete question is sent to the AI for processing
4. The AI's answer is displayed in real-time in the console and saved to a file

### Configuring AI Conversation

Set the following parameters in the `.env` file:

```env
# Choose AI Provider
AI_PROVIDER=openai           # openai | claude | deepseek

# Corresponding Provider API Keys
OPENAI_API_KEY=your_openai_key
CLAUDE_API_KEY=your_claude_key
DEEPSEEK_API_KEY=your_deepseek_key
DEEPSEEK_ENDPOINT=https://api.deepseek.your/qa

# Silence Detection Time (milliseconds) - Determines when a question is complete
SILENCE_TIMEOUT_MS=1500

# AI System Prompt
AI_SYSTEM_PROMPT="You are an intelligent assistant. Please answer questions concisely and accurately."

# Enable Incremental Updates (Send partial transcriptions to AI in real-time)
PARTIAL_SEND=true

# AI Conversation Output File
QA_OUTPUT_FILE=transcripts/qa_output.txt
```

## ⚙️ Complete Configuration Options

All configurations are managed through the `.env` file:

```env
# Deepgram API Key (Required)
DEEPGRAM_API_KEY=your_api_key_here

# Audio Device
# Default: BlackHole 2ch:1
# Run npm test to see available devices
AUDIO_DEVICE=BlackHole 2ch:1

# Language Setting
# zh: Chinese
# en: English
# See Deepgram docs for more supported languages
LANGUAGE=en

# AI Model
# nova-2: Latest and most accurate model (recommended)
# nova: Balance of accuracy and speed
# base: Faster but less accurate
MODEL=nova-2

# Smart Formatting
# Automatically adds paragraphs, punctuation, etc.
SMART_FORMAT=true

# Punctuation
# Automatically adds punctuation marks
PUNCTUATE=true

# Output File Paths
OUTPUT_FILE=transcripts/output.txt
QA_OUTPUT_FILE=transcripts/qa_output.txt

# Save to File
SAVE_TO_FILE=true

# Display in Console
LOG_TO_CONSOLE=true

# AI Configuration
AI_PROVIDER=openai           # openai | claude | deepseek
OPENAI_API_KEY=your_openai_key
CLAUDE_API_KEY=your_claude_key
DEEPSEEK_API_KEY=your_deepseek_key
DEEPSEEK_ENDPOINT=https://api.deepseek.your/qa

AI_SYSTEM_PROMPT="You are an intelligent assistant. Please answer questions concisely and accurately."
SILENCE_TIMEOUT_MS=1500
PARTIAL_SEND=true
```

## 📁 Project Structure

```
audio-to-text-transcriber/
├── src/
│   ├── index.js           # Main application (transcription + AI conversation)
│   └── test-audio.js      # Audio device testing tool
├── transcripts/           # Transcription output directory (auto-created)
├── .env.example          # Environment variables template
├── .gitignore            # Git ignore file
├── package.json          # Project dependencies
└── README.md             # Project documentation
```

## 🔧 How It Works

### Voice Transcription Flow

1. **🎵 Audio Source** → System audio outputs to BlackHole virtual device
2. **🎤 FFmpeg** → Captures audio stream from BlackHole, converts to PCM format
3. **📡 WebSocket** → Streams audio in real-time to Deepgram API
4. **🤖 Deepgram AI** → Processes audio and returns text in real-time
5. **💾 Storage** → Transcription results displayed in console and saved to file

### AI Conversation Flow

1. **🎙️ Voice Input** → User's speech is transcribed to text
2. **⏱️ Silence Detection** → Detects when user has paused (default 1.5 seconds) to determine question completion
3. **🧠 AI Processing** → Sends the question to selected AI provider (OpenAI/Claude/Deepseek)
4. **💬 Streaming Response** → AI answers stream in real-time to the console
5. **📝 Record Saving** → Q&A conversation saved to file (default `transcripts/qa_output.txt`)

### Tech Stack

- **Node.js**: JavaScript runtime
- **FFmpeg**: Audio capture and format conversion
- **BlackHole**: macOS virtual audio device
- **Deepgram SDK**: Real-time speech recognition API
- **WebSocket**: Low-latency bidirectional communication
- **OpenAI/Claude/Deepseek APIs**: AI conversation capabilities

## 🎯 Use Cases

- 📹 **Meeting Transcription**: Real-time transcription of Zoom, Teams, and other meetings
- 🎵 **Music Lyrics**: Extract lyrics from songs
- 🎙️ **Podcast Transcription**: Convert podcast content to text
- 📺 **Video Subtitles**: Generate real-time subtitles for videos
- 📚 **Study Notes**: Record spoken content from online courses
- 💬 **AI Voice Assistant**: Interact with AI through natural speech
- 🗣️ **Translation Assistant**: Transcribe and understand foreign language audio

## 🐛 Troubleshooting

### Problem: Audio Device Not Found

**Solution**:
1. Run `npm test` to see the list of available devices
2. Confirm BlackHole is installed correctly
3. Update `AUDIO_DEVICE` in `.env` to the correct device name

### Problem: FFmpeg Errors

**Solution**:
```bash
# Reinstall FFmpeg
brew reinstall ffmpeg

# Verify installation
ffmpeg -version
```

### Problem: Cannot Transcribe

**Solution**:
1. Check if your Deepgram API Key is correct
2. Confirm your network connection is working
3. Ensure system audio is set to BlackHole or a multi-output device that includes BlackHole

### Problem: Inaccurate Transcription

**Solution**:
1. Try changing the model: Set `MODEL=nova-2` in `.env`
2. Confirm language setting is correct: `LANGUAGE=en` or `LANGUAGE=zh`
3. Enable smart formatting: `SMART_FORMAT=true`

### Problem: AI Not Responding or Slow Responses

**Solution**:
1. Check if the corresponding API Key is correct
2. Increase the `SILENCE_TIMEOUT_MS` value (e.g., set to 2000) to give the system more time to determine if your question is complete
3. Check network connection and firewall settings
4. Try switching to a different AI provider

## 📊 Performance Optimization

- **Sample Rate**: Default 16kHz, can increase to 48kHz for better quality
- **Channels**: Default mono, stereo will increase data volume
- **Model Selection**:
  - `nova-2`: Highest accuracy (recommended)
  - `nova`: Balanced performance
  - `base`: Fastest speed
- **Silence Detection**: Adjust `SILENCE_TIMEOUT_MS` value (1000-2500ms) to optimize Q&A experience
- **Partial Updates**: Set `PARTIAL_SEND=false` to reduce network requests

## 🔒 Security Tips

- 🚫 **Never** commit your `.env` file to Git
- 🔑 **Protect** your API Keys
- 📝 Use `.env.example` as a template for configuration
- 🔐 If an API Key is leaked, immediately revoke it on the corresponding platform

## Future Improvements

1. **TypeScript Refactoring**: Add type safety and code maintainability
2. **Official SDK Integration**: Replace custom HTTP requests with official SDKs (like `openai`, `@anthropic/sdk`)
3. **More Accurate VAD**: Integrate real Voice Activity Detection
4. **Session Management**: Persist conversation history for context understanding
5. **Log Rotation**: Automatically archive logs by date to avoid large files
6. **Web Interface**: Add a simple Web UI for easier use and configuration
7. **Multi-platform Support**: Extend support to Windows and Linux

## 📄 License

MIT License - See [LICENSE](LICENSE) for details

## 🤝 Contributing

Issues and Pull Requests are welcome!

## 📞 Support & Documentation

- 📖 [Deepgram Documentation](https://developers.deepgram.com/)
- 🎙️ [BlackHole GitHub](https://github.com/ExistentialAudio/BlackHole)
- 🎬 [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- 🤖 [OpenAI API Documentation](https://platform.openai.com/docs/)
- 🧠 [Claude API Documentation](https://docs.anthropic.com/claude/reference/)

## ⭐ Star History

If this project helps you, please give it a star ⭐️

---

**Made with ❤️ using Node.js, FFmpeg, Deepgram, and BlackHole**