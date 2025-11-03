// src/index.js
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { spawn } from 'child_process';
import { createWriteStream, mkdirSync, appendFileSync } from 'fs';
import { dirname } from 'path';
import dotenv from 'dotenv';
import fetch from 'node-fetch'; // npm i node-fetch@2 (or use global fetch in newer Node)
import { pipeline } from 'stream';
import { promisify } from 'util';

// 加载环境变量
dotenv.config();

// 配置项
const CONFIG = {
  deepgramApiKey: process.env.DEEPGRAM_API_KEY,
  audioDevice: process.env.AUDIO_DEVICE || ':1',
  language: process.env.LANGUAGE || 'zh',
  model: process.env.MODEL || 'nova-2',
  smartFormat: process.env.SMART_FORMAT === 'true',
  punctuate: process.env.PUNCTUATE === 'true',
  outputFile: process.env.OUTPUT_FILE || 'transcripts/output.txt',
  qaOutputFile: process.env.QA_OUTPUT_FILE || 'transcripts/qa_output.txt',
  saveToFile: process.env.SAVE_TO_FILE !== 'false',
  logToConsole: process.env.LOG_TO_CONSOLE !== 'false',
  // AI 配置
  aiProvider: (process.env.AI_PROVIDER || 'openai').toLowerCase(), // openai | claude | deepseek
  openaiApiKey: process.env.OPENAI_API_KEY,
  claudeApiKey: process.env.CLAUDE_API_KEY,
  deepseekApiKey: process.env.DEEPSEEK_API_KEY,
  // prompt / behavior
  aiSystemPrompt: process.env.AI_SYSTEM_PROMPT || `你是一个智能问答助手。当前对话为“语音问答”。要求：
1) 这是用户说出的语音转为文字后的内容，判定用户是否已经问完（可依据停顿/标点），如果未问完请等待更多输入；如果已问完请直接以回答者角色给出回答。
2) 回答要简洁、准确，必要时给出步骤/提示。
3) 如果用户有后续问题，请在结尾提示用户可以继续追问。
`,
  // 静默检测（毫秒） — 在无新转录片段的情况下判定用户已结束一句话
  silenceTimeoutMs: parseInt(process.env.SILENCE_TIMEOUT_MS || '1500', 10),
  // 部分上报策略：每当接收到一个 transcript chunk 就发送到 AI 的“记录”接口；最终在 silenceTimeout 触发完整提问
  partialSend: process.env.PARTIAL_SEND !== 'false'
};

// 验证必需配置
if (!CONFIG.deepgramApiKey) {
  console.error('❌ Error: DEEPGRAM_API_KEY is not set in .env file');
  process.exit(1);
}

if (CONFIG.aiProvider === 'openai' && !CONFIG.openaiApiKey) {
  console.error('❌ Error: OPENAI_API_KEY required for OpenAI provider');
  process.exit(1);
}
if (CONFIG.aiProvider === 'claude' && !CONFIG.claudeApiKey) {
  console.error('❌ Error: CLAUDE_API_KEY required for Claude provider');
  process.exit(1);
}
if (CONFIG.aiProvider === 'deepseek' && !CONFIG.deepseekApiKey) {
  console.error('❌ Error: DEEPSEEK_API_KEY required for Deepseek provider');
  process.exit(1);
}

// 创建输出目录
if (CONFIG.saveToFile) {
  mkdirSync(dirname(CONFIG.outputFile), { recursive: true });
  mkdirSync(dirname(CONFIG.qaOutputFile), { recursive: true });
}

class AIManager {
  constructor(config) {
    this.config = config;
    this.provider = config.aiProvider;
    this.buffer = ''; // 当前问题缓冲（增量拼接）
    this.conversationHistory = []; // [{role, content, timestamp}]
    this.silenceTimer = null;
    this.isProcessing = false; // 是否正在等待 AI 最终回答
  }

