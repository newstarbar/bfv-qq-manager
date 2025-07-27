import { Command } from '../../interface/command';
import { sendMsgToQQGroup } from '../../qq/sendMessage';
import { getWarmTime, setOnWarmMode, setWarmTime } from '../../qq/timeManager';
import { padString } from '../../utils/stringTool';

export class CurfewCommand implements Command {
    regexContent = 'cf=1/0';
    description = '宵禁开/关';
    regex = /^cf(=|＝)(1|0)$/;

    regexContent2 = 'cft=23:30-8:00';
    description2 = '设置宵禁时间';
    regex2 = /^cft(=|＝)(\d{1}|\d{2}):(\d{1}|\d{2})-(\d{1}|\d{2}):(\d{1}|\d{2})$/;

    adminLevel = 2;

    isMatch(command: string): boolean {
        return this.regex.test(command) || this.regex2.test(command);
    }

    getInfo(): string {
        // 总共20个字符，中间用空格补齐
        const content1 = padString(this.regexContent, this.description, 32);
        const content2 = padString(this.regexContent2, this.description2, 32);
        const content = content1 + '\n' + content2;
        return content;
    }

    async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
        if (this.regex.test(command)) {
            const enable = command.match(this.regex)![2];
            setOnWarmMode(enable === '1');
            const time = getWarmTime();
            let content = "";
            if (enable === '1') {
                content = `已开启宵禁功能\n时间: ${time}`;
            } else {
                content = `已关闭宵禁功能`;
            }
            await sendMsgToQQGroup(group_id, content, message_id);
        } else if (this.regex2.test(command)) {
            const stopHour = parseInt(command.match(this.regex2)![2]);
            const stopMinute = parseInt(command.match(this.regex2)![3]);
            const startHour = parseInt(command.match(this.regex2)![4]);
            const startMinute = parseInt(command.match(this.regex2)![5]);
            setWarmTime(stopHour, stopMinute, startHour, startMinute);
            const time = getWarmTime();
            const content = `已设置宵禁时间为: ${time}`;
            await sendMsgToQQGroup(group_id, content, message_id);
        }
    }
}