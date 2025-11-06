// TTS管理器 - 负责将AI回答分段处理并调用TTS提供商

import { createTTSProvider } from './index.js';

/**
 * TTS管理器类
 * 负责管理语音合成流程，包括文本分段、队列管理等
 */
class TTSManager {
  /**
   * 创建TTS管理器
   * @param {Object} config 全局配置
   */
  constructor(config) {
    this.config = config;
    this.provider = null;
    this.isInitialized = false;
    this.queue = [];
    this.isPlaying = false;
    this.shouldStop = false;
    this.currentText = '';
    this.textBuffer = '';
    this.splitDelimiters = config.tts.splitDelimiters || ['. ', '? ', '! ', '\n'];
  }

  /**
   * 初始化TTS管理器
   * @returns {Promise<boolean>} 是否成功初始化
   */
  async initialize() {
    if (!this.config.tts.enabled) {
      console.log('🔇 TTS功能未启用');
      return false;
    }

    try {
      // 创建TTS提供商
      this.provider = createTTSProvider(this.config.tts.provider, this.config);
      
      // 初始化提供商
      await this.provider.initialize();
      
      console.log(`🔊 TTS管理器已初始化，使用${this.provider.getName()}提供商`);
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('❌ TTS初始化失败:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * 处理文本分段
   * @param {string} text 要分段的文本
   * @returns {Array<string>} 分段后的文本数组
   */
  _splitText(text) {
    if (!text) return [];
    
    // 如果文本长度小于最大长度，直接返回
    if (text.length <= this.config.tts.maxTextLength) {
      return [text];
    }
    
    const segments = [];
    let currentSegment = '';
    let lastDelimiterPos = 0;
    
    // 遍历文本，在分隔符处分段
    for (let i = 0; i < text.length; i++) {
      // 检查当前位置是否为分隔符
      const isDelimiter = this.splitDelimiters.some(delimiter => {
        if (i + delimiter.length <= text.length) {
          return text.substring(i, i + delimiter.length) === delimiter;
        }
        return false;
      });
      
      // 如果是分隔符，记录位置
      if (isDelimiter) {
        lastDelimiterPos = i;
      }
      
      // 添加当前字符到当前段落
      currentSegment += text[i];
      
      // 如果当前段落长度超过最大长度且经过了分隔符，则分段
      if (currentSegment.length >= this.config.tts.maxTextLength && lastDelimiterPos > 0) {
        // 分段位置为上一个分隔符
        const segmentEndPos = lastDelimiterPos + 1;
        segments.push(text.substring(0, segmentEndPos));
        
        // 更新剩余文本和当前段落
        text = text.substring(segmentEndPos);
        currentSegment = text;
        i = -1; // 从新文本的开始位置继续
        lastDelimiterPos = 0;
      }
    }
    
    // 添加最后一个段落
    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }
    
    return segments;
  }

  /**
   * 处理AI回答，合成语音
   * @param {string} text 要转换为语音的文本
   * @param {boolean} immediate 是否立即播放（清空队列）
   * @returns {Promise<void>}
   */
  async processAnswer(text, immediate = false) {
    if (!this.isInitialized || !this.config.tts.enabled || !text) {
      return;
    }
    
    // 如果设置为立即播放，先停止当前队列
    if (immediate) {
      this.stopAll();
    }
    
    // 分段文本
    const segments = this._splitText(text);
    
    if (segments.length === 0) {
      return;
    }
    
    // 将分段添加到队列
    segments.forEach(segment => {
      this.queue.push(segment);
    });
    
    // 如果当前没有播放，开始处理队列
    if (!this.isPlaying) {
      this._processQueue();
    }
  }

  /**
   * 处理合成队列
   * @private
   * @returns {Promise<void>}
   */
  async _processQueue() {
    if (this.queue.length === 0 || this.isPlaying || this.shouldStop) {
      return;
    }
    
    this.isPlaying = true;
    
    while (this.queue.length > 0 && !this.shouldStop) {
      this.currentText = this.queue.shift();
      
      try {
        // 调用TTS提供商进行语音合成
        await this.provider.textToSpeech(this.currentText);
      } catch (error) {
        console.error('TTS合成错误:', error);
      }
    }
    
    this.isPlaying = false;
    this.shouldStop = false;
    this.currentText = '';
  }

  /**
   * 停止当前和队列中的所有TTS
   */
  stopAll() {
    // 停止提供商当前正在播放的内容
    if (this.provider) {
      this.provider.stop();
    }
    
    // 清空队列
    this.queue = [];
    this.shouldStop = true;
    this.isPlaying = false;
    console.log('🛑 已停止所有TTS播放和队列');
  }

  /**
   * 处理流式内容
   * 将文本添加到缓冲区，并在适当的时候触发TTS
   * @param {string} text 流式内容片段
   * @param {boolean} isEnd 是否为完整内容的结束
   * @returns {Promise<void>}
   */
  async handleStreamContent(text, isEnd = false) {
    if (!this.isInitialized || !this.config.tts.enabled) {
      return;
    }
    
    // 添加到缓冲区
    this.textBuffer += text;
    
    // 检查是否有完整的句子
    let completeSegment = '';
    for (const delimiter of this.splitDelimiters) {
      const delimiterPos = this.textBuffer.lastIndexOf(delimiter);
      if (delimiterPos !== -1) {
        completeSegment = this.textBuffer.substring(0, delimiterPos + delimiter.length);
        this.textBuffer = this.textBuffer.substring(delimiterPos + delimiter.length);
        break;
      }
    }
    
    // 如果找到完整的句子或者是内容结束，触发TTS
    if (completeSegment || (isEnd && this.textBuffer)) {
      if (completeSegment) {
        await this.processAnswer(completeSegment, false);
      }
      
      if (isEnd && this.textBuffer) {
        await this.processAnswer(this.textBuffer, false);
        this.textBuffer = '';
      }
    }
  }
}

export default TTSManager;