  // 将 fragment 添加到 buffer，并（可选）做 partial send（记录/上下文）
  async pushTranscriptFragment(fragment) {
    const text = fragment.trim();
    if (!text) return;
    const ts = new Date().toISOString();
    this.buffer += (this.buffer ? ' ' : '') + text;

    // 记录增量到会话历史（但标注为 partial）
    this.conversationHistory.push({ role: 'user_partial', content: text, timestamp: ts });

    if (this.config.partialSend) {
      // 轻量化上报：可选择把 partial 发送给 AI 做上下文记录（非请求答案）
      // 我们实现为一个 "note" call to provider — provider 可以忽略或记录
      try {
        await this._notifyProviderOfPartial(text);
      } catch (e) {
        // 不阻塞主流程
        console.error('⚠️ Partial send failed:', e.message || e);
      }
    }

    // 重置静默计时器
    this._resetSilenceTimer();
  }

  _resetSilenceTimer() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => this._onSilenceTimeout(), this.config.silenceTimeoutMs);
  }

  async _onSilenceTimeout() {
    // 超过静默阈值，认定一句“用户话”结束 → 触发最终问答
    if (!this.buffer || this.isProcessing) {
      this.buffer = '';
      return;
    }
    const question = this.buffer.trim();
    this.buffer = '';
    // add final user message
    this.conversationHistory.push({ role: 'user', content: question, timestamp: new Date().toISOString() });
    // call AI for answer
    try {
      this.isProcessing = true;
      await this.getAnswerForQuestion(question);
    } finally {
      this.isProcessing = false;
    }
  }

  // 将部分片段通知 provider（非强制）
  async _notifyProviderOfPartial(text) {
    // For simplicity we call provider with a "log" endpoint if available.
    // Implementations can be no-op for providers that don't support it.
    if (this.provider === 'openai') {
      // noop (we rely on final call)
      return;
    } else if (this.provider === 'claude') {
      return;
    } else if (this.provider === 'deepseek') {
      // noop
      return;
    }
  }

  // 触发请求 AI 获取答案（最终回答），并流式将答案输出到控制台 + 文件
  async getAnswerForQuestion(question) {
    const startTs = new Date().toISOString();
    const systemPrompt = this.config.aiSystemPrompt;

    // Build messages (conversation history + current question)
    const messages = [
      { role: 'system', content: systemPrompt },
      // include last N user messages for context (可改)
    ];
    // include some recent history
    const recent = this.conversationHistory.slice(-10).map(h => {
      // map partial -> user
      const role = (h.role === 'user' || h.role === 'user_partial') ? 'user' : h.role;
      return { role, content: h.content };
    });
    messages.push(...recent);
    messages.push({ role: 'user', content: question });

    // Save QA header in file
    const qaHeader = `\n\n=== QA Session Started: ${startTs} (provider=${this.provider}) ===\nQ: ${question}\n`;
    if (this.config.saveToFile) appendFileSync(this.config.qaOutputFile, qaHeader);

    // Dispatch to provider
    if (this.provider === 'openai') {
      await this._callOpenAIStream(messages);
    } else if (this.provider === 'claude') {
      await this._callClaudeStream(messages);
    } else if (this.provider === 'deepseek') {
      await this._callDeepseek(messages);
    } else {
      console.warn('⚠️ Unknown AI provider:', this.provider);
    }

    const endTs = new Date().toISOString();
    if (this.config.saveToFile) appendFileSync(this.config.qaOutputFile, `\n=== QA Session Ended: ${endTs} ===\n`);
  }

  // OpenAI streaming implementation (v1 chat completions stream)
  async _callOpenAIStream(messages) {
    const apiKey = this.config.openaiApiKey;
    const url = 'https://api.openai.com/v1/chat/completions';

    // We will request stream=true and parse the SSE-like stream
    const body = {
      model: 'gpt-4o-mini', // or another model; could be env-configurable
      messages: messages,
      temperature: 0.2,
      stream: true
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('❌ OpenAI error:', res.status, text);
      if (this.config.saveToFile) appendFileSync(this.config.qaOutputFile, `OpenAI error: ${res.status}\n${text}\n`);
      return;
    }

    // 流式解析
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let done = false;
    let partialAnswer = '';

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        // OpenAI stream uses lines starting with "data: "
        const lines = chunk.split(/\r?\n/).filter(l => l.trim().length > 0);
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = line.replace(/^data: /, '');
            if (payload === '[DONE]') {
              // finished
              if (this.config.logToConsole) console.log('\n--- OpenAI stream done ---\n');
              break;
            }
            try {
              const parsed = JSON.parse(payload);
              const delta = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text;
              if (delta) {
                process.stdout.write(delta);
                partialAnswer += delta;
                if (this.config.saveToFile) appendFileSync(this.config.qaOutputFile, delta);
              }
            } catch (e) {
              // ignore JSON parse errors
            }
          } else {
            // non-data lines (ignore)
          }
        }
      }
    }

    // push assistant record to conversationHistory
    this.conversationHistory.push({ role: 'assistant', content: partialAnswer, timestamp: new Date().toISOString() });
    if (this.config.logToConsole) console.log('\n'); // newline after stream
  }

  // Claude streaming (Anthropic) - pseudo-implementation using their streaming API format
  async _callClaudeStream(messages) {
    // Anthropic expects single prompt string. We'll concat messages into prompt.
    const apiKey = this.config.claudeApiKey;
    // Build prompt text
    const promptParts = messages.map(m => {
      const role = m.role === 'system' ? 'System' : (m.role === 'user' ? 'User' : 'Assistant');
      return `${role}: ${m.content}`;
    });
    const prompt = promptParts.join('\n') + '\nAssistant:';

    const url = 'https://api.anthropic.com/v1/complete'; // check Anthropic docs in your environment
    const body = {
      model: 'claude-2.1', // or env-config
      prompt,
      stream: true,
      max_tokens: 800,
      temperature: 0.2
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('❌ Claude error:', res.status, text);
      if (this.config.saveToFile) appendFileSync(this.config.qaOutputFile, `Claude error: ${res.status}\n${text}\n`);
      return;
    }

    // 解析 streaming body（类似于 OpenAI 的 stream）
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let partialAnswer = '';
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        // Anthropic stream format may differ; common approach：每个 chunk 是 JSON 行
        const lines = chunk.split(/\r?\n/).filter(l => l.trim().length > 0);
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            const token = parsed?.completion;
            if (token) {
              process.stdout.write(token);
              partialAnswer += token;
              if (this.config.saveToFile) appendFileSync(this.config.qaOutputFile, token);
            }
          } catch (e) {
            // fallback: treat raw chunk as text
            process.stdout.write(line);
            partialAnswer += line;
            if (this.config.saveToFile) appendFileSync(this.config.qaOutputFile, line);
          }
        }
      }
    }

    this.conversationHistory.push({ role: 'assistant', content: partialAnswer, timestamp: new Date().toISOString() });
    if (this.config.logToConsole) console.log('\n');
  }

  // Deepseek (generic HTTP) - no streaming assumed (one-shot)
  async _callDeepseek(messages) {
    const apiKey = this.config.deepseekApiKey;
    const url = process.env.DEEPSEEK_ENDPOINT || 'https://api.deepseek.example.com/v1/qa'; // 用户需配置真实 endpoint
    // combine into one question body
    const question = messages.filter(m => m.role === 'user').map(m => m.content).join('\n');
    const body = { question, system: this.config.aiSystemPrompt, max_tokens: 800 };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('❌ Deepseek error:', res.status, text);
      if (this.config.saveToFile) appendFileSync(this.config.qaOutputFile, `Deepseek error: ${res.status}\n${text}\n`);
      return;
    }
    const data = await res.json();
    const answer = data.answer || data.text || JSON.stringify(data);
    // 输出一次性答案
    if (this.config.logToConsole) {
      console.log(answer);
    }
    if (this.config.saveToFile) {
      appendFileSync(this.config.qaOutputFile, answer + '\n');
    }
    this.conversationHistory.push({ role: 'assistant', content: answer, timestamp: new Date().toISOString() });
  }
}

