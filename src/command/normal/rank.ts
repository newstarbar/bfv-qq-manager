import { Command } from '../../interface/command';
import { padString } from '../../utils/stringTool';

export class RankCommand implements Command {
    regexContent = 'rank=日期';
    description = '当日排行榜';
    adminLevel = 0;

    isMatch(command: string): boolean {
        // 正则匹配
        return /^rank((=|＝)(\d{4}-\d{2}-\d{2}))?$/.test(command);
    }

    getInfo(): string {
        // 总共20个字符，中间用空格补齐
        const content = padString(this.regexContent, this.description, 34);
        return content;
    }

    async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
    }
}