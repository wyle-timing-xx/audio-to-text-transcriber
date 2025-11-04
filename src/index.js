// src/index.js
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { spawn } from 'child_process';
import { createWriteStream, mkdirSync, appendFileSync } from 'fs';
import { dirname } from 'path';
import dotenv from 'dotenv';
import fetch from 'node-fetch'; // npm i node-fetch@2 (or use global fetch in newer Node)
import OpenAI from 'openai'; // 使用 OpenAI SDK 调用 Deepseek API
import { pipeline } from 'stream';
import { promisify } from 'util';

// 加载环境变量
dotenv.config();

// 配置项
const CONFIG = {
  deepgramApiKey: process.env.DEEPGRAM_API_KEY,
  audioDevice: process.env.AUDIO_DEVICE || ':1',
  language: process.env.LANGUAGE || 'en',
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
  deepseekEndpoint: process.env.DEEPSEEK_ENDPOINT || 'https://api.deepseek.com', // 默认使用官方 API 地址
  // AI 模型配置
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  claudeModel: process.env.CLAUDE_MODEL || 'claude-3-opus-20240229',
  deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  // prompt / behavior
  aiSystemPrompt: process.env.AI_SYSTEM_PROMPT || `你是一个智能问答助手。当前对话为"语音问答"。要求：
1) 这是用户说出的语音转为文字后的内容，判定用户是否已经问完（可依据停顿/标点），如果未问完请等待更多输入；如果已问完请直接以回答者角色给出回答。
2) 回答要简洁、准确，必要时给出步骤/提示。
3) 如果用户有后续问题，请在结尾提示用户可以继续追问。
`,
  // 静默检测（毫秒） — 在无新转录片段的情况下判定用户已结束一句话
  silenceTimeoutMs: parseInt(process.env.SILENCE_TIMEOUT_MS || '1500', 10),
  // 部分上报策略：每当接收到一个 transcript chunk 就发送到 AI 的"记录"接口；最终在 silenceTimeout 触发完整提问
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
    
    // 初始化 OpenAI 客户端 (用于 Deepseek 和 OpenAI)
    if (this.provider === 'openai') {
      this.openai = new OpenAI({
        apiKey: config.openaiApiKey
      });
    } else if (this.provider === 'deepseek') {
      this.openai = new OpenAI({
        baseURL: config.deepseekEndpoint,
        apiKey: config.deepseekApiKey
      });
    }
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
    // 超过静默阈值，认定一句"用户话"结束 → 触发最终问答
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
    const recent = this.conversationHistory.slice(-10).filter(h => {
      // 过滤掉 partial 记录，只保留完整对话
      return h.role !== 'user_partial';
    });
    messages.push(...recent);
    messages.push({ role: 'user', content: question });

    // Save QA header in file
    const qaHeader = `\n\n=== QA Session Started: ${startTs} (provider=${this.provider}) ===\nQ: ${question}\n`;
    if (this.config.saveToFile) appendFileSync(this.config.qaOutputFile, qaHeader);

    // Dispatch to provider
    let partialAnswer = '';
    try {
      // 统一使用 streamCompletion 方法处理所有 AI provider
      partialAnswer = await this._streamCompletion(messages);
    } catch (error) {
      console.error(`❌ ${this.provider.toUpperCase()} error:`, error.message);
      if (this.config.saveToFile) appendFileSync(this.config.qaOutputFile, `${this.provider.toUpperCase()} error: ${error.message}\n`);
    }

    this.conversationHistory.push({ role: 'assistant', content: partialAnswer, timestamp: new Date().toISOString() });
    
    const endTs = new Date().toISOString();
    if (this.config.saveToFile) appendFileSync(this.config.qaOutputFile, `\n=== QA Session Ended: ${endTs} ===\n`);
  }

  // 统一的流式调用方法，根据 provider 类型调用不同的实现
  async _streamCompletion(messages) {
    switch (this.provider) {
      case 'openai':
        return await this._streamOpenAI(messages);
      case 'claude':
        return await this._streamClaude(messages);
      case 'deepseek':
        return await this._streamDeepseekWithSDK(messages);
      default:
        throw new Error(`Unknown AI provider: ${this.provider}`);
    }
  }

  // 处理 Reader 流的通用方法
  async _processStream(reader, textDecoder, parseChunk) {
    let done = false;
    let partialAnswer = '';
    
    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      
      if (value) {
        const chunk = textDecoder.decode(value, { stream: true });
        const tokens = parseChunk(chunk);
        
        for (const token of tokens) {
          if (token) {
            process.stdout.write(token);
            partialAnswer += token;
            if (this.config.saveToFile) appendFileSync(this.config.qaOutputFile, token);
          }
        }
      }
    }
    
    if (this.config.logToConsole) console.log('\n'); // Add a newline after streaming
    return partialAnswer;
  }

  // OpenAI 流式实现 (使用 v1 completions API)
  async _streamOpenAI(messages) {
    const apiKey = this.config.openaiApiKey;
    const url = 'https://api.openai.com/v1/chat/completions';

    // 请求 stream=true 并解析 SSE 流
    const body = {
      model: this.config.openaiModel,
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
      throw new Error(`HTTP error ${res.status}: ${text}`);
    }

    // 使用通用流处理方法
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    
    return await this._processStream(reader, decoder, (chunk) => {
      // OpenAI 流解析
      const tokens = [];
      const lines = chunk.split(/\r?\n/).filter(l => l.trim().length > 0);
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.replace(/^data: /, '');
          if (payload === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(payload);
            const token = parsed.choices?.[0]?.delta?.content || '';
            if (token) tokens.push(token);
          } catch (e) {
            // 忽略 JSON 解析错误
          }
        }
      }
      
      return tokens;
    });
  }

  // Claude 流式实现
  async _streamClaude(messages) {
    const apiKey = this.config.claudeApiKey;
    
    // 构建 API 请求
    // 注意：Claude API 从旧版的 v1/complete 已更新到 v1/messages
    const url = 'https://api.anthropic.com/v1/messages';
    
    // 转换消息格式为 Claude 格式
    const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
    const userMessages = messages.filter(m => m.role !== 'system');
    
    const body = {
      model: this.config.claudeModel,
      system: systemPrompt,
      messages: userMessages.map(m => ({
        role: m.role,
        content: m.content
      })),
      max_tokens: 800,
      temperature: 0.2,
      stream: true
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP error ${res.status}: ${text}`);
    }

    // 使用通用流处理方法
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    
    return await this._processStream(reader, decoder, (chunk) => {
      // Claude 流解析
      const tokens = [];
      const lines = chunk.split(/\r?\n/).filter(l => l.trim().length > 0);
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const payload = line.replace(/^data: /, '');
          if (payload === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(payload);
            // 新版 Claude API 在 delta.text 中返回 token
            const token = parsed.delta?.text || '';
            if (token) tokens.push(token);
          } catch (e) {
            // 非 JSON 行，可能是普通文本（旧版API）
            if (line !== 'data: [DONE]') tokens.push(line);
          }
        }
      }
      
      return tokens;
    });
  }

  // 使用 OpenAI SDK 调用 Deepseek API（流式）
  async _streamDeepseekWithSDK(messages) {
    try {
      // 使用 OpenAI SDK 创建流式对话完成
      const stream = await this.openai.chat.completions.create({
        model: this.config.deepseekModel,
        messages: messages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        stream: true,
        temperature: 0.2
      });

      let fullText = '';

      // 处理流式响应
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          process.stdout.write(content);
          fullText += content;
          
          // 保存到文件
          if (this.config.saveToFile) {
            appendFileSync(this.config.qaOutputFile, content);
          }
        }
      }

      if (this.config.logToConsole) console.log('\n'); // 流结束后添加换行
      return fullText;
    } catch (error) {
      throw new Error(`Deepseek API error: ${error.message}`);
    }
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
      console.log(`🤖 AI Provider: ${this.config.aiProvider.toUpperCase()}`);
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