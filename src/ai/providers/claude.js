// Claude 提供商实现
import { appendFileSync } from 'fs';
import fetch from 'node-fetch';
import BaseProvider from './base-provider.js';
import { processStream, parseClaudeStream } from '../../utils/stream-utils.js';

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

export default ClaudeProvider;