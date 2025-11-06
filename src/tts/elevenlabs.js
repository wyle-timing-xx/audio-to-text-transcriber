// ElevenLabs语音合成提供商

import BaseTTSProvider from './base-tts-provider.js';
import fetch from 'node-fetch';
import { spawn } from 'child_process';
import { createWriteStream, unlinkSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { Readable } from 'stream';

/**
 * ElevenLabs API文档: https://docs.elevenlabs.io/api-reference
 */
class ElevenLabsProvider extends BaseTTSProvider {
  constructor(config) {
    super(config);
    this.apiKey = config.tts.elevenLabsApiKey;
    this.apiUrl = 'https://api.elevenlabs.io/v1';
    this.voiceId = config.tts.elevenLabsVoiceId;
    this.modelId = config.tts.elevenLabsModelId || 'eleven_multilingual_v2';
    this.stability = config.tts.elevenLabsStability || 0.5;
    this.similarityBoost = config.tts.elevenLabsSimilarityBoost || 0.75;
    this.style = config.tts.elevenLabsStyle || 0;
    this.speakerBoost = config.tts.elevenLabsSpeakerBoost !== false;
    this.usePrompt = config.tts.elevenLabsUsePrompt !== false;
    this.promptText = config.tts.elevenLabsPromptText || '';
    this.outputDevice = config.tts.outputDevice || 'default';
    
    // 当前播放进程
    this.currentPlayProcess = null;
    this.tempDir = './temp';
    this.tempFile = `${this.tempDir}/tts_output.mp3`;
  }

  getName() {
    return 'elevenlabs';
  }

  async initialize() {
    // 确保临时目录存在
    if (!existsSync(this.tempDir)) {
      mkdirSync(this.tempDir, { recursive: true });
    }
    
    // 验证API密钥
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key is not set');
    }
    
    // 验证VoiceID
    if (!this.voiceId) {
      console.warn('ElevenLabs Voice ID is not set. Using default voice.');
      // 尝试获取默认声音
      const voices = await this.getVoices();
      if (voices.length > 0) {
        this.voiceId = voices[0].voice_id;
        console.log(`Using default voice: ${voices[0].name} (${this.voiceId})`);
      } else {
        throw new Error('No voices available in your ElevenLabs account');
      }
    }
    
    console.log(`🔊 ElevenLabs TTS initialized with voice ID: ${this.voiceId}`);
    return true;
  }

  async getVoices() {
    try {
      const response = await fetch(`${this.apiUrl}/voices`, {
        method: 'GET',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`ElevenLabs API error: ${error.detail || response.statusText}`);
      }

      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      console.error('Failed to get ElevenLabs voices:', error);
      return [];
    }
  }

  async textToSpeech(text, options = {}) {
    // 合并自定义选项
    const voiceId = options.voiceId || this.voiceId;
    const modelId = options.modelId || this.modelId;
    const stability = options.stability || this.stability;
    const similarityBoost = options.similarityBoost || this.similarityBoost;
    const style = options.style !== undefined ? options.style : this.style;
    const speakerBoost = options.speakerBoost !== undefined ? options.speakerBoost : this.speakerBoost;
    
    // 添加提示词功能
    let finalText = text;
    if (this.usePrompt && this.promptText) {
      // 使用提示词来影响生成的语音特征
      finalText = `${this.promptText} ${text}`;
    }
    
    // 准备请求体
    const body = JSON.stringify({
      text: finalText,
      model_id: modelId,
      voice_settings: {
        stability,
        similarity_boost: similarityBoost,
        style,
        use_speaker_boost: speakerBoost
      }
    });

    try {
      // 先停止当前播放
      this.stop();
      
      // 调用API获取音频流
      const response = await fetch(`${this.apiUrl}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`ElevenLabs API error: ${error.detail || response.statusText}`);
      }

      // 将响应保存到临时文件
      const buffer = await response.arrayBuffer();
      const readable = new Readable();
      readable._read = () => {}; // 必要的空实现
      readable.push(Buffer.from(buffer));
      readable.push(null);

      const writeStream = createWriteStream(this.tempFile);
      readable.pipe(writeStream);

      return new Promise((resolve, reject) => {
        writeStream.on('finish', () => {
          // 使用ffplay播放音频
          this.playAudio(this.tempFile).then(resolve).catch(reject);
        });
        
        writeStream.on('error', (err) => {
          reject(err);
        });
      });
    } catch (error) {
      console.error('ElevenLabs TTS error:', error);
      throw error;
    }
  }

  async playAudio(filePath) {
    return new Promise((resolve, reject) => {
      // 通过FFplay播放音频
      const args = ['-nodisp', '-autoexit'];
      
      // 如果指定了输出设备，添加相应参数
      if (this.outputDevice !== 'default') {
        args.push('-audio_device');
        args.push(this.outputDevice);
      }
      
      args.push(filePath);
      
      this.currentPlayProcess = spawn('ffplay', args, {
        stdio: ['ignore', 'ignore', 'pipe'] // 忽略stdout，只关注stderr
      });

      this.currentPlayProcess.stderr.on('data', (data) => {
        const message = data.toString();
        // 忽略常见的FFplay日志消息
        if (!message.includes('Output') && !message.includes('format') && !message.includes('Duration')) {
          console.error(`FFplay error: ${message}`);
        }
      });

      this.currentPlayProcess.on('close', (code) => {
        this.currentPlayProcess = null;
        if (code === 0 || code === 255) { // 255通常是因为被终止
          // 清理临时文件
          try {
            if (existsSync(filePath)) {
              unlinkSync(filePath);
            }
          } catch (e) {
            console.warn(`Failed to delete temp file: ${e.message}`);
          }
          resolve();
        } else {
          reject(new Error(`FFplay exited with code ${code}`));
        }
      });

      this.currentPlayProcess.on('error', (err) => {
        this.currentPlayProcess = null;
        reject(new Error(`Failed to play audio: ${err.message}`));
      });
    });
  }

  stop() {
    if (this.currentPlayProcess) {
      this.currentPlayProcess.kill('SIGTERM');
      this.currentPlayProcess = null;
      console.log('🛑 Stopped current TTS playback');
      return true;
    }
    return false;
  }
}

export default ElevenLabsProvider;