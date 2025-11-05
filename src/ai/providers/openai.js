// OpenAI 提供商实现
import { appendFileSync } from 'fs';
import fetch from 'node-fetch';
import OpenAI from 'openai';
import BaseProvider from './base-provider.js';
import { processStream, parseOpenAIStream } from '../../utils/stream-utils.js';

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

export default OpenAIProvider;