import { Command } from '../../interface/command';
import { padString } from '../../utils/stringTool';

export class PlatoonSystemCommand implements Command {
    regexContent = '';
    description = '';
    adminLevel = 3;

    isMatch(command: string): boolean {
        return command === this.regexContent;
    }

    getInfo(): string {
        // 总共20个字符，中间用空格补齐
        const content = padString(this.regexContent, this.description, 34);
        return content;
    }

    async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
    }
}