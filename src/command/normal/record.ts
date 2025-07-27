import { Command } from '../../interface/command';
import { sendMsgToQQGroup } from '../../qq/sendMessage';
import { getPlayerDetailRecord, getPlayerRecord } from '../../robot/player/playerRecord';
import { padString } from '../../utils/stringTool';

export class RecordCommand implements Command {
    regexContent = 'record=昵称';
    description = '查看战绩';
    regex = /^record(=|＝)(\S+)( (\d+))?$/;

    regexContent2 = 'detail=昵称';
    description2 = '查看详细战绩';
    regex2 = /^detail(=|＝)(\S+)( (\d+))?$/;

    adminLevel = 0;

    isMatch(command: string): boolean {
        // 正则匹配
        return this.regex.test(command) || this.regex2.test(command);
    }

    getInfo(): string {
        // 总共20个字符，中间用空格补齐
        const content = padString(this.regexContent, this.description, 33);
        const content2 = padString(this.regexContent2, this.description2, 33);
        return content + '\n' + content2;
    }

    async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
        if (this.regex.test(command)) {
            const playerName = command.match(this.regex)![2];
            const count = parseInt(command.match(this.regex)![4]) || 5;
            const result = await getPlayerRecord(playerName, count);
            sendMsgToQQGroup(group_id, result, message_id);


        } else if (this.regex2.test(command)) {
            const playerName = command.match(this.regex2)![2];
            const count = parseInt(command.match(this.regex2)![4]) || 5;
            const result = await getPlayerDetailRecord(playerName, count);
            sendMsgToQQGroup(group_id, result, message_id);

        }
    }
}