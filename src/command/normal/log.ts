import { Command } from '../../interface/command';
import { sendMsgToQQGroup } from '../../qq/sendMessage';
import { getServerLog } from '../../robot/player/serverPlayerManager';
import { padString } from '../../utils/stringTool';

export class LogCommand implements Command {
    regexContent = 'log=序号 条数';
    description = '查看日志';
    regex = /^log(=|＝)(\S+) (\d+)$/;
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
        const tag = command.match(this.regex)![2];
        const count = parseInt(command.match(this.regex)![3]);
        const logStr = getServerLog(tag, count);
        sendMsgToQQGroup(group_id, logStr, message_id);
    }
}