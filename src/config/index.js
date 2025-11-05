// 配置模块 - 配置加载和验证

import dotenv from 'dotenv';
import defaultConfig from './defaults.js';

// 加载环境变量
dotenv.config();

/**
 * 加载并验证配置
 * @returns {Object} 合并后的配置对象
 * @throws {Error} 如果缺少必要的配置
 */
export function loadConfig() {
  // 从环境变量加载配置
  const config = {
    // Deepgram 配置
    deepgram: {
      apiKey: process.env.DEEPGRAM_API_KEY,
      language: process.env.LANGUAGE || defaultConfig.deepgram.language,
      model: process.env.MODEL || defaultConfig.deepgram.model,
      smartFormat: process.env.SMART_FORMAT === 'true' || defaultConfig.deepgram.smartFormat,
      punctuate: process.env.PUNCTUATE === 'true' || defaultConfig.deepgram.punctuate,
      interimResults: process.env.INTERIM_RESULTS !== 'false' && defaultConfig.deepgram.interimResults,
      vadTurnoff: parseInt(process.env.VAD_TURNOFF || defaultConfig.deepgram.vadTurnoff, 10)
    },
    
    // 音频配置
    audio: {
      device: process.env.AUDIO_DEVICE || defaultConfig.audio.device,
      encoding: defaultConfig.audio.encoding,
      sampleRate: defaultConfig.audio.sampleRate,
      channels: defaultConfig.audio.channels,
      
      // 音频活动检测配置
      activityDetection: {
        enabled: process.env.AUDIO_ACTIVITY_DETECTION !== 'false' && defaultConfig.audio.activityDetection.enabled,
        silenceThresholdMs: parseInt(process.env.SILENCE_THRESHOLD_MS || defaultConfig.audio.activityDetection.silenceThresholdMs, 10),
        checkIntervalMs: parseInt(process.env.ACTIVITY_CHECK_INTERVAL_MS || defaultConfig.audio.activityDetection.checkIntervalMs, 10)
      }
    },
    
    // 输出配置
    output: {
      transcriptFile: process.env.OUTPUT_FILE || defaultConfig.output.transcriptFile,
      qaOutputFile: process.env.QA_OUTPUT_FILE || defaultConfig.output.qaOutputFile,
      saveToFile: process.env.SAVE_TO_FILE !== 'false' && defaultConfig.output.saveToFile,
      logToConsole: process.env.LOG_TO_CONSOLE !== 'false' && defaultConfig.output.logToConsole,
      highlightInterruptions: process.env.HIGHLIGHT_INTERRUPTIONS !== 'false' && defaultConfig.output.highlightInterruptions
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
      immediateInterrupt: process.env.IMMEDIATE_INTERRUPT !== 'false' && defaultConfig.interruption.immediateInterrupt,
      detectionTimeMs: parseInt(process.env.INTERRUPTION_DETECTION_MS || defaultConfig.interruption.detectionTimeMs, 10),
      
      // 可视化反馈配置
      visualFeedback: {
        enabled: process.env.INTERRUPT_VISUAL_FEEDBACK !== 'false' && defaultConfig.interruption.visualFeedback.enabled,
        useColors: process.env.INTERRUPT_USE_COLORS !== 'false' && defaultConfig.interruption.visualFeedback.useColors,
        interruptPrefix: process.env.INTERRUPT_PREFIX || defaultConfig.interruption.visualFeedback.interruptPrefix,
        interruptSuffix: process.env.INTERRUPT_SUFFIX || defaultConfig.interruption.visualFeedback.interruptSuffix
      },
      
      // 中断冷却时间
      cooldownMs: parseInt(process.env.INTERRUPTION_COOLDOWN_MS || defaultConfig.interruption.cooldownMs, 10)
    }
  };

  // 验证必要配置
  validateConfig(config);

  return config;
}

/**
 * 验证配置是否有效
 * @param {Object} config 配置对象
 * @throws {Error} 如果缺少必要的配置
 */
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
  
  // 检查中断功能配置是否合理
  if (config.interruption.enabled) {
    // 中断冷却时间不能小于0
    if (config.interruption.cooldownMs < 0) {
      config.interruption.cooldownMs = 0;
    }
    
    // 检测时间不能小于100ms
    if (config.interruption.detectionTimeMs < 100) {
      config.interruption.detectionTimeMs = 100;
    }
  }
}

export default loadConfig;