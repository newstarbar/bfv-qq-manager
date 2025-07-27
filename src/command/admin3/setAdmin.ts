import { Command } from '../../interface/command';
import { setAdmin } from '../../qq/memberManager';
import { sendMsgToQQGroup } from '../../qq/sendMessage';
import { padString } from '../../utils/stringTool';

export class SetAdminCommand implements Command {
    regexContent = 'admin=qq号 级别';
    description = '设置管理身份';
    regex = /^admin(=|＝)(\d+) (\d{1})$/;

    adminLevel = 3;

    isMatch(command: string): boolean {
        // 正则匹配
        return this.regex.test(command);
    }

    getInfo(): string {
        const content = padString(this.regexContent, this.description, 28);
        return content;
    }

    async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
        const qq_id = parseInt(command.match(this.regex)![2]);
        const admin_level = parseInt(command.match(this.regex)![3]);
        const result = await setAdmin(group_id, qq_id, admin_level);
        const isNeedQQ = result[0] ? qq_id : null;
        sendMsgToQQGroup(group_id, `=======设置管理员=======\nQQ: ${qq_id}\n${result[1]}`, message_id, isNeedQQ);
    }
}