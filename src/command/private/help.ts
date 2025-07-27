import { PrivateCommand } from '../../interface/command';
import { padString } from '../../utils/stringTool';

export class HelpPrivateCommand implements PrivateCommand {
    regexContent = 'help';
    description = '显示帮助信息';
    adminLevel = 1;

    isMatch(command: string): boolean {
        // 该类只做占位无实际功能，因此这里不做任何处理
        return command === this.regexContent;
    }

    getInfo(): string {
        // 该类只做占位无实际功能，因此这里不做任何处理
        const content = padString(this.regexContent, this.description, 30);
        return content;
    }

    async execute(command: string, message_id: number, user_id: number): Promise<any> {
        // 该类只做占位无实际功能，因此这里不做任何处理
        return null;
    }
}