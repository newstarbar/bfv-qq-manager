import { Command } from '../../interface/command';
import { padString } from '../../utils/stringTool';

export class TrackPlayerCommand implements Command {
    regexContent = 'tk=昵称';
    description = '追踪扫描玩家';

    regexContent2 = 'tkp=战排';
    description2 = '扫描战排玩家';
    adminLevel = 0;

    isMatch(command: string): boolean {
        // 正则匹配
        return /^tk(=|＝)(\S+)$/.test(command) || /^tkp(=|＝)(\S+)$/.test(command);
    }

    getInfo(): string {
        // 总共20个字符，中间用空格补齐
        // const content1 = padString(this.regexContent, this.description, 34);
        // const content2 = padString(this.regexContent2, this.description2, 34);
        // const content = content1 + '\n' + content2;
        // return content;
        return "";
    }

    async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
    }
}