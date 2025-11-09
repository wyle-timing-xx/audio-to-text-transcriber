# 语言自动检测与Prompt选择功能

本分支增加了自动语言检测和Prompt选择功能，使系统能够根据用户输入的语言自动选择相应的Prompt。

## 新增功能

1. **语言自动检测**：
   - 添加了 `LanguageDetector` 工具类，可以自动识别用户输入是中文还是英文
   - 基于中文字符在文本中的比例进行检测，简单而有效

2. **动态Prompt选择**：
   - 修改了 `AIManager` 类，使其能够根据检测到的语言选择相应的Prompt
   - 从项目根目录读取 `Prompt_en.md` 和 `Prompt_zh.md` 文件
   - 如果文件不存在，则回退使用默认的系统Prompt

## 使用方法

1. 确保项目根目录中存在 `Prompt_en.md` 和 `Prompt_zh.md` 文件
2. 系统会自动检测用户输入的语言：
   - 当检测到中文输入时，使用 `Prompt_zh.md` 中的内容作为系统Prompt
   - 当检测到英文输入时，使用 `Prompt_en.md` 中的内容作为系统Prompt

## 工作原理

1. 在 `AIManager` 构造函数中加载中文和英文Prompt文件
2. 在 `getAnswerForQuestion` 方法中使用 `LanguageDetector.detectLanguage()` 检测问题的语言
3. 根据检测结果选择相应的Prompt内容
4. 在QA输出文件中记录检测到的语言，便于调试

## 优点

1. 无需手动切换Prompt，系统会根据用户输入自动选择
2. 兼容现有代码结构，不影响其他功能
3. 语言检测算法简单有效，专注于中英文区分
4. 错误处理机制确保在文件加载失败时有合理的回退方案