// AI 管理器模块
import { appendFileSync } from 'fs';
import InterruptibleController from './interruption.js';
import { createProvider } from './providers/index.js';
import TTSManager from '../tts/tts-manager.js';
import { getSystemPrompt } from './prompts/index.js';
import { KeyboardListener } from '../utils/index.js';

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
    
    // 初始化TTS管理器
    this.ttsManager = new TTSManager(config);
    
    // 初始化键盘监听器
    this.keyboardListener = new KeyboardListener();
  }

  // 初始化AI管理器
  async initialize() {
    // 初始化TTS管理器
    if (this.config.tts.enabled) {
      await this.ttsManager.initialize();
    }
    
    // 启动键盘监听
    this.keyboardListener.startListening();
    
    // 注册Ctrl+T中断回调
    this.keyboardListener.registerCallback('ctrl+t', () => {
      if (this.isProcessing) {
        this._interruptAIResponse();
      }
    });
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

    // 注意：移除了基于音频检测的中断功能
    // 现在中断只会通过键盘Ctrl+T触发

    // 如果启用了TTS，且配置为检测用户输入时中断TTS，则停止当前TTS
    if (this.config.tts.enabled && 
        this.config.tts.interruptTtsOnUserInput && 
        this.ttsManager.isPlaying) {
      this.ttsManager.stopAll();
    }

    if (this.config.ai.partialSend) {
      // 轻量化上报：可选择把 partial 发送给 AI 做上下文记录（非请求答案）
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

  // 中断 AI 回答
  _interruptAIResponse() {
    if (!this.isProcessing) return;
    
    console.log("\n\n🔄 检测到中断信号 (Ctrl+T)，立即中断当前 AI 回答...\n");
    if (this.config.output.saveToFile) {
      appendFileSync(this.config.output.qaOutputFile, "\n\n[中断：Ctrl+T 按键触发]\n\n");
    }

    // 中断当前的 AI 响应
    this.currentController.abort();
    
    // 如果启用了TTS，停止当前TTS播放
    if (this.config.tts.enabled) {
      this.ttsManager.stopAll();
    }
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

  // 根据配置的语言获取系统提示词
  getSystemPromptByLanguage() {
    // 使用 getSystemPrompt 函数获取当前语言的系统提示词
    return getSystemPrompt(this.config.deepgram.language);
  }

  // 触发请求 AI 获取答案（最终回答），并流式将答案输出到控制台 + 文件
  async getAnswerForQuestion(question) {
    const startTs = new Date().toISOString();
    // 获取基于当前语言的系统提示词
    const systemPrompt = this.getSystemPromptByLanguage();

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
    let accumulatedText = ''; // 用于累积响应文本以传递给TTS

    try {
      // 为了支持流式TTS，我们需要修改streamCompletion调用方式
      // 使用自定义回调来处理每个token
      const handleToken = async (token) => {
        // 累积文本用于最终保存
        partialAnswer += token;
        
        // 如果启用了TTS，将token传递给TTS管理器
        if (this.config.tts.enabled && this.config.tts.autoPlayAnswers) {
          accumulatedText += token;
          await this.ttsManager.handleStreamContent(token, false);
        }
        
        // 将token写入文件
        if (this.config.output.saveToFile) {
          appendFileSync(this.config.output.qaOutputFile, token);
        }
      };
      
      // 统一使用 streamCompletion 方法处理所有 AI provider，并传入中断控制器
      await this.provider.streamCompletion(messages, this.currentController, handleToken);
      
      // 处理最后可能剩余的TTS文本
      if (this.config.tts.enabled && this.config.tts.autoPlayAnswers) {
        await this.ttsManager.handleStreamContent('', true); // 结束标记
      }
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
  
  // 清理资源
  cleanup() {
    // 停止键盘监听
    if (this.keyboardListener) {
      this.keyboardListener.stopListening();
    }
    
    // 停止TTS
    if (this.ttsManager) {
      this.ttsManager.stopAll();
    }
  }
}

export default AIManager;