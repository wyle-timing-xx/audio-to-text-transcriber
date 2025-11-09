/**
 * 简单的语言检测工具，用于确定文本是英文还是中文
 */
class LanguageDetector {
  /**
   * 检测给定文本的语言
   * 
   * @param {string} text - 要检测的文本
   * @returns {string} - 检测到的语言代码 ('en' 为英文, 'zh' 为中文)
   */
  static detectLanguage(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return 'en'; // 默认为英文
    }

    // 中文字符的 Unicode 范围
    const chineseRegex = /[\u4e00-\u9fa5]/;
    
    // 统计中文字符和非中文字符的数量
    let chineseCount = 0;
    let nonChineseCount = 0;
    
    for (const char of text) {
      if (chineseRegex.test(char)) {
        chineseCount++;
      } else if (/[a-zA-Z]/.test(char)) {
        nonChineseCount++;
      }
    }
    
    // 如果中文字符比例超过一定阈值，则判定为中文
    // 这里使用的阈值是中文字符数大于英文字符数的30%，可以根据需求调整
    if (chineseCount > nonChineseCount * 0.3) {
      return 'zh';
    }
    
    return 'en';
  }
}

export default LanguageDetector;