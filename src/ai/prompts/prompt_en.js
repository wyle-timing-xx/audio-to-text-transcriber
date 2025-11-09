// 英文系统提示词 - 从根目录直接读取
import fs from 'fs';
import path from 'path';

// 读取根目录的 Prompt_en.md 文件内容
const promptPath = path.resolve(process.cwd(), 'Prompt_en.md');
const promptContent = fs.readFileSync(promptPath, 'utf8');

export default promptContent;