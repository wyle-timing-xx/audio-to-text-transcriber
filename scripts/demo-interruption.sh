#!/bin/bash

# 中断功能演示脚本
# 此脚本用于演示不同中断设置的效果

# 颜色定义
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== 音频转录器中断功能演示 ===${NC}\n"

# 检查必要工具
command -v npm >/dev/null 2>&1 || { echo -e "${RED}错误: 需要 npm 但未安装.${NC}" >&2; exit 1; }

# 检查项目文件
if [ ! -f "package.json" ]; then
  echo -e "${RED}错误: 找不到 package.json. 请在项目根目录运行此脚本.${NC}"
  exit 1
fi

# 检查 .env 文件
if [ ! -f ".env" ]; then
  echo -e "${YELLOW}警告: 找不到 .env 文件. 将创建一个基于 .env.example${NC}"
  if [ -f ".env.example" ]; then
    cp .env.example .env
    echo -e "${GREEN}已创建 .env 文件. 请编辑填入您的 API 密钥.${NC}"
  else
    echo -e "${RED}错误: 找不到 .env.example 文件.${NC}"
    exit 1
  fi
fi

# 提示用户设置 API 密钥
echo -e "${YELLOW}请确保在 .env 文件中设置了必要的 API 密钥.${NC}"
read -p "按 Enter 继续..." 

# 选择中断模式
echo -e "\n${BLUE}选择中断模式:${NC}"
echo "1) 即时中断模式 (检测到音频立即中断)"
echo "2) 传统延迟中断模式 (等待确认后中断)"
echo "3) 无中断模式 (禁用中断功能)"

read -p "请选择 [1-3]: " mode_choice

case $mode_choice in
  1)
    echo -e "\n${GREEN}设置即时中断模式...${NC}"
    sed -i.bak 's/^ALLOW_INTERRUPTION=.*/ALLOW_INTERRUPTION=true/' .env
    sed -i.bak 's/^IMMEDIATE_INTERRUPT=.*/IMMEDIATE_INTERRUPT=true/' .env
    sed -i.bak 's/^INTERRUPTION_COOLDOWN_MS=.*/INTERRUPTION_COOLDOWN_MS=500/' .env
    echo -e "${YELLOW}提示: 此模式下，只要检测到音频输入就会立即中断 AI 回答${NC}"
    ;;
  2)
    echo -e "\n${GREEN}设置传统延迟中断模式...${NC}"
    sed -i.bak 's/^ALLOW_INTERRUPTION=.*/ALLOW_INTERRUPTION=true/' .env
    sed -i.bak 's/^IMMEDIATE_INTERRUPT=.*/IMMEDIATE_INTERRUPT=false/' .env
    sed -i.bak 's/^INTERRUPTION_DETECTION_MS=.*/INTERRUPTION_DETECTION_MS=300/' .env
    echo -e "${YELLOW}提示: 此模式下，系统会等待 300ms 确认后再中断 AI 回答${NC}"
    ;;
  3)
    echo -e "\n${GREEN}禁用中断功能...${NC}"
    sed -i.bak 's/^ALLOW_INTERRUPTION=.*/ALLOW_INTERRUPTION=false/' .env
    echo -e "${YELLOW}提示: 中断功能已禁用，AI 将完成整个回答${NC}"
    ;;
  *)
    echo -e "${RED}无效选择${NC}"
    exit 1
    ;;
esac

# 选择视觉反馈
echo -e "\n${BLUE}配置视觉反馈:${NC}"
echo "1) 启用视觉反馈 (中断时突出显示文本)"
echo "2) 禁用视觉反馈"

read -p "请选择 [1-2]: " feedback_choice

case $feedback_choice in
  1)
    echo -e "\n${GREEN}启用视觉反馈...${NC}"
    sed -i.bak 's/^INTERRUPT_VISUAL_FEEDBACK=.*/INTERRUPT_VISUAL_FEEDBACK=true/' .env
    sed -i.bak 's/^INTERRUPT_USE_COLORS=.*/INTERRUPT_USE_COLORS=true/' .env
    
    echo -e "\n${BLUE}选择视觉标记风格:${NC}"
    echo "1) 默认: 🔴 文本 🔴"
    echo "2) 简约: ⚡ 文本 ⚡"
    echo "3) 方括号: [文本]"
    
    read -p "请选择 [1-3]: " style_choice
    
    case $style_choice in
      1)
        sed -i.bak 's/^INTERRUPT_PREFIX=.*/INTERRUPT_PREFIX=🔴/' .env
        sed -i.bak 's/^INTERRUPT_SUFFIX=.*/INTERRUPT_SUFFIX=🔴/' .env
        ;;
      2)
        sed -i.bak 's/^INTERRUPT_PREFIX=.*/INTERRUPT_PREFIX=⚡/' .env
        sed -i.bak 's/^INTERRUPT_SUFFIX=.*/INTERRUPT_SUFFIX=⚡/' .env
        ;;
      3)
        sed -i.bak 's/^INTERRUPT_PREFIX=.*/INTERRUPT_PREFIX=\[/' .env
        sed -i.bak 's/^INTERRUPT_SUFFIX=.*/INTERRUPT_SUFFIX=\]/' .env
        ;;
      *)
        echo -e "${RED}无效选择，使用默认风格${NC}"
        sed -i.bak 's/^INTERRUPT_PREFIX=.*/INTERRUPT_PREFIX=🔴/' .env
        sed -i.bak 's/^INTERRUPT_SUFFIX=.*/INTERRUPT_SUFFIX=🔴/' .env
        ;;
    esac
    ;;
  2)
    echo -e "\n${GREEN}禁用视觉反馈...${NC}"
    sed -i.bak 's/^INTERRUPT_VISUAL_FEEDBACK=.*/INTERRUPT_VISUAL_FEEDBACK=false/' .env
    ;;
  *)
    echo -e "${RED}无效选择${NC}"
    exit 1
    ;;
esac

# 提示中断功能使用方法
echo -e "\n${BLUE}=== 中断功能使用说明 ===${NC}"
echo -e "${GREEN}1. 启动应用后，开始说话提出问题${NC}"
echo -e "${GREEN}2. AI 开始回答后，再次说话即可中断 AI${NC}"
echo -e "${GREEN}3. 尝试不同的延迟和时机，感受中断效果${NC}"
echo -e "${GREEN}4. 通过调整 .env 文件中的配置进一步优化体验${NC}"

# 询问是否启动应用
echo -e "\n${BLUE}是否现在启动应用?${NC}"
read -p "y/n: " start_app

if [ "$start_app" = "y" ] || [ "$start_app" = "Y" ]; then
  echo -e "\n${GREEN}启动音频转录器...${NC}"
  echo -e "${YELLOW}按 Ctrl+C 停止应用${NC}\n"
  npm start
else
  echo -e "\n${GREEN}配置已保存. 使用 'npm start' 启动应用.${NC}"
fi

# 移除备份文件
rm -f .env.bak

exit 0