import { Command } from '../../interface/command';
import { sendMsgToQQGroup } from '../../qq/sendMessage';
import { agreeApplication, getAllMember, getPlatoon, kickMember, refuseApplication, registerPlatoon } from '../../robot/platoonApprove';
import { padString } from '../../utils/stringTool';

export class PlatoonCommand implements Command {
    regexContent = 'platoon=玩家名 战排简称';
    description = '注册';
    regex = /^platoon(=|＝)(\S+) (\S+)$/;

    regexContent2 = 'mlist=战排';
    description2 = '所有成员';
    regex2 = /^mlist(=|＝)(\S+)$/;

    regexContent3 = 'alist=战排';
    description3 = '申请人列表';
    regex3 = /^alist(=|＝)(\S+)$/;

    regexContent4 = 'agree=战排 pID';
    description4 = '同意加入';
    regex4 = /^agree(=|＝)(\S+) (\d+)$/;

    regexContent5 = 'reject=战排 pID';
    description5 = '拒绝加入';
    regex5 = /^reject(=|＝)(\S+) (\d+)$/;

    regexContent6 = 'kick=战排 pID';
    description6 = '踢出战队';
    regex6 = /^kick(=|＝)(\S+) (\d+)$/;

    adminLevel = 2;

    isMatch(command: string): boolean {
        // 正则匹配
        return this.regex.test(command) || this.regex2.test(command) || this.regex3.test(command) || this.regex4.test(command) || this.regex5.test(command) || this.regex6.test(command);
    }

    getInfo(): string {
        // 总共20个字符，中间用空格补齐
        const content1 = padString(this.regexContent, this.description, 34);
        const content2 = padString(this.regexContent2, this.description2, 34);
        const content3 = padString(this.regexContent3, this.description3, 34);
        const content4 = padString(this.regexContent4, this.description4, 34);
        const content5 = padString(this.regexContent5, this.description5, 34);
        const content6 = padString(this.regexContent6, this.description6, 34);
        const content = content1 + '\n' + content2 + '\n' + content3 + '\n' + content4 + '\n' + content5 + '\n' + content6;
        return content;
    }

    async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
        if (this.regex.test(command)) {
            const playerName = command.match(this.regex)![2];
            const tag = command.match(this.regex)![3];
            const result = await registerPlatoon(playerName, tag);
            sendMsgToQQGroup(group_id, result, message_id);

        } else if (this.regex2.test(command)) {
            const tag = command.match(this.regex2)![2];
            const result = await getAllMember(tag);
            sendMsgToQQGroup(group_id, result, message_id);

        } else if (this.regex3.test(command)) {
            const tag = command.match(this.regex3)![2];
            const result = await getPlatoon(tag);
            sendMsgToQQGroup(group_id, result, message_id);

        } else if (this.regex4.test(command)) {
            const tag = command.match(this.regex4)![2];
            const personaId = parseInt(command.match(this.regex4)![3]);
            const result = await agreeApplication(tag, personaId);
            sendMsgToQQGroup(group_id, result, message_id);

        } else if (this.regex5.test(command)) {
            const tag = command.match(this.regex5)![2];
            const personaId = parseInt(command.match(this.regex5)![3]);
            const result = await refuseApplication(tag, personaId);
            sendMsgToQQGroup(group_id, result, message_id);

        } else if (this.regex6.test(command)) {
            const tag = command.match(this.regex6)![2];
            const personaId = parseInt(command.match(this.regex6)![3]);
            const result = await kickMember(tag, personaId);
            sendMsgToQQGroup(group_id, result, message_id);

        }
    }
}