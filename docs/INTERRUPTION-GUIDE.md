# 🔄 中断功能增强指南

本指南介绍了音频转文本转录器中的增强中断功能，使您能够在 AI 回答过程中随时插入新问题，实现更自然流畅的对话体验。

## 📋 功能概述

最新版本引入了**即时中断**机制，能够在检测到用户开始说话时立即中断 AI 的回答，无需等待延迟确认。此功能大幅提升对话的自然度，模拟真实人类对话的交互方式。

## ⚙️ 主要配置选项

在 `.env` 文件中可以找到以下与中断相关的配置：

```env
# 中断功能配置
ALLOW_INTERRUPTION=true              # 是否允许中断 AI 回答
IMMEDIATE_INTERRUPT=true             # 是否立即中断（无需等待）
INTERRUPTION_DETECTION_MS=300        # 传统中断检测时间（毫秒）
INTERRUPTION_COOLDOWN_MS=500         # 中断冷却时间（毫秒）

# 中断视觉反馈配置
INTERRUPT_VISUAL_FEEDBACK=true       # 是否启用中断视觉反馈
INTERRUPT_USE_COLORS=true            # 使用彩色标记突出显示中断
INTERRUPT_PREFIX=🔴                   # 中断时的前缀标记
INTERRUPT_SUFFIX=🔴                   # 中断时的后缀标记

# 音频活动检测配置
AUDIO_ACTIVITY_DETECTION=true        # 是否启用音频活动检测
SILENCE_THRESHOLD_MS=500             # 超过该时间没有输入视为静默（毫秒）
ACTIVITY_CHECK_INTERVAL_MS=200       # 音频活动检测间隔（毫秒）
```

## 🛠️ 中断模式对比

本系统提供两种中断模式：

### 1. 即时中断模式 (推荐)

```env
IMMEDIATE_INTERRUPT=true
```

- ✅ 检测到任何音频输入立即中断 AI 回答
- ✅ 无需等待确认，响应更快
- ✅ 类似真实对话中的打断体验
- ⚠️ 可能对背景噪音敏感（可通过冷却期缓解）

### 2. 传统延迟中断模式

```env
IMMEDIATE_INTERRUPT=false
```

- ✅ 等待一定时间（由 `INTERRUPTION_DETECTION_MS` 控制）确认中断
- ✅ 更抗干扰，减少误触发
- ⚠️ 响应稍慢，中断体验不如即时模式自然

## 🔧 调整灵敏度

### 如果中断过于灵敏

如果系统过于敏感，经常误触发中断：

```env
# 增加冷却期
INTERRUPTION_COOLDOWN_MS=1000

# 使用传统延迟中断
IMMEDIATE_INTERRUPT=false

# 增加静默阈值
SILENCE_THRESHOLD_MS=800
```

### 如果中断不够灵敏

如果系统反应迟钝，难以中断 AI：

```env
# 启用即时中断
IMMEDIATE_INTERRUPT=true

# 减少冷却期
INTERRUPTION_COOLDOWN_MS=300

# 减少静默阈值
SILENCE_THRESHOLD_MS=300

# 增加检测频率
ACTIVITY_CHECK_INTERVAL_MS=100
```

## 💡 使用技巧

1. **短暂发声即可中断**: 当 AI 回答时，只需开始说话，系统会立即检测并中断 AI
2. **中断后等待**: 中断后等待几百毫秒，让系统完成中断处理
3. **视觉反馈**: 注意控制台中的视觉标记（默认 🔴），指示中断状态
4. **冷却期**: 一次中断后有短暂冷却期，防止连续中断，等待约 500ms 再次中断

## 🎯 应用场景

- **教学互动**: 学生可以随时中断 AI 解释，请求澄清或提供额外信息
- **会议助手**: 在 AI 总结某个观点时，可以立即插入新的讨论点
- **头脑风暴**: 与 AI 协作时，灵感来了可以立即打断并追加想法
- **复杂问题**: 当 AI 回答偏离主题时，立即纠正方向

## 📈 最佳实践

- **调整 AI 提示词**: 在 `AI_SYSTEM_PROMPT` 中告知 AI 用户可能会中断它
- **音频环境**: 在安静环境中使用以减少误触发
- **找到最佳平衡点**: 通过调整参数找到灵敏度与稳定性的最佳平衡

---

我们希望这些增强的中断功能能够帮助您实现更自然流畅的语音对话体验！如有问题或建议，欢迎提交 Issue。