import { Command } from '../../interface/command';
import { setEnable } from '../../qq/aiSay/aiManager';
import { sendMsgToQQGroup } from '../../qq/sendMessage';
import { padString } from '../../utils/stringTool';

export class EnableAiCommand implements Command {
    regexContent = 'ai=1/0'
    description = '开启/关闭ai';
    regex = /^ai(=|＝)(1|0)$/;

    adminLevel = 2;

    isMatch(command: string): boolean {
        return this.regex.test(command);
    }

    getInfo(): string {
        // 总共20个字符，中间用空格补齐
        const content = padString(this.regexContent, this.description, 32);
        return content;
    }

    async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
        const enable = command.match(this.regex)![2];
        setEnable(enable === '1');
        const content = `已${enable === '1' ? '开启' : '关闭'}ai`;
        await sendMsgToQQGroup(group_id, content, message_id);
    }
}