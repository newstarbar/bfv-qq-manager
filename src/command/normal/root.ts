import { Command } from '../../interface/command';
import { sendMsgToQQGroup } from '../../qq/sendMessage';
import { getAllOnlineHistory } from '../../robot/hs/onlineHistory';
import { padString } from '../../utils/stringTool';

export class RootCommand implements Command {
    regexContent = 'root=数量|昵称';
    description = '查看权重';
    regex = /^root(=|＝)(\d{1,2}|\d{3})$/;
    regex2 = /^root(=|＝)(\S+)$/;
    adminLevel = 0;

    isMatch(command: string): boolean {
        // 正则匹配
        return this.regex.test(command) || this.regex2.test(command);
    }

    getInfo(): string {
        // 总共20个字符，中间用空格补齐
        const content = padString(this.regexContent, this.description, 34);
        return content;
    }

    async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
        let message = "========权重列表========\n";
        if (this.regex.test(command)) {
            // 数量
            const count = parseInt(command.match(this.regex)![2]);
            const data = await getAllOnlineHistory(count);
            for (const item of data) {
                message += `权重: ${item.total_count} ${item.player_name}\n`;
            }
        } else if (this.regex2.test(command)) {
            // 昵称
            const playerName = command.match(this.regex2)![2];
            const playerList = await getAllOnlineHistory(5000);
            // 查看当前玩家的权重值
            let current_weight = 0;
            // 当前排名
            let current_rank = 1;
            // 距离上一名的差距
            let last_weight = 0;
            let distance_weight = 0;
            for (let i = 0; i < playerList.length; i++) {
                if (playerList[i].player_name === playerName) {
                    current_weight = playerList[i].total_count;
                    if (current_rank !== 1) {
                        distance_weight = last_weight - current_weight;
                    }
                    break;
                } else {
                    current_rank += 1;
                    last_weight = playerList[i].total_count
                }
            }
            const RankCount = 40;
            // 距离前50名的距离
            let distance_rank = "";
            if (current_rank >= RankCount) {
                distance_rank = "距离战排白名单还差 " + (RankCount - current_rank) + " 名";
            } else {
                distance_rank = "你现在可以申请\n【ZygoMini】战排了!!\n申请后使用\n【join=EAID】即可自动通过";
            }
            message += `【玩家】: ${playerName}\n【权重】: ${current_weight}\n【排名】: ${current_rank}\n距离上一名差: ${distance_weight}\n${distance_rank}\n`;
        }
        sendMsgToQQGroup(group_id, message, message_id);
    }
}