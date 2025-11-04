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
  partialSend: process.env.PARTIAL_SEND !== 'false',
  // 中断检测时间（毫秒）- 在 AI 回答过程中，检测到新的音频输入后，等待此时间，若无更多输入则中断 AI
  interruptionDetectionMs: parseInt(process.env.INTERRUPTION_DETECTION_MS || '300', 10),
  // 是否允许中断 AI 回答
  allowInterruption: process.env.ALLOW_INTERRUPTION !== 'false'
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

// 创建可中断控制的 AbortController
class InterruptibleController {
  constructor() {
    this.controller = new AbortController();
    this.interrupted = false;
  }

  abort() {
    this.interrupted = true;
    this.controller.abort();
  }

  get signal() {
    return this.controller.signal;
  }

  isInterrupted() {
    return this.interrupted;
  }

  reset() {
    this.controller = new AbortController();
    this.interrupted = false;
  }
}

class AIManager {
  constructor(config) {
    this.config = config;
    this.provider = config.aiProvider;
    this.buffer = ''; // 当前问题缓冲（增量拼接）
    this.conversationHistory = []; // [{role, content, timestamp}]
    this.silenceTimer = null;
    this.isProcessing = false; // 是否正在等待 AI 最终回答
    this.currentController = new InterruptibleController(); // 可中断控制器
    this.interruptionTimer = null; // 中断检测计时器
    this.lastUserInputTime = Date.now(); // 上次用户输入时间
    this.hasNewUserInput = false; // 是否有新的用户输入
    
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

    // 更新最后用户输入时间
    this.lastUserInputTime = Date.now();
    this.hasNewUserInput = true;

    // 如果允许中断，且 AI 正在回答，则准备中断
    if (this.config.allowInterruption && this.isProcessing) {
      this._prepareInterruption();
    }

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

  // 准备中断 AI 回答
  _prepareInterruption() {
    // 清除之前的中断计时器
    if (this.interruptionTimer) {
      clearTimeout(this.interruptionTimer);
    }

    // 设置新的中断计时器
    this.interruptionTimer = setTimeout(() => {
      // 如果计时器触发，且在检测时间内没有新的输入，则执行中断
      if (Date.now() - this.lastUserInputTime >= this.config.interruptionDetectionMs) {
        this._interruptAIResponse();
      }
    }, this.config.interruptionDetectionMs);
  }

  // 中断 AI 回答
  _interruptAIResponse() {
    if (!this.isProcessing || !this.hasNewUserInput) return;
    
    console.log("\n\n🔄 检测到新输入，中断当前 AI 回答...\n");
    if (this.config.saveToFile) {
      appendFileSync(this.config.qaOutputFile, "\n\n[中断：检测到新输入]\n\n");
    }

    // 中断当前的 AI 响应
    this.currentController.abort();
    
    // 重置状态以准备处理新的用户输入
    this.hasNewUserInput = false;
    // 此时不重置 isProcessing，因为 _onSilenceTimeout 中会等待静默后再处理新的问题
  }

  _resetSilenceTimer() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => this._onSilenceTimeout(), this.config.silenceTimeoutMs);
  }

  async _onSilenceTimeout() {
    // 超过静默阈值，认定一句"用户话"结束 → 触发最终问答
    if (!this.buffer) {
      return;
    }
    
    // 如果当前有 AI 正在回答且被中断了，等待中断完成
    if (this.isProcessing && this.currentController.isInterrupted()) {
      // 稍微延迟一下，等待中断完成
      setTimeout(() => this._onSilenceTimeout(), 100);
      return;
    }
    
    // 如果当前有 AI 正在回答但没有被中断，则不处理新的问题
    if (this.isProcessing && !this.currentController.isInterrupted()) {
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
      this.currentController.reset(); // 重置控制器为新的回答做准备
      this.hasNewUserInput = false; // 重置新输入标志
      await this.getAnswerForQuestion(question);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log("AI 回答被中断");
      } else {
        console.error("AI 回答出错:", error);
      }
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
      // 统一使用 streamCompletion 方法处理所有 AI provider，并传入中断控制器
      partialAnswer = await this._streamCompletion(messages, this.currentController);
    } catch (error) {
      if (error.name === 'AbortError') {
        // 正常中断，记录中断信息
        if (this.config.saveToFile) {
          appendFileSync(this.config.qaOutputFile, `\n[回答被中断]\n`);
        }
        // 将中断的回答添加到会话历史
        this.conversationHistory.push({
          role: 'assistant',
          content: `${partialAnswer} [回答被中断]`,
          timestamp: new Date().toISOString(),
          interrupted: true
        });
        return partialAnswer;
      } else {
        // 其他错误
        console.error(`❌ ${this.provider.toUpperCase()} error:`, error.message);
        if (this.config.saveToFile) {
          appendFileSync(this.config.qaOutputFile, `${this.provider.toUpperCase()} error: ${error.message}\n`);
        }
      }
    }

    if (!this.currentController.isInterrupted()) {
      this.conversationHistory.push({
        role: 'assistant',
        content: partialAnswer,
        timestamp: new Date().toISOString()
      });
      
      const endTs = new Date().toISOString();
      if (this.config.saveToFile) appendFileSync(this.config.qaOutputFile, `\n=== QA Session Ended: ${endTs} ===\n`);
    }
    
    return partialAnswer;
  }

  // 统一的流式调用方法，根据 provider 类型调用不同的实现
  async _streamCompletion(messages, controller) {
    switch (this.provider) {
      case 'openai':
        return await this._streamOpenAI(messages, controller);
      case 'claude':
        return await this._streamClaude(messages, controller);
      case 'deepseek':
        return await this._streamDeepseekWithSDK(messages, controller);
      default:
        throw new Error(`Unknown AI provider: ${this.provider}`);
    }
  }

  // 处理 Reader 流的通用方法，添加中断支持
  async _processStream(reader, textDecoder, parseChunk, controller) {
    let done = false;
    let partialAnswer = '';
    
    try {
      while (!done) {
        // 检查是否被中断
        if (controller.isInterrupted()) {
          reader.cancel();
          throw new DOMException('Stream processing aborted', 'AbortError');
        }
        
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        
        if (value) {
          const chunk = textDecoder.decode(value, { stream: true });
          const tokens = parseChunk(chunk);
          
          for (const token of tokens) {
            // 每处理一个 token 也检查是否被中断
            if (controller.isInterrupted()) {
              reader.cancel();
              throw new DOMException('Stream processing aborted', 'AbortError');
            }
            
            if (token) {
              process.stdout.write(token);
              partialAnswer += token;
              if (this.config.saveToFile) appendFileSync(this.config.qaOutputFile, token);
            }
          }
        }
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        throw error; // 重新抛出中断错误
      }
      console.error('Stream processing error:', error);
    }
    
    if (this.config.logToConsole && !controller.isInterrupted()) console.log('\n');
    return partialAnswer;
  }

  // OpenAI 流式实现 (使用 v1 completions API)，添加中断支持
  async _streamOpenAI(messages, controller) {
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
      body: JSON.stringify(body),
      signal: controller.signal
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
    }, controller);
  }

  // Claude 流式实现，添加中断支持
  async _streamClaude(messages, controller) {
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
      body: JSON.stringify(body),
      signal: controller.signal
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
    }, controller);
  }

  // 使用 OpenAI SDK 调用 Deepseek API（流式），添加中断支持
  async _streamDeepseekWithSDK(messages, controller) {
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
      }, { signal: controller.signal });

      let fullText = '';

      // 处理流式响应
      for await (const chunk of stream) {
        // 检查是否被中断
        if (controller.isInterrupted()) {
          throw new DOMException('Stream processing aborted', 'AbortError');
        }
        
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

      if (this.config.logToConsole && !controller.isInterrupted()) console.log('\n'); // 流结束后添加换行
      return fullText;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw error; // 重新抛出中断错误
      }
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
      if (this.config.allowInterruption) {
        console.log(`⚡ 中断功能已启用: 在 AI 回答时说话可以打断 AI`);
      }
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