class AudioTranscriber {
  constructor(config) {
    this.config = config;
    this.deepgramClient = null;
    this.deepgramConnection = null;
    this.ffmpegProcess = null;
    this.fileStream = null;
    this.isRunning = false;
    this.aiManager = new AIManager(config);
  }

  initDeepgram() {
    this.deepgramClient = createClient(this.config.deepgramApiKey);
    console.log('✅ Deepgram client initialized');
  }

  createDeepgramConnection() {
    this.deepgramConnection = this.deepgramClient.listen.live({
      language: this.config.language,
      model: this.config.model,
      smart_format: this.config.smartFormat,
      punctuate: this.config.punctuate,
      encoding: 'linear16',
      sample_rate: 16000,
      channels: 1
    });

    this.deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
      console.log('✅ Deepgram connection opened');
      console.log('🎙️  Listening to audio...');
    });

    this.deepgramConnection.on(LiveTranscriptionEvents.Transcript, async (data) => {
      const transcript = data.channel.alternatives[0].transcript;
      if (transcript && transcript.trim().length > 0) {
        const timestamp = new Date().toISOString();
        const output = `[${timestamp}] ${transcript}\n`;

        // 输出到控制台
        if (this.config.logToConsole) {
          console.log(`${transcript}`);
        }

        // 保存到文件
        if (this.config.saveToFile && this.fileStream) {
          this.fileStream.write(output);
        }

        // 把文本片段推给 AI manager（流式/增量）
        try {
          await this.aiManager.pushTranscriptFragment(transcript);
        } catch (e) {
          console.error('⚠️ AI push error:', e.message || e);
        }
      }
    });

    this.deepgramConnection.on(LiveTranscriptionEvents.Metadata, (data) => {
      console.log('📊 Metadata:', data);
    });

    this.deepgramConnection.on(LiveTranscriptionEvents.Error, (error) => {
      console.error('❌ Deepgram error:', error);
    });

    this.deepgramConnection.on(LiveTranscriptionEvents.Close, () => {
      console.log('⚠️  Deepgram connection closed');
    });

    console.log('✅ Deepgram connection created');
  }

  startFFmpegCapture() {
    const ffmpegArgs = [
      '-f', 'avfoundation',
      '-i', `:${this.config.audioDevice}`,
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      '-f', 's16le',
      '-'
    ];

    console.log('🚀 Starting FFmpeg audio capture...');
    console.log(`📡 Audio device: ${this.config.audioDevice}`);

    this.ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

    this.ffmpegProcess.stdout.on('data', (audioData) => {
      if (this.deepgramConnection && this.isRunning) {
        this.deepgramConnection.send(audioData);
      }
    });

    this.ffmpegProcess.stderr.on('data', (data) => {
      const message = data.toString();
      if (message.includes('Error') || message.includes('error')) {
        console.error('⚠️  FFmpeg:', message);
      }
    });

    this.ffmpegProcess.on('exit', (code) => {
      console.log(`⚠️  FFmpeg process exited with code ${code}`);
      this.stop();
    });

    console.log('✅ FFmpeg capture started');
  }

  createFileStream() {
    if (this.config.saveToFile) {
      this.fileStream = createWriteStream(this.config.outputFile, { flags: 'a' });
      const timestamp = new Date().toISOString();
      this.fileStream.write(`\n\n=== Transcription Session Started: ${timestamp} ===\n\n`);
      console.log(`✅ Saving transcripts to: ${this.config.outputFile}`);
    }
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️  Transcription is already running');
      return;
    }

    console.log('\n🎯 Starting Audio to Text Transcriber...');
    console.log('='.repeat(50));

    try {
      this.isRunning = true;

      // 初始化组件
      this.initDeepgram();
      this.createDeepgramConnection();
      this.createFileStream();
      this.startFFmpegCapture();

      console.log('='.repeat(50));
      console.log('✅ Transcription service started successfully!');
      console.log('Press Ctrl+C to stop\n');

    } catch (error) {
      console.error('❌ Failed to start transcription service:', error);
      this.stop();
    }
  }

  stop() {
    if (!this.isRunning) return;

    console.log('\n⏹️  Stopping transcription service...');
    this.isRunning = false;

    if (this.ffmpegProcess) {
      this.ffmpegProcess.kill('SIGTERM');
      this.ffmpegProcess = null;
      console.log('✅ FFmpeg process stopped');
    }

    if (this.deepgramConnection) {
      // finish() might be async; call safely
      try {
        this.deepgramConnection.finish();
      } catch (e) {}
      this.deepgramConnection = null;
      console.log('✅ Deepgram connection closed');
    }

    if (this.fileStream) {
      const timestamp = new Date().toISOString();
      this.fileStream.write(`\n=== Transcription Session Ended: ${timestamp} ===\n`);
      this.fileStream.end();
      this.fileStream = null;
      console.log('✅ Output file closed');
    }

    console.log('👋 Transcription service stopped\n');
  }
}

// 创建转录器实例
const transcriber = new AudioTranscriber(CONFIG);

// 优雅退出处理
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Received interrupt signal...');
  transcriber.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  transcriber.stop();
  process.exit(0);
});

// 启动服务
transcriber.start();
