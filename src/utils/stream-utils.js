// 流处理工具函数

/**
 * 处理 Reader 流的通用方法，带中断支持
 * 
 * @param {ReadableStreamDefaultReader} reader 读取流
 * @param {TextDecoder} textDecoder 文本解码器
 * @param {Function} parseChunk 解析块函数
 * @param {Object} controller 中断控制器
 * @param {Function} outputHandler 输出处理函数
 * @param {Function} tokenCallback 可选的token回调函数，用于TTS等处理
 * @returns {Promise<string>} 处理完成的文本
 * @throws {AbortError} 如果流处理被中断
 */
export async function processStream(reader, textDecoder, parseChunk, controller, outputHandler, tokenCallback = null) {
  let done = false;
  let fullText = '';
  
  try {
    while (!done) {
      // 检查是否被中断
      if (controller.isInterrupted()) {
        reader.cancel();
        throw new DOMException('Stream processing aborted', 'AbortError');
      }
      
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      
      if (value) {
        const chunk = textDecoder.decode(value, { stream: true });
        const tokens = parseChunk(chunk);
        
        for (const token of tokens) {
          // 每处理一个 token 也检查是否被中断
          if (controller.isInterrupted()) {
            reader.cancel();
            throw new DOMException('Stream processing aborted', 'AbortError');
          }
          
          if (token) {
            // 使用输出处理器处理 token
            outputHandler(token);
            
            // 如果提供了token回调函数，调用它
            if (tokenCallback && typeof tokenCallback === 'function') {
              await tokenCallback(token);
            }
            
            fullText += token;
          }
        }
      }
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error; // 重新抛出中断错误
    }
    console.error('Stream processing error:', error);
  }
  
  return fullText;
}

/**
 * 解析 OpenAI 流响应
 * 
 * @param {string} chunk 响应数据块
 * @returns {string[]} 解析出的 token 数组
 */
export function parseOpenAIStream(chunk) {
  const tokens = [];
  const lines = chunk.split(/\r?\n/).filter(l => l.trim().length > 0);
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const payload = line.replace(/^data: /, '');
      if (payload === '[DONE]') continue;
      
      try {
        const parsed = JSON.parse(payload);
        const token = parsed.choices?.[0]?.delta?.content || '';
        if (token) tokens.push(token);
      } catch (e) {
        // 忽略 JSON 解析错误
      }
    }
  }
  
  return tokens;
}

/**
 * 解析 Claude 流响应
 * 
 * @param {string} chunk 响应数据块
 * @returns {string[]} 解析出的 token 数组
 */
export function parseClaudeStream(chunk) {
  const tokens = [];
  const lines = chunk.split(/\r?\n/).filter(l => l.trim().length > 0);
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const payload = line.replace(/^data: /, '');
      if (payload === '[DONE]') continue;
      
      try {
        const parsed = JSON.parse(payload);
        // 新版 Claude API 在 delta.text 中返回 token
        const token = parsed.delta?.text || '';
        if (token) tokens.push(token);
      } catch (e) {
        // 非 JSON 行，可能是普通文本（旧版API）
        if (line !== 'data: [DONE]') tokens.push(line);
      }
    }
  }
  
  return tokens;
}