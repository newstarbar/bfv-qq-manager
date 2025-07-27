import { Command } from '../../interface/command';
import { sendMsgToQQGroup } from '../../qq/sendMessage';
import { updateBotList } from '../../robot/player/botManager';
import { padString } from '../../utils/stringTool';

export class UpdateBotCommand implements Command {
    regexContent = '直接转发名单'
    description = '更新bot名单';
    regex = /^(\S+)\s(\d{1}\d{1})?(In\sthe\smenus|game\sclose|(Breakthrough|Conquest)|风控)?.*(在服务器中|空闲|加入中)$/;

    adminLevel = 2;

    isMatch(command: string): boolean {
        let count = 0;
        const strList = command.split('\n');
        for (const str of strList) {
            if (this.regex.test(str)) {
                count++;
            }
        }
        return count > 10;
    }

    getInfo(): string {
        // 总共20个字符，中间用空格补齐
        const content = padString(this.regexContent, this.description, 32);
        return content;
    }

    async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
        const result = await updateBotList(command);
        sendMsgToQQGroup(group_id, result, message_id);
    }
}