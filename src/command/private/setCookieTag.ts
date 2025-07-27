import { PrivateCommand } from '../../interface/command';
import { modifyOrAddEACookie, setTag } from '../../qq/cookieManager';
import { sendMsgToQQFriend } from '../../qq/sendMessage';
import { padString } from '../../utils/stringTool';

export class SetCookiePrivateCommand implements PrivateCommand {
    regexContent = 'main=ID';
    description = '通过该账号查询';
    regex = /^main(=|＝)(\S+)$/;

    regexContent2 = 'platoon=ID';
    description2 = '战排自动审核';
    regex2 = /^platoon(=|＝)(\S+)$/;

    regexContent3 = 'cookie=ID qq号 sid';
    description3 = '\n设置他人的Cookie';
    regex3 = /^cookie(=|＝)(\S+) (\d+) (\S+)$/;

    adminLevel = 3;

    isMatch(command: string): boolean {
        return this.regex.test(command) || this.regex2.test(command) || this.regex3.test(command);
    }

    getInfo(): string {
        const content1 = padString(this.regexContent, this.description, 30);
        const content2 = padString(this.regexContent2, this.description2, 30);
        const content3 = padString(this.regexContent3, this.description3, 30);
        const content = content1 + '\n' + content2 + '\n' + content3;
        return content;
    }

    async execute(command: string, message_id: number, user_id: number): Promise<any> {
        if (this.regex.test(command)) {
            const playerName = command.match(this.regex)![2];
            const result = await setTag(playerName, 'EA查询');
            sendMsgToQQFriend(result + "\n注:可能存在风险, 建议使用小号", user_id);

        } else if (this.regex2.test(command)) {

        } else if (this.regex3.test(command)) {
            const playerName = command.match(this.regex3)![2];
            const qqNumber = parseInt(command.match(this.regex3)![3]);
            const sid = command.match(this.regex3)![4];
            const result = await modifyOrAddEACookie(qqNumber, playerName, sid);
            sendMsgToQQFriend(result, user_id);
        }
    }
}