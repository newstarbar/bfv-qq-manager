import { Command } from '../../interface/command';
import { refreshMemberInfo } from '../../qq/memberManager';
import { sendMsgToQQGroup } from '../../qq/sendMessage';
import { padString } from '../../utils/stringTool';

export class UpdateCommand implements Command {
    regexContent = 'update';
    description = '刷新群成员数据库';
    adminLevel = 1;

    isMatch(command: string): boolean {
        return command.toLowerCase() === this.regexContent;
    }

    getInfo(): string {
        const content = padString(this.regexContent, this.description, 34);
        return content;
    }

    async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
        const result = await refreshMemberInfo(group_id);
        sendMsgToQQGroup(group_id, result, message_id);
    }
}