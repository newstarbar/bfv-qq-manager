import { Command } from '../../interface/command';
import { sendMsgToQQGroup } from '../../qq/sendMessage';
import { isWarmPlayer } from '../../robot/hs/warmServer';
import logger from '../../utils/logger';
import { padString } from '../../utils/stringTool';

export class WarmCommand implements Command {
    regexContent = 'warm=ID';
    description = '查看暖服记录';
    regex = /^warm(=|＝)(\S+)$/;
    adminLevel = 0;

    isMatch(command: string): boolean {
        return this.regex.test(command);
    }

    getInfo(): string {
        // 总共20个字符，中间用空格补齐
        const content = padString(this.regexContent, this.description, 34);
        return content;
    }

    async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
        const playerName = command.match(this.regex)![2];
        const { isWarm, time, hour } = await isWarmPlayer(playerName);
        let content = `=======暖服记录========\n【玩家】: ${playerName}\n`;
        if (isWarm) {
            content += "暖服权益生效中";
            content += `【剩余时长】：${hour}小时\n`;
            content += `【暖服时间】：${time}\n`;
        } else if (!isWarm && time == "") {
            content += "\n没有任何暖服记录";
        } else {
            content += "暖服权益已过期";
            content += `【剩余时长】：${hour}小时\n`;
            content += `【暖服时间】：${time}\n`;
        }
        sendMsgToQQGroup(group_id, content, message_id);
    }
}