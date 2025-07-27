import { Command } from '../../interface/command';
import { sendMsgToQQFriend, sendMsgToQQGroup } from '../../qq/sendMessage';
import { padString } from '../../utils/stringTool';

const runrun_qq: number = 2854211804;
const tvbot_qq: number = 3889013937;

export class SuperCommand implements Command {
    regexContent = 'super=指令';
    description = '超级权限指令';
    regex = /^super(=|＝)(.*)$/;

    regexContent2 = 'tvsuper=指令';
    description2 = '超级权限指令';
    regex2 = /^tvsuper(=|＝)(.*)$/;

    adminLevel = 2;

    isMatch(command: string): boolean {
        // 正则匹配
        return this.regex.test(command) || this.regex2.test(command);
    }

    getInfo(): string {
        // 总共20个字符，中间用空格补齐
        const content1 = padString(this.regexContent, this.description, 34);
        const content2 = padString(this.regexContent2, this.description2, 34);
        return content1 + '\n' + content2;
    }

    async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
        if (this.regex.test(command)) {
            const commandStr = command.match(this.regex)![2];
            sendMsgToQQFriend(commandStr, runrun_qq);
            sendMsgToQQGroup(group_id, `已成功想RunRun发送指令\n${commandStr}\n该命令为直接转发命令\n不会有任何反馈信息\n踢人时无任何记录\n请谨慎使用`, message_id, runrun_qq);

        } else if (this.regex2.test(command)) {
            const commandStr = command.match(this.regex2)![2];
            sendMsgToQQFriend(commandStr, tvbot_qq);
            sendMsgToQQGroup(group_id, `已成功想TVBot发送指令\n${commandStr}\n该命令为直接转发命令\n不会有任何反馈信息\n踢人时无任何记录\n请谨慎使用`, message_id, runrun_qq);
        }
    }
}