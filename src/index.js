// src/index.js
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { spawn } from 'child_process';
import { createWriteStream, mkdirSync, appendFileSync } from 'fs';
import { dirname } from 'path';
import dotenv from 'dotenv';
import fetch from 'node-fetch'; // npm i node-fetch@2 (或使用更新版本 Node 中的全局 fetch)
import OpenAI from 'openai'; // 使用 OpenAI SDK 调用 Deepseek API
import { pipeline } from 'stream';
import { promisify } from 'util';

// 加载环境变量
dotenv.config();

// 默认配置
const defaultConfig = {
  // Deepgram 配置
  deepgram: {
    apiKey: null, // 必须通过环境变量提供
    language: 'en',
    model: 'nova-2',
    smartFormat: true,
    punctuate: true
  },
  
  // 音频配置
  audio: {
    device: ':1',
    encoding: 'linear16',
    sampleRate: 16000,
    channels: 1
  },
  
  // 输出配置
  output: {
    transcriptFile: 'transcripts/output.txt',
    qaOutputFile: 'transcripts/qa_output.txt',
    saveToFile: true,
    logToConsole: true
  },

  // AI 提供商配置
  ai: {
    provider: 'openai', // openai | claude | deepseek
    // API Keys (必须通过环境变量提供)
    openaiApiKey: null,
    claudeApiKey: null, 
    deepseekApiKey: null,
    deepseekEndpoint: 'https://api.deepseek.com',
    
    // 模型配置
    models: {
      openai: 'gpt-4o-mini',
      claude: 'claude-3-opus-20240229',
      deepseek: 'deepseek-chat'
    },
    
    // 系统提示词
    systemPrompt: `你是一个智能问答助手。当前对话为"语音问答"。要求：
1) 这是用户说出的语音转为文字后的内容，判定用户是否已经问完（可依据停顿/标点），如果未问完请等待更多输入；如果已问完请直接以回答者角色给出回答。
2) 回答要简洁、准确，必要时给出步骤/提示。
3) 如果用户有后续问题，请在结尾提示用户可以继续追问。
`,
    // 静默检测时间（毫秒）
    silenceTimeoutMs: 1500,
    
    // 是否使用部分上报
    partialSend: true
  },
  
  // 中断功能配置
  interruption: {
    enabled: true,
    detectionTimeMs: 300
  }
};

// 加载并验证配置
function loadConfig() {
  // 从环境变量加载配置
  const config = {
    // Deepgram 配置
    deepgram: {
      apiKey: process.env.DEEPGRAM_API_KEY,
      language: process.env.LANGUAGE || defaultConfig.deepgram.language,
      model: process.env.MODEL || defaultConfig.deepgram.model,
      smartFormat: process.env.SMART_FORMAT === 'true' || defaultConfig.deepgram.smartFormat,
      punctuate: process.env.PUNCTUATE === 'true' || defaultConfig.deepgram.punctuate
    },
    
    // 音频配置
    audio: {
      device: process.env.AUDIO_DEVICE || defaultConfig.audio.device,
      encoding: defaultConfig.audio.encoding,
      sampleRate: defaultConfig.audio.sampleRate,
      channels: defaultConfig.audio.channels
    },
    
    // 输出配置
    output: {
      transcriptFile: process.env.OUTPUT_FILE || defaultConfig.output.transcriptFile,
      qaOutputFile: process.env.QA_OUTPUT_FILE || defaultConfig.output.qaOutputFile,
      saveToFile: process.env.SAVE_TO_FILE !== 'false' && defaultConfig.output.saveToFile,
      logToConsole: process.env.LOG_TO_CONSOLE !== 'false' && defaultConfig.output.logToConsole
    },
    
    // AI 配置
    ai: {
      provider: (process.env.AI_PROVIDER || defaultConfig.ai.provider).toLowerCase(),
      openaiApiKey: process.env.OPENAI_API_KEY,
      claudeApiKey: process.env.CLAUDE_API_KEY,
      deepseekApiKey: process.env.DEEPSEEK_API_KEY,
      deepseekEndpoint: process.env.DEEPSEEK_ENDPOINT || defaultConfig.ai.deepseekEndpoint,
      
      // 模型配置
      models: {
        openai: process.env.OPENAI_MODEL || defaultConfig.ai.models.openai,
        claude: process.env.CLAUDE_MODEL || defaultConfig.ai.models.claude,
        deepseek: process.env.DEEPSEEK_MODEL || defaultConfig.ai.models.deepseek
      },
      
      // 系统提示词
      systemPrompt: process.env.AI_SYSTEM_PROMPT || defaultConfig.ai.systemPrompt,
      
      // 静默检测时间
      silenceTimeoutMs: parseInt(process.env.SILENCE_TIMEOUT_MS || defaultConfig.ai.silenceTimeoutMs, 10),
      
      // 是否使用部分上报
      partialSend: process.env.PARTIAL_SEND !== 'false' && defaultConfig.ai.partialSend
    },
    
    // 中断功能配置
    interruption: {
      enabled: process.env.ALLOW_INTERRUPTION !== 'false' && defaultConfig.interruption.enabled,
      detectionTimeMs: parseInt(process.env.INTERRUPTION_DETECTION_MS || defaultConfig.interruption.detectionTimeMs, 10)
    }
  };

  // 验证必要配置
  validateConfig(config);

  return config;
}

// 验证配置是否有效
function validateConfig(config) {
  // 验证 Deepgram API Key
  if (!config.deepgram.apiKey) {
    throw new Error('❌ Error: DEEPGRAM_API_KEY is not set in .env file');
  }

  // 根据选择的 AI 提供商验证 API Key
  if (config.ai.provider === 'openai' && !config.ai.openaiApiKey) {
    throw new Error('❌ Error: OPENAI_API_KEY required for OpenAI provider');
  }
  if (config.ai.provider === 'claude' && !config.ai.claudeApiKey) {
    throw new Error('❌ Error: CLAUDE_API_KEY required for Claude provider');
  }
  if (config.ai.provider === 'deepseek' && !config.ai.deepseekApiKey) {
    throw new Error('❌ Error: DEEPSEEK_API_KEY required for Deepseek provider');
  }
}

// 流处理工具函数

// 处理 Reader 流的通用方法，带中断支持
async function processStream(reader, textDecoder, parseChunk, controller, outputHandler) {
  let done = false;
  let fullText = '';
  
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
            // 使用输出处理器处理 token
            outputHandler(token);
            fullText += token;
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
  
  return fullText;
}

// 解析 OpenAI 流响应
function parseOpenAIStream(chunk) {
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
}

// 解析 Claude 流响应
function parseClaudeStream(chunk) {
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
}

// 中断控制器类
class InterruptibleController {
  // 创建一个可中断控制器
  constructor() {
    this.controller = new AbortController();
    this.interrupted = false;
  }

  // 中断当前操作
  abort() {
    this.interrupted = true;
    this.controller.abort();
  }

  // 获取 AbortSignal
  get signal() {
    return this.controller.signal;
  }

  // 检查是否已被中断
  isInterrupted() {
    return this.interrupted;
  }

  // 重置控制器状态
  reset() {
    this.controller = new AbortController();
    this.interrupted = false;
  }
}

// AI 提供商基类
class BaseProvider {
  // 创建 AI 提供商实例
  constructor(config) {
    this.config = config;
    
    if (new.target === BaseProvider) {
      throw new TypeError("Cannot instantiate BaseProvider directly");
    }
  }

  // 获取提供商名称
  getName() {
    throw new Error("Method 'getName()' must be implemented");
  }

  // 初始化 AI 提供商
  initialize() {
    throw new Error("Method 'initialize()' must be implemented");
  }

  // 发送部分转录片段（可选实现）
  async notifyPartial(text) {
    // 默认空实现，子类可以覆盖
    return Promise.resolve();
  }

  // 流式获取问题的回答
  async streamCompletion(messages, controller) {
    throw new Error("Method 'streamCompletion()' must be implemented");
  }
}

// OpenAI 提供商实现
class OpenAIProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.openai = new OpenAI({
      apiKey: config.ai.openaiApiKey
    });
  }

  getName() {
    return 'openai';
  }

  initialize() {
    // 已经在构造函数中初始化了
  }

  async notifyPartial(text) {
    // OpenAI 不支持部分通知，使用空实现
    return Promise.resolve();
  }

  async streamCompletion(messages, controller) {
    const apiKey = this.config.ai.openaiApiKey;
    const url = 'https://api.openai.com/v1/chat/completions';

    // 请求 stream=true 并解析 SSE 流
    const body = {
      model: this.config.ai.models.openai,
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
    
    // 输出处理函数
    const outputHandler = (token) => {
      process.stdout.write(token);
      if (this.config.output.saveToFile) {
        appendFileSync(this.config.output.qaOutputFile, token);
      }
    };
    
    return await processStream(reader, decoder, parseOpenAIStream, controller, outputHandler);
  }
}

// Claude 提供商实现
class ClaudeProvider extends BaseProvider {
  constructor(config) {
    super(config);
  }

  getName() {
    return 'claude';
  }

  initialize() {
    // 不需要初始化
  }

  async notifyPartial(text) {
    // Claude 不支持部分通知，使用空实现
    return Promise.resolve();
  }

  async streamCompletion(messages, controller) {
    const apiKey = this.config.ai.claudeApiKey;
    
    // 构建 API 请求
    // 注意：Claude API 从旧版的 v1/complete 已更新到 v1/messages
    const url = 'https://api.anthropic.com/v1/messages';
    
    // 转换消息格式为 Claude 格式
    const systemPrompt = messages.find(m => m.role === 'system')?.content || '';
    const userMessages = messages.filter(m => m.role !== 'system');
    
    const body = {
      model: this.config.ai.models.claude,
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
    
    // 输出处理函数
    const outputHandler = (token) => {
      process.stdout.write(token);
      if (this.config.output.saveToFile) {
        appendFileSync(this.config.output.qaOutputFile, token);
      }
    };
    
    return await processStream(reader, decoder, parseClaudeStream, controller, outputHandler);
  }
}

// Deepseek 提供商实现
class DeepseekProvider extends BaseProvider {
  constructor(config) {
    super(config);
    this.openai = new OpenAI({
      baseURL: config.ai.deepseekEndpoint,
      apiKey: config.ai.deepseekApiKey
    });
  }

  getName() {
    return 'deepseek';
  }

  initialize() {
    // 已经在构造函数中初始化了
  }

  async notifyPartial(text) {
    // Deepseek 不支持部分通知，使用空实现
    return Promise.resolve();
  }

  async streamCompletion(messages, controller) {
    try {
      // 使用 OpenAI SDK 创建流式对话完成
      const stream = await this.openai.chat.completions.create({
        model: this.config.ai.models.deepseek,
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
          if (this.config.output.saveToFile) {
            appendFileSync(this.config.output.qaOutputFile, content);
          }
        }
      }

      if (this.config.output.logToConsole && !controller.isInterrupted()) console.log('\n'); // 流结束后添加换行
      return fullText;
    } catch (error) {
      if (error.name === 'AbortError') {
        throw error; // 重新抛出中断错误
      }
      throw new Error(`Deepseek API error: ${error.message}`);
    }
  }
}

// 创建 AI 提供商
function createProvider(provider, config) {
  switch (provider) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'claude':
      return new ClaudeProvider(config);
    case 'deepseek':
      return new DeepseekProvider(config);
    default:
      throw new Error(`未知 AI 提供商: ${provider}`);
  }
}

class AIManager {
  constructor(config) {
    this.config = config;
    this.provider = createProvider(config.ai.provider, config);
    this.buffer = ''; // 当前问题缓冲（增量拼接）
    this.conversationHistory = []; // [{role, content, timestamp}]
    this.silenceTimer = null;
    this.isProcessing = false; // 是否正在等待 AI 最终回答
    this.currentController = new InterruptibleController(); // 可中断控制器
    this.interruptionTimer = null; // 中断检测计时器
    this.lastUserInputTime = Date.now(); // 上次用户输入时间
    this.hasNewUserInput = false; // 是否有新的用户输入
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
    if (this.config.interruption.enabled && this.isProcessing) {
      this._prepareInterruption();
    }

    if (this.config.ai.partialSend) {
      // 轻量化上报：可选择把 partial 发送给 AI 做上下文记录（非请求答案）
      // 我们实现为一个 "note" call to provider — provider 可以忽略或记录
      try {
        await this.provider.notifyPartial(text);
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
      if (Date.now() - this.lastUserInputTime >= this.config.interruption.detectionTimeMs) {
        this._interruptAIResponse();
      }
    }, this.config.interruption.detectionTimeMs);
  }

  // 中断 AI 回答
  _interruptAIResponse() {
    if (!this.isProcessing || !this.hasNewUserInput) return;
    
    console.log("\n\n🔄 检测到新输入，中断当前 AI 回答...\n");
    if (this.config.output.saveToFile) {
      appendFileSync(this.config.output.qaOutputFile, "\n\n[中断：检测到新输入]\n\n");
    }

    // 中断当前的 AI 响应
    this.currentController.abort();
    
    // 重置状态以准备处理新的用户输入
    this.hasNewUserInput = false;
    // 此时不重置 isProcessing，因为 _onSilenceTimeout 中会等待静默后再处理新的问题
  }

  _resetSilenceTimer() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => this._onSilenceTimeout(), this.config.ai.silenceTimeoutMs);
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

  // 触发请求 AI 获取答案（最终回答），并流式将答案输出到控制台 + 文件
  async getAnswerForQuestion(question) {
    const startTs = new Date().toISOString();
    const systemPrompt = this.config.ai.systemPrompt;

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
    const qaHeader = `\n\n=== QA Session Started: ${startTs} (provider=${this.provider.getName()}) ===\nQ: ${question}\n`;
    if (this.config.output.saveToFile) appendFileSync(this.config.output.qaOutputFile, qaHeader);

    // Dispatch to provider
    let partialAnswer = '';
    try {
      // 统一使用 streamCompletion 方法处理所有 AI provider，并传入中断控制器
      partialAnswer = await this.provider.streamCompletion(messages, this.currentController);
    } catch (error) {
      if (error.name === 'AbortError') {
        // 正常中断，记录中断信息
        if (this.config.output.saveToFile) {
          appendFileSync(this.config.output.qaOutputFile, `\n[回答被中断]\n`);
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
        console.error(`❌ ${this.provider.getName().toUpperCase()} error:`, error.message);
        if (this.config.output.saveToFile) {
          appendFileSync(this.config.output.qaOutputFile, `${this.provider.getName().toUpperCase()} error: ${error.message}\n`);
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
      if (this.config.output.saveToFile) appendFileSync(this.config.output.qaOutputFile, `\n=== QA Session Ended: ${endTs} ===\n`);
    }
    
    return partialAnswer;
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
    this.deepgramClient = createClient(this.config.deepgram.apiKey);
    console.log('✅ Deepgram client initialized');
  }

  createDeepgramConnection() {
    this.deepgramConnection = this.deepgramClient.listen.live({
      language: this.config.deepgram.language,
      model: this.config.deepgram.model,
      smart_format: this.config.deepgram.smartFormat,
      punctuate: this.config.deepgram.punctuate,
      encoding: this.config.audio.encoding,
      sample_rate: this.config.audio.sampleRate,
      channels: this.config.audio.channels
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
        if (this.config.output.logToConsole) {
          console.log(`${transcript}`);
        }

        // 保存到文件
        if (this.config.output.saveToFile && this.fileStream) {
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
      '-i', `:${this.config.audio.device}`,
      '-acodec', 'pcm_s16le',
      '-ar', '16000',
      '-ac', '1',
      '-f', 's16le',
      '-'
    ];

    console.log('🚀 Starting FFmpeg audio capture...');
    console.log(`📡 Audio device: ${this.config.audio.device}`);

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
    if (this.config.output.saveToFile) {
      this.fileStream = createWriteStream(this.config.output.transcriptFile, { flags: 'a' });
      const timestamp = new Date().toISOString();
      this.fileStream.write(`\n\n=== Transcription Session Started: ${timestamp} ===\n\n`);
      console.log(`✅ Saving transcripts to: ${this.config.output.transcriptFile}`);
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

      // 创建输出目录
      if (this.config.output.saveToFile) {
        mkdirSync(dirname(this.config.output.transcriptFile), { recursive: true });
        mkdirSync(dirname(this.config.output.qaOutputFile), { recursive: true });
      }

      // 初始化组件
      this.initDeepgram();
      this.createDeepgramConnection();
      this.createFileStream();
      this.startFFmpegCapture();

      console.log('='.repeat(50));
      console.log('✅ Transcription service started successfully!');
      console.log(`🤖 AI Provider: ${this.config.ai.provider.toUpperCase()}`);
      if (this.config.interruption.enabled) {
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

// 创建配置
const CONFIG = loadConfig();

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