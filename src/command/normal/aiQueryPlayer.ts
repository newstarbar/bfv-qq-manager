import { Command } from '../../interface/command';
import { sendMsgToQQGroup } from '../../qq/sendMessage';
import { generateAIRecordString } from '../../robot/cx/cxImage';
import { padString } from '../../utils/stringTool';

export class AiQueryPlayerCommand implements Command {
    regexContent = 'aicx=昵称';
    description = 'AI辅助分析';
    regex = /^aicx(=|＝)(\S+)$/;
    adminLevel = 0;

    isMatch(command: string): boolean {
        // 正则匹配
        return this.regex.test(command);
    }

    getInfo(): string {
        // 总共20个字符，中间用空格补齐
        const content = padString(this.regexContent, this.description, 34);
        return content;
    }

    async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
        const playerName = command.match(this.regex)![2];
        // 调用AI接口分析
        const result = await generateAIRecordString(playerName);
        sendMsgToQQGroup(group_id, result, message_id);
    }
}