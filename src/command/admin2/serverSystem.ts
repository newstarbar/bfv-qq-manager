import { Command } from '../../interface/command';
import { padString } from '../../utils/stringTool';

export class ServerSystemCommand implements Command {
    regexContent = 'start=序号'
    description = '开启指定服管';
    regex = /^start(=|＝)(\S+)$/;

    regexContent2 = 'stop=序号'
    description2 = '关闭指定服管';
    regex2 = /^stop(=|＝)(\S+)$/;

    adminLevel = 2;

    isMatch(command: string): boolean {
        return this.regex.test(command) || this.regex2.test(command);
    }

    getInfo(): string {
        // 总共20个字符，中间用空格补齐
        const content2 = padString(this.regexContent, this.description, 34);
        const content3 = padString(this.regexContent2, this.description2, 34);
        const content = content2 + '\n' + content3;
        return content;
    }

    async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
    }
}