import { Command } from '../../interface/command';
import { getAllCookie } from '../../qq/cookieManager';
import { sendMsgToQQGroup } from '../../qq/sendMessage';
import { padString } from '../../utils/stringTool';

export class CookieCommand implements Command {
    regexContent = 'cookie';
    description = '管理cookie状态';
    adminLevel = 1;

    isMatch(command: string): boolean {
        return command.toLowerCase() === this.regexContent;
    }

    getInfo(): string {
        // 总共20个字符，中间用空格补齐
        const content = padString(this.regexContent, this.description, 34);
        return content;
    }

    async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
        const cookies = await getAllCookie(false);
        let content = '=======Cookie状态=======\n';
        for (const cookie of cookies) {
            const { player_name, is_valid, tag } = cookie;
            const valid = is_valid === 1 ? '已验证' : '过期';
            const tagStr = tag === '' ? '' : `${tag}`;
            content += `[${valid}] ${player_name} ${tagStr}\n`;
        }
        content += '======================';
        sendMsgToQQGroup(group_id, content, message_id);
    }
}