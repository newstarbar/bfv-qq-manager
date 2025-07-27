import { PrivateCommand } from '../../interface/command';
import { deleteEACookie, modifyOrAddEACookie } from '../../qq/cookieManager';
import { getMemberInfo } from '../../qq/memberManager';
import { sendMsgToQQFriend } from '../../qq/sendMessage';
import { padString } from '../../utils/stringTool';

export class CookiePrivateCommand implements PrivateCommand {
    regexContent = 'sid=内容';
    description = '更新cookie';
    regex = /^sid(=|＝)(\S+)$/;

    regexContent2 = 'unbind';
    description2 = '解除绑定';
    regex2 = /^unbind$/;

    adminLevel = 1;

    isMatch(command: string): boolean {
        return this.regex.test(command) || this.regex2.test(command);
    }

    getInfo(): string {
        const content1 = padString(this.regexContent, this.description, 30);
        const content2 = padString(this.regexContent2, this.description2, 30);
        const content = content1 + '\n' + content2;
        return content;
    }

    async execute(command: string, message_id: number, user_id: number): Promise<any> {
        if (this.regex.test(command)) {
            const sid = command.match(this.regex)![2];
            const player = await getMemberInfo(null, user_id, null);
            const playerName = player[0].player_name;
            const result = await modifyOrAddEACookie(user_id, playerName, sid);
            sendMsgToQQFriend(result, user_id);

        } else if (this.regex2.test(command)) {
            const result = await deleteEACookie(user_id);
            sendMsgToQQFriend(result, user_id);
        }
    }
}