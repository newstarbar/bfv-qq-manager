import { Command } from '../../interface/command';
import { sendMsgToQQGroup } from '../../qq/sendMessage';
import { initServerRestart } from '../../robot/serverManager';
import { padString } from '../../utils/stringTool';

export class CheckCommand implements Command {
    regexContent = 'check';
    description = '刷新所有服务器';
    adminLevel = 1;

    isMatch(command: string): boolean {
        return command.toLowerCase() === this.regexContent;
    }

    getInfo(): string {
        const content = padString(this.regexContent, this.description, 34);
        return content;
    }

    async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
        const result = await initServerRestart();
        sendMsgToQQGroup(group_id, result, message_id);
    }
}