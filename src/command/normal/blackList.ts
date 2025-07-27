import { Command } from '../../interface/command';
import { sendGroupTxtFile } from '../../qq/groupService';
import { sendMsgToQQGroup } from '../../qq/sendMessage';
import { getAllGlobalBlackList, getAllLocalBlackList, getAllTempBlackList } from '../../robot/ban/backListManager';
import { readConfigFile } from '../../utils/localFile';
import { padString } from '../../utils/stringTool';

export class BlackListCommand implements Command {
    regexContent = 'blist';
    description = '查看黑名单玩家';
    adminLevel = 0;

    isMatch(command: string): boolean {
        return command.toLowerCase() === this.regexContent;
    }

    getInfo(): string {
        // 总共20个字符，中间用空格补齐
        const content = padString(this.regexContent, this.description, 34);
        return content;
    }

    async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
        // 获取本地黑名单玩家
        const blackList = await getAllLocalBlackList();
        const globalBlackList = await getAllGlobalBlackList();
        const tempBlackList = await getAllTempBlackList();
        if (blackList.length === 0) {
            sendMsgToQQGroup(group_id, `当前没有黑名单玩家`, message_id);
        } else {
            const { group_name } = await readConfigFile();
            let content = `【${group_name}】群组本地黑名单列表如下：\n`;
            for (const player of blackList) {
                content += `【名称】: ${player.name}\n${player.personaId}\n`;
                content += `【原因】: ${player.reason}\n`;
                content += `【处理人】: ${player.admin_name}\n`;
                content += `【时间】: ${player.time}\n\n`;
            }
            sendGroupTxtFile(group_id, '服务器[黑名单]专栏', content, '[本地]黑名单列表.txt');
        }

        if (globalBlackList.length > 0) {
            let content = `【全局黑名单列表如下】\n`;
            for (const player of globalBlackList) {
                content += `【名称】: ${player.name}\n${player.personaId}\n`;
                content += `【原因】: ${player.reason}\n`;
                content += `【群组】: ${player.group_name}\n`;
                content += `【处理人】: ${player.admin_name}\n`;
                content += `【时间】: ${player.time}\n\n`;
            }
            sendGroupTxtFile(group_id, '服务器[黑名单]专栏', content, '[全局]黑名单列表.txt');
        }

        if (tempBlackList.length > 0) {
            let content = `【临时黑名单列表如下】\n`;
            for (const player of tempBlackList) {
                content += `【名称】: ${player.name}\n${player.personaId}\n`;
                content += `【类型】: ${player.reason_type}\n`;
                content += `【原因】: ${player.reason_text}\n`;
                content += `【时间】: ${player.time}\n\n`;
            }
        }
    }
}