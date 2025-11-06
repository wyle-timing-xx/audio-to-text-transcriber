// 配置模块 - 默认配置值

export default {
  // Deepgram 配置
  deepgram: {
    apiKey: null, // 必须通过环境变量提供
    language: 'en',
    model: 'nova-2',
    smartFormat: true,
    punctuate: true,
    interimResults: true, // 启用中间结果以更快地检测音频
    vadTurnoff: 500      // 语音活动检测超时（毫秒）
  },
  
  // 音频配置
  audio: {
    device: ':1',
    encoding: 'linear16',
    sampleRate: 16000,
    channels: 1,
    // 音频活动检测配置
    activityDetection: {
      enabled: true,
      silenceThresholdMs: 500,  // 超过该时间没有输入视为静默
      checkIntervalMs: 200      // 音频活动检测间隔
    }
  },
  
  // 输出配置
  output: {
    transcriptFile: 'transcripts/output.txt',
    qaOutputFile: 'transcripts/qa_output.txt',
    saveToFile: true,
    logToConsole: true,
    highlightInterruptions: true // 高亮显示中断时的文本
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
4) 请注意：用户可能会随时通过说话来中断你的回答，这时候请立即停止并开始处理新的输入。
`,
    // 静默检测时间（毫秒）
    silenceTimeoutMs: 1500,
    
    // 是否使用部分上报
    partialSend: true
  },
  
  // 中断功能配置
  interruption: {
    enabled: true,              // 是否启用中断功能
    immediateInterrupt: true,   // 是否在检测到任何音频输入时立即中断AI
    detectionTimeMs: 300,       // 旧版：中断检测时间窗口（毫秒）
    visualFeedback: {           // 中断的可视化反馈配置
      enabled: true,            // 是否启用可视化反馈
      useColors: true,          // 使用彩色标记突出显示中断
      interruptPrefix: '🔴',    // 中断时的前缀标记
      interruptSuffix: '🔴'     // 中断时的后缀标记
    },
    cooldownMs: 500             // 中断后的冷却时间，防止连续中断（毫秒）
  },

  // 语音合成配置
  tts: {
    enabled: true,              // 是否启用语音合成功能
    provider: 'elevenlabs',     // 语音合成提供商 (elevenlabs | 其他未来支持的服务)
    
    // ElevenLabs配置
    elevenLabsApiKey: null,     // 必须通过环境变量提供
    elevenLabsVoiceId: null,    // 声音ID (必须通过环境变量提供或通过getVoices自动选择)
    elevenLabsModelId: 'eleven_multilingual_v2', // 模型ID
    elevenLabsStability: 0.5,   // 稳定性参数 (0-1)
    elevenLabsSimilarityBoost: 0.75, // 相似度提升参数 (0-1)
    elevenLabsStyle: 0,         // 风格参数 (0-1)
    elevenLabsSpeakerBoost: true, // 是否启用说话者增强
    
    // 提示词配置
    elevenLabsUsePrompt: true,  // 是否使用提示词
    elevenLabsPromptText: '',   // 提示词内容，将添加到实际文本前
    
    // 音频输出设备配置
    outputDevice: 'default',    // 默认输出设备 (可通过ffplay -list_devices true -f avfoundation查看)
    
    // 语音合成行为配置
    autoPlayAnswers: true,      // 是否自动播放AI回答
    maxTextLength: 500,         // 单次合成的最大文本长度，超过将分段处理
    splitDelimiters: ['. ', '? ', '! ', '\n'], // 分段标识符，用于长文本分段
    interruptTtsOnUserInput: true // 在检测到用户输入时中断当前TTS播放
  }
};