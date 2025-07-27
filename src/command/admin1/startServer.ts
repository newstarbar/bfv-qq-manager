import { Command } from '../../interface/command';
import { startServerCommand } from '../../robot/serverManager';
import { padString } from '../../utils/stringTool';

export class StartServerCommand implements Command {
    regexContent = 'kf=序号';
    description = '开服指令';
    regex = /^kf(=|＝)(\S+)$/;
    adminLevel = 1;

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
        const serverTag = command.match(this.regex)![2];
        await startServerCommand(serverTag, group_id, message_id);
    }
}