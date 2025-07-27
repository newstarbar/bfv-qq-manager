import { Command } from "../../interface/command";
import { Player, ServerConfig, Team } from "../../interface/ServerInfo";
import { sendMsgToQQGroup } from "../../qq/sendMessage";
import { addWarmPlayer } from "../../robot/hs/warmServer";
import { padString } from "../../utils/stringTool";

export class SetWarmCommand implements Command {
	regexContent = "setwarm=ID";
	description = "单独设置暖服";
	regex = /^setwarm(=|＝)(\S+)$/;

	adminLevel = 2;

	isMatch(command: string): boolean {
		// 正则匹配
		return this.regex.test(command);
	}

	getInfo(): string {
		const content = padString(this.regexContent, this.description, 28);
		return content;
	}

	async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
		const playerName = command.match(this.regex)![2];
		const serverName = "单独计入暖服名单";
		const warmPlayer: Player = {
			name: playerName,
			personaId: 0,
			team: Team.one,
			platoon: "",
			joinTime: 0,
			warmTime: 0,
			isWarmed: true,
			isBot: false
		};
		addWarmPlayer(serverName, [warmPlayer]);
		sendMsgToQQGroup(group_id, `已将 ${playerName}\n加入暖服名单`, message_id);
	}
}
