import { Command } from "../../interface/command";
import { GroupPlayer, Player, ServerStatus, Team } from "../../interface/ServerInfo";
import { sendMsgToQQGroup } from "../../qq/sendMessage";
import { getOnlineGroupMember } from "../../robot/hs/onlineHistory";
import { serverPlayerManagers } from "../../robot/player/serverPlayerManager";
import { getAllServerStatus } from "../../robot/serverManager";
import { padString } from "../../utils/stringTool";
import { translateMapModeName } from "../../utils/translation";

export class ServerStatusCommand implements Command {
	regexContent = "server";
	description = "查看服务器状态";
	adminLevel = 0;

	constructor(name: string) {
		if (name) {
			this.regexContent = name;
		}
	}

	isMatch(command: string): boolean {
		return command.toLowerCase() === this.regexContent.toLowerCase();
	}

	getInfo(): string {
		const content = padString(this.regexContent, this.description, 34);
		return content;
	}

	async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
		// 服务器状态查询功能
		const result = await getOnlineGroupMember(group_id);
		const serverStatus = getAllServerStatus();
		let message = "=======服务器状态=======\n";
		for (const server of serverStatus) {
			message += generateServerStatus(server, result);
		}
		if (message === "=======服务器状态=======\n") {
			sendMsgToQQGroup(group_id, "当前没有在线的服务器", message_id);
		} else {
			sendMsgToQQGroup(group_id, message, message_id);
		}
	}
}

/** 合成服务器状态 */
function generateServerStatus(serverStatus: ServerStatus, groupMember: GroupPlayer[]): string {
	let serverPlayers = serverPlayerManagers.find((manager) => manager.serverName === serverStatus.zh_name);
	let playerList: Player[] = [];
	// 暖服状态
	let warmStatusStr = "未知";
	let botNumber = 0;

	if (serverPlayers) {
		playerList = serverPlayers.players.soldier;
		warmStatusStr = serverPlayers.isWarm ? "暖服成功" : "暖服中";
		botNumber = serverPlayers.players.bot.length;
	}

	let serverName = serverStatus.zh_name
		.replace("[MINI ROBOT]", "")
		.replace("[ROBOT]", "")
		.replace("[mini robot]", "")
		.replace("[robot]", "")
		.replace("[mini ROBOT]", "")
		.replace("[TV ROBOT]", "")
		.replace("[QQ ROBOT]", "");

	const queue = serverStatus.queue;
	const spectator = serverStatus.spectator;
	const mapName = translateMapModeName(serverStatus.mapName);
	let mapMode = translateMapModeName(serverStatus.mapMode);
	// 管理员列表
	let monitorsStr = groupMember
		.filter((member) => member.admin_level >= 1 && member.server_name === serverStatus.zh_name)
		.map((member) => member.name)
		.join(", ");
	// 群友数量
	const groupMemberCount = groupMember.filter((member) => member.server_name === serverStatus.zh_name).length;

	const team1 = playerList.filter((player) => player.team === Team.one).length;
	const team2 = playerList.filter((player) => player.team === Team.two).length;

	// 当前对局持续时间
	const currentTime = new Date().getTime() - serverStatus.currentTime;
	const currentTimeStr = `${Math.floor(currentTime / 60 / 1000)}分钟`;

	const resultContent = `【${warmStatusStr}】     对局: ${currentTimeStr}\n${serverName}\n人数: ${
		serverPlayers ? serverPlayers.players.soldier.length + botNumber : 0
	}[${team1}|${team2}]/64 [${queue}]  观战: ${spectator}\n地图: ${mapName}[${mapMode}]\n群友: ${groupMemberCount}    真人: ${
		serverPlayers ? serverPlayers.players.soldier.length : 0
	}    bot: ${botNumber}\n监服: ${monitorsStr}\n======================\n`;

	return resultContent;
}
