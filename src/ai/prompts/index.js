// 提示词模块 - 导出
import promptZh from './prompt_zh.js';
import promptEn from './prompt_en.js';

/**
 * 获取指定语言的系统提示词
 * @param {string} language 语言代码，如'zh'或'en'
 * @returns {string} 相应语言的系统提示词
 */
export function getSystemPrompt(language) {
  // 根据语言代码返回相应的提示词
  switch (language.toLowerCase()) {
    case 'zh':
      return promptZh;
    case 'en':
      return promptEn;
    default:
      // 默认使用英文提示词
      return promptEn;
  }
}

export default {
  getSystemPrompt,
  promptZh,
  promptEn
};