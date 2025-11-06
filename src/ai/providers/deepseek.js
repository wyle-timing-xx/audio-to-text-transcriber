// Deepseek 提供商实现
import { appendFileSync } from 'fs';
import OpenAI from 'openai';
import BaseProvider from './base-provider.js';

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

  async streamCompletion(messages, controller, tokenCallback = null) {
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
          
          // 如果提供了token回调函数，调用它
          if (tokenCallback && typeof tokenCallback === 'function') {
            await tokenCallback(content);
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

export default DeepseekProvider;