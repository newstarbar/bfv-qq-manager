import { Command } from "../../interface/command";
import { PlayerLife } from "../../interface/player";
import { ServerAdmin, ServerConfig } from "../../interface/ServerInfo";
import { getAdminMemberInfo } from "../../qq/memberManager";
import { sendMsgToQQGroup } from "../../qq/sendMessage";
import { sendUnBanPlayerCmd } from "../../qq/sendToRunRun";
import { getPlayerBanRecord } from "../../robot/ban/banRecord";
import { banPlayer, kickPlayer } from "../../robot/player/checkPlayer";
import { queryNearlyName, queryPlayer } from "../../robot/player/serverPlayerManager";
import { padString } from "../../utils/stringTool";

export class BanPlayerCommand implements Command {
	regexContent = "ban=ID 原因";
	description = "屏蔽玩家";
	regex = /^ban(=|＝)(\S+) (.+)$/;

	regexContent2 = "unban=ID";
	description2 = "解除屏蔽玩家";
	regex2 = /^unban(=|＝)(\S+)$/;

	regexContent3 = "kick=ID 原因";
	description3 = "踢出玩家";
	regex3 = /^kick(=|＝)(\S+) (.+)$/;

	adminLevel = 1;

	isMatch(command: string): boolean {
		// 正则匹配
		return this.regex.test(command) || this.regex2.test(command) || this.regex3.test(command);
	}

	getInfo(): string {
		// 总共20个字符，中间用空格补齐
		const content1 = padString(this.regexContent, this.description, 34);
		const content2 = padString(this.regexContent2, this.description2, 34);
		const content3 = padString(this.regexContent3, this.description3, 34);
		const content = content1 + "\n" + content2 + "\n" + content3;
		return content;
	}

	async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
		if (this.regex.test(command)) {
			const playerName = command.match(this.regex)![2];
			const reason = command.match(this.regex)![3];
			banPlayerCommand(playerName, reason, group_id, message_id, user_id);
		} else if (this.regex2.test(command)) {
			const playerName = command.match(this.regex2)![2];
			unbanPlayerCommand(playerName, group_id, message_id, user_id);
		} else if (this.regex3.test(command)) {
			const playerName = command.match(this.regex3)![2];
			const reason = command.match(this.regex3)![3];
			kickPlayerCommand(playerName, reason, group_id, message_id, user_id);
		}
	}
}

/** 管理员屏蔽玩家指令 */
export async function banPlayerCommand(playerName: string, reason: string, group_id: number, message_id: number, user_id: number, is_report = true): Promise<void> {
	// 去掉reason所有空格
	const newReason = reason.replace(/\s+/g, "");

	if (newReason.length > 50) {
		sendMsgToQQGroup(group_id, `========屏蔽模块========\n屏蔽原因不能超过50个字符\n附带图片会占几百字符\n======================`, message_id);
		return;
	}
	// 构建admin对象
	const adminNameList = await getAdminMemberInfo(group_id, 1);
	const adminName = adminNameList.find((item) => item.user_id === user_id);
	const admin: ServerAdmin = {
		name: adminName?.player_name || "管理员",
		user_id: user_id
	};

	// 查询玩家
	const result = queryPlayer(playerName);
	if (!result) {
		const nearlyPlayers = queryNearlyName(playerName);
		const nearlyPlayersStr = nearlyPlayers.length > 0 ? nearlyPlayers.join("\n\n") : "无任何近似名称玩家";
		if (is_report) {
			sendMsgToQQGroup(group_id, `========屏蔽模块========\n玩家${playerName}不存在\n请检查拼写或尝试以下近似匹配:\n\n${nearlyPlayersStr}\n======================`, message_id);
		}
	} else {
		const gameId = result.serverPlayerManager.gameId;
		const config = result.serverPlayerManager.serverConfig;
		let banResult: { isCanBan: boolean; reason: string };
		if (!result.queryPlayerLife) {
			// 构造一个临时的PlayerLife对象
			const playerLife: PlayerLife = {
				name: result.player.name,
				personaId: result.player.personaId,
				timePlayed: -1,
				level: -1,
				wins: -1,
				losses: -1,
				kills: -1,
				deaths: -1,
				kpm: -1,
				kd: -1,
				longestHeadShot: -1,
				isWarmed: false
			};
			// 屏蔽玩家
			banResult = await banPlayer(gameId, playerLife, result.player.joinTime, newReason, config, admin, is_report);
		} else {
			// 玩家存在，获取PlayerLife对象
			const playerLife = result.queryPlayerLife;
			// 屏蔽玩家
			banResult = await banPlayer(gameId, playerLife, result.player.joinTime, newReason, config, admin, is_report);
		}
		if (banResult.isCanBan) {
			if (is_report) {
				sendMsgToQQGroup(group_id, `========屏蔽模块========\n指令已下达等待执行\n>>>>>>>>>>>>>>>>>`, message_id);
			}
		} else {
			if (is_report) {
				sendMsgToQQGroup(group_id, `========屏蔽模块========\n${banResult.reason}`, message_id);
			}
		}
	}
}

/** 管理员解除屏蔽玩家指令 */
async function unbanPlayerCommand(playerName: string, group_id: number, message_id: number, user_id: number): Promise<void> {
	const result = await getPlayerBanRecord(playerName);
	if (result.length === 0) {
		sendMsgToQQGroup(group_id, `========屏蔽模块========\n未查询到玩家${playerName}的屏蔽记录\n======================`, message_id);
		return;
	}
	const playerBanRecord = result[0];
	const gameId = playerBanRecord.game_id;
	const config: ServerConfig = {
		tag: "未知",
		group_id: group_id,
		zh_name: playerBanRecord.server_name,
		en_name: playerBanRecord.server_name,
		id: "未知",
		level: -1,
		warm_level: -1,
		kd: -1,
		kpm: -1,
		nokill: -1,
		kill: -1,
		warm_player: -1,
		tv: playerBanRecord.is_tv
	};
	// 构建admin对象
	const adminNameList = await getAdminMemberInfo(group_id, 1);
	const adminName = adminNameList.find((item) => item.user_id === user_id);
	const admin: ServerAdmin = {
		name: adminName?.player_name || "管理员",
		user_id: user_id
	};
	sendUnBanPlayerCmd(gameId, playerName, config, admin);
}

/** 管理员踢出玩家指令 */
async function kickPlayerCommand(playerName: string, reason: string, group_id: number, message_id: number, user_id: number, is_report = true): Promise<void> {
	// 去掉reason所有空格
	const newReason = reason.replace(/\s+/g, "");

	if (newReason.length > 50) {
		sendMsgToQQGroup(group_id, `========踢人模块========\n踢人原因不能超过50个字符\n附带图片会占几百字符\n==========`, message_id);
		return;
	}
	// 构建admin对象
	const adminNameList = await getAdminMemberInfo(group_id, 1);
	const adminName = adminNameList.find((item) => item.user_id === user_id);
	const admin: ServerAdmin = {
		name: adminName?.player_name || "管理员",
		user_id: user_id
	};

	// 查询玩家
	const result = queryPlayer(playerName);
	if (!result) {
		const nearlyPlayers = queryNearlyName(playerName);
		const nearlyPlayersStr = nearlyPlayers.length > 0 ? nearlyPlayers.join("\n\n") : "无任何近似名称玩家";
		if (is_report) {
			sendMsgToQQGroup(group_id, `========踢人模块========\n玩家${playerName}不存在\n请检查拼写或尝试以下近似匹配:\n\n${nearlyPlayersStr}\n==========`, message_id);
		}
	} else {
		const gameId = result.serverPlayerManager.gameId;
		const config = result.serverPlayerManager.serverConfig;
		let banResult: { isCanBan: boolean; reason: string };
		if (!result.queryPlayerLife) {
			// 构造一个临时的PlayerLife对象
			const playerLife: PlayerLife = {
				name: result.player.name,
				personaId: result.player.personaId,
				timePlayed: -1,
				level: -1,
				wins: -1,
				losses: -1,
				kills: -1,
				deaths: -1,
				kpm: -1,
				kd: -1,
				longestHeadShot: -1,
				isWarmed: false
			};
			// 踢出玩家
			banResult = await kickPlayer(gameId, playerLife, result.player.joinTime, newReason, config, admin, is_report);
		} else {
			// 玩家存在，获取PlayerLife对象
			const playerLife = result.queryPlayerLife;
			// 踢出玩家
			banResult = await kickPlayer(gameId, playerLife, result.player.joinTime, newReason, config, admin, is_report);
		}
		if (banResult.isCanBan) {
			if (is_report) {
				sendMsgToQQGroup(group_id, `========踢人模块========\n指令已下达等待执行\n>>>>>>>>>>>>>>>>>`, message_id);
			}
		} else {
			if (is_report) {
				sendMsgToQQGroup(group_id, `========踢人模块========\n${banResult.reason}`, message_id);
			}
		}
	}
}
