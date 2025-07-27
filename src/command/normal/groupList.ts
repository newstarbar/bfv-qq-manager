import { AxiosError } from "axios";
import { Command } from "../../interface/command";
import { GroupPlayer, Team, TeamName } from "../../interface/ServerInfo";
import { adminLevelName } from "../../qq/memberManager";
import { sendMsgToQQGroup } from "../../qq/sendMessage";
import { getOnlineGroupMember } from "../../robot/hs/onlineHistory";
import { queryServerList } from "../../robot/serverManager";
import logger from "../../utils/logger";
import { padString } from "../../utils/stringTool";

export class GroupListCommand implements Command {
	regexContent = "group";
	description = "查看在线群友";
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
		const groupList = await getOnlineGroupMember(group_id);
		let message = "========在线群友========\n";

		const serverList = new Set(groupList.map((item) => item.server_name));

		serverList.forEach((serverName) => {
			const serverPlayers = groupList.filter((item) => item.server_name === serverName);
			message += `【${serverName.replace("[MINI ROBOT]", "").replace("[mini robot]", "")}】\n`;

			// 队伍1
			const team1Players = serverPlayers.filter((item) => item.team === Team.one);
			message += `【队伍1】\n` + composeMessage(team1Players) + "\n";
			// 队伍2
			const team2Players = serverPlayers.filter((item) => item.team === Team.two);
			message += `【队伍2】\n` + composeMessage(team2Players) + "\n";
			// 排队中
			const queuePlayers = serverPlayers.filter((item) => item.team === Team.queue);
			message += `【排队中】\n` + composeMessage(queuePlayers) + "\n";
			// 观战
			const spectatorPlayers = serverPlayers.filter((item) => item.team === Team.spectator);
			message += `【观战】\n` + composeMessage(spectatorPlayers) + "\n";
			message += "======================\n";
		});
		sendMsgToQQGroup(group_id, message, message_id);
	}
}

/** 组合返回值 */
function composeMessage(groupPlayers: GroupPlayer[]): string {
	let message = "";
	groupPlayers.forEach((player) => {
		const playerName = player.name;
		const joinTime = player.joinTime / 1000;
		const joinTimeStr = ((new Date().getTime() - joinTime) / 1000 / 60).toFixed(1) + "分钟";
		let adminLevelStr = adminLevelName[player.admin_level];
		if (adminLevelStr === "普通成员") {
			adminLevelStr = "";
		} else {
			adminLevelStr = `[${adminLevelStr}]`;
		}
		const isWarmed = player.isWarmed ? "*暖服*" : "";
		message += `${playerName}${adminLevelStr} <${joinTimeStr}> ${isWarmed}\n`;
	});
	return message;
}
