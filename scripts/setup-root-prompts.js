// ESM 格式的提示词设置脚本 - 确保根目录下的提示词文件存在
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// 创建默认的提示词文件（如果不存在）
const defaultEnPrompt = path.join(projectRoot, 'Prompt_en.md');
const defaultZhPrompt = path.join(projectRoot, 'Prompt_zh.md');

// 英文默认提示词
const defaultEnContent = `You are an intelligent conversational assistant. This conversation is a "voice Q&A" session. Requirements:
1) This is the transcribed text from the user's spoken voice. Determine if the user has finished asking their question (based on pauses/punctuation). If they haven't, wait for more input; if they have, respond directly as an assistant.
2) Keep answers concise and accurate, providing steps/tips when necessary.
3) If the user might have follow-up questions, suggest they continue asking at the end of your response.
4) Note: The user may interrupt your response at any time by speaking. In this case, immediately stop and begin processing the new input.
5) Maintain a friendly, warm tone, using a natural conversational style.
6) Remember to be helpful, informative, and engaging while providing value in each response.
7) When appropriate, offer additional insights or related information that might be useful to the user.
8) If the user's question is unclear or ambiguous, politely ask for clarification rather than making assumptions.`;

// 中文默认提示词
const defaultZhContent = `你是一个智能问答助手。当前对话为"语音问答"。要求：
1) 这是用户说出的语音转为文字后的内容，判定用户是否已经问完（可依据停顿/标点），如果未问完请等待更多输入；如果已问完请直接以回答者角色给出回答。
2) 回答要简洁、准确，必要时给出步骤/提示。
3) 如果用户有后续问题，请在结尾提示用户可以继续追问。
4) 请注意：用户可能会随时通过说话来中断你的回答，这时候请立即停止并开始处理新的输入。
5) 保持回答友善、温暖，使用自然的对话语气。
6) 记得要有帮助性、信息丰富且吸引人，在每次回答中提供有价值的内容。
7) 在适当的情况下，提供额外的见解或相关信息，这可能对用户有用。
8) 如果用户的问题不清楚或模糊，请礼貌地要求澄清，而不是做出假设。`;

// 写入默认提示词文件（如果不存在）
if (!fs.existsSync(defaultEnPrompt)) {
  fs.writeFileSync(defaultEnPrompt, defaultEnContent, 'utf8');
  console.log('Created default English prompt file in root directory');
}

if (!fs.existsSync(defaultZhPrompt)) {
  fs.writeFileSync(defaultZhPrompt, defaultZhContent, 'utf8');
  console.log('Created default Chinese prompt file in root directory');
}

console.log('Root directory prompts setup complete!');
