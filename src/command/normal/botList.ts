import { Command } from '../../interface/command';
import { Team } from '../../interface/ServerInfo';
import { sendMsgToQQGroup } from '../../qq/sendMessage';
import { serverPlayerManagers } from '../../robot/player/serverPlayerManager';
import { padString } from '../../utils/stringTool';

export class BotListCommand implements Command {
    regexContent = 'bot';
    description = '查看在线BOT列表';
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
        if (serverPlayerManagers.length > 0) {
            let message = '=======在线BOT========\n';
            for (const serverPlayerManager of serverPlayerManagers) {
                let serverName = serverPlayerManager.serverName;
                const botList = serverPlayerManager.players.bot;
                if (botList.length > 0) {
                    message += `${serverName.replace('[MINI ROBOT]', '').replace('[mini robot]', '')}\n\n`;
                    const team1 = botList.filter(player => player.team === Team.one);
                    message += '【队伍1】\n';
                    team1.forEach(player => {
                        message += `${player.name} \n`;
                    });
                    const team2 = botList.filter(player => player.team === Team.two);
                    message += '\n【队伍2】\n';
                    team2.forEach(player => {
                        message += `${player.name} \n`;
                    });
                    message += '\n';
                }
            }
            sendMsgToQQGroup(group_id, message, message_id);
        } else {
            sendMsgToQQGroup(group_id, '当前没有在线BOT', message_id);
        }
    }
}