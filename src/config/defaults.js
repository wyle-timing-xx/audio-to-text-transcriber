// 配置模块 - 默认配置值

export default {
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