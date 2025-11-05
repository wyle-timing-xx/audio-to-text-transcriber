// 音频转录器模块
import { spawn } from 'child_process';
import { createWriteStream, mkdirSync } from 'fs';
import { dirname } from 'path';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import AIManager from '../ai/ai-manager.js';

class AudioTranscriber {
  constructor(config) {
    this.config = config;
    this.deepgramClient = null;
    this.deepgramConnection = null;
    this.ffmpegProcess = null;
    this.fileStream = null;
    this.isRunning = false;
    this.aiManager = new AIManager(config);
    this.lastTranscriptTime = Date.now(); // 跟踪最后一次收到转录的时间
    this.audioDetected = false; // 音频检测状态
    this.lastInterruptTime = 0; // 最后一次中断的时间，用于冷却期
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
      channels: this.config.audio.channels,
      interim_results: this.config.deepgram.interimResults, // 启用中间结果以更快地检测音频
      vad_turnoff: this.config.deepgram.vadTurnoff // 语音活动检测超时（毫秒）
    });

    this.deepgramConnection.on(LiveTranscriptionEvents.Open, () => {
      console.log('✅ Deepgram connection opened');
      console.log('🎙️  Listening to audio...');
    });

    this.deepgramConnection.on(LiveTranscriptionEvents.Transcript, async (data) => {
      // 音频活动状态监控
      this.lastTranscriptTime = Date.now();
      
      // 检测到新音频输入
      if (!this.audioDetected) {
        this.audioDetected = true;
        
        // 如果启用了即时中断，AI正在回答，且不在冷却期内，立即中断
        if (this.config.interruption.enabled && 
            this.config.interruption.immediateInterrupt &&
            this.aiManager.isProcessing && 
            Date.now() - this.lastInterruptTime > this.config.interruption.cooldownMs) {
          
          // 中断提示
          if (this.config.interruption.visualFeedback.enabled) {
            console.log('🔊 检测到语音输入，立即中断AI回答...');
          }
          
          // 记录中断时间
          this.lastInterruptTime = Date.now();
          
          // 中断AI回答
          await this.aiManager._interruptAIResponse();
        }
      }

      const transcript = data.channel.alternatives[0].transcript;
      if (transcript && transcript.trim().length > 0) {
        const timestamp = new Date().toISOString();
        const output = `[${timestamp}] ${transcript}\n`;

        // 输出到控制台
        if (this.config.output.logToConsole) {
          // 根据配置决定是否使用特殊标记突出显示中断
          if (this.aiManager.isProcessing && 
              this.config.interruption.enabled && 
              this.config.interruption.visualFeedback.enabled &&
              this.config.interruption.visualFeedback.useColors) {
            const prefix = this.config.interruption.visualFeedback.interruptPrefix || '🔴';
            const suffix = this.config.interruption.visualFeedback.interruptSuffix || '🔴';
            console.log(`${prefix} ${transcript} ${suffix}`);
          } else {
            console.log(`${transcript}`);
          }
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

    // 监听元数据事件以获取语音活动状态
    this.deepgramConnection.on(LiveTranscriptionEvents.Metadata, (data) => {
      // 如果检测到语音段结束
      if (data?.speech?.final && !data?.speech?.speech_final) {
        this.audioDetected = false;
      }
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
      mkdirSync(dirname(this.config.output.transcriptFile), { recursive: true });
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

      // 启动音频活动监控
      if (this.config.audio.activityDetection.enabled) {
        this.startAudioMonitoring();
      }

      console.log('='.repeat(50));
      console.log('✅ Transcription service started successfully!');
      console.log(`🤖 AI Provider: ${this.config.ai.provider.toUpperCase()}`);
      
      // 中断功能说明
      if (this.config.interruption.enabled) {
        if (this.config.interruption.immediateInterrupt) {
          console.log(`⚡ 增强中断功能已启用: 在AI回答时一检测到声音就会立即中断`);
        } else {
          console.log(`⚡ 中断功能已启用: 在 AI 回答时说话可以打断 AI`);
        }
      }
      
      console.log('Press Ctrl+C to stop\n');

    } catch (error) {
      console.error('❌ Failed to start transcription service:', error);
      this.stop();
    }
  }

  // 启动音频活动监控
  startAudioMonitoring() {
    // 定期检查音频活动状态
    setInterval(() => {
      const silenceTime = Date.now() - this.lastTranscriptTime;
      // 如果超过配置的静默阈值没有收到音频输入，将状态重置为无音频
      if (silenceTime > this.config.audio.activityDetection.silenceThresholdMs && this.audioDetected) {
        this.audioDetected = false;
      }
    }, this.config.audio.activityDetection.checkIntervalMs);
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

export default AudioTranscriber;