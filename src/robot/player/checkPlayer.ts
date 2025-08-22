import { PlayerLife } from "../../interface/player";
import { Player, ServerAdmin, ServerConfig } from "../../interface/ServerInfo";
import { getAdminMemberInfo, isGroupMember } from "../../qq/memberManager";
import { sendMsgToQQGroup } from "../../qq/sendMessage";
import { sendBanPlayerCmd, sendKickPlayerCmd } from "../../qq/sendToRunRun";
import { readConfigFile } from "../../utils/localFile";
import logger from "../../utils/logger";
import { getNowDATETIME } from "../../utils/timeTool";
import { addBanRecord } from "../ban/banRecord";
import { addQueryPlayerLife } from "../eaApiManger";
import { isWarmPlayer } from "../hs/warmServer";
import { handlePlayerLife } from "../../common/handleData/handlePlayerLife";
import { adminBanKick } from "../serverSayManager";

// 缓存玩家数据
let playerLifeCacheList: PlayerLife[] = [];

// 暖服期间暂存待屏蔽玩家
let waitBanPlayerInWarm: { gameId: number; playerLifeData: PlayerLife; joinTime: number; reason: string; config: ServerConfig; admin: ServerAdmin; isWarmNotBanStr: string }[] = [];
// 暖服期间暂存待踢出玩家
let waitKickPlayerInWarm: { gameId: number; playerLifeData: PlayerLife; joinTime: number; reason: string; config: ServerConfig; admin: ServerAdmin; isWarmNotBanStr: string }[] = [];

/** 查询玩家生涯数据 */
export async function checkPlayersLife(gameId: number, players: Player[], config: ServerConfig, isWarm: boolean): Promise<void> {
	handleWaitBanPlayerInWarm(gameId, isWarm, config);

	for (const player of players) {
		const name = player.name;
		const personaId = player.personaId;
		const isWarmed = player.isWarmed;
		checkPlayerLife(personaId, name, isWarmed, gameId, players, config, isWarm);
	}
}

/** 封装后的查询玩家生涯数据 */
async function checkPlayerLife(personaId: number, name: string, isWarmed: boolean, gameId: number, players: Player[], config: ServerConfig, isWarm: boolean): Promise<void> {
	try {
		// 调用EA接口查询生涯数据
		const res = await addQueryPlayerLife(personaId);
		// 构造生涯数据对象
		const playerLifeData = handlePlayerLife(name, personaId, isWarmed, res, "ea");
		// 缓存生涯数据
		playerLifeCacheList.push(playerLifeData);
		// 检测玩家数据是否超过限制
		checkPlayersLimit(gameId, playerLifeData, players, config, isWarm);
	} catch (e: any) {
		logger.error("EA查询生涯数据失败, 原因: " + e.toString().slice(-100));
		// 重新查询
		checkPlayerLife(personaId, name, isWarmed, gameId, players, config, isWarm);
	}
}

/** 检测武器、载具数据是否异常，异常则踢出 */
export async function checkPlayersWeaponVehicle(gameId: number, players: Player[], config: ServerConfig): Promise<void> {
	for (const player of players) {
		const name = player.name;
		const personaId = player.personaId;
		const isWarmed = player.isWarmed;
		try {
			// 调用EA接口查询武器数据
			// const resWeapons = await addPlayerWeaponDetail(personaId);
			// const resVehicle = await addPlayerVehicleDetail(personaId);
			// const weapons = handlePlayerWeapon(resWeapons, "ea");
			// const vehicle = handlePlayerVehicle(resVehicle, "ea");
			// 检测玩家数据是否异常
			// TODO
		} catch (e: any) {
			logger.error("EA查询生涯数据失败, 原因: " + e.toString().slice(-100));
		}
	}
}

/** 暖服成功后，处理待屏蔽玩家 */
export async function handleWaitBanPlayerInWarm(gameId: number, isWarm: boolean, config: ServerConfig): Promise<void> {
	if (isWarm) {
		// 暖服成功后，处理待屏蔽玩家
		for (const player of waitBanPlayerInWarm) {
			if (player.isWarmNotBanStr !== "") {
				// 查询该玩家是否有暖服记录
				const isWarmRecord = await isWarmPlayer(player.playerLifeData.name);
				if (isWarmRecord.isWarm) {
					// 玩家有暖服记录，不屏蔽
					sendMsgToQQGroup(player.config.group_id, player.isWarmNotBanStr, null);
					continue;
				}
			}
			const { gameId, playerLifeData, joinTime, reason, config, admin } = player;
			kickPlayer(gameId, playerLifeData, joinTime, reason, config, admin);
		}
		waitBanPlayerInWarm = [];
		// 暖服成功后，处理待踢出玩家
		for (const player of waitKickPlayerInWarm) {
			if (player.isWarmNotBanStr !== "") {
				// 查询该玩家是否有暖服记录
				const isWarmRecord = await isWarmPlayer(player.playerLifeData.name);
				if (isWarmRecord.isWarm) {
					// 玩家有暖服记录，不踢出
					sendMsgToQQGroup(player.config.group_id, player.isWarmNotBanStr, null);
					continue;
				}
			}
			const { gameId, playerLifeData, joinTime, reason, config, admin } = player;
			kickPlayer(gameId, playerLifeData, joinTime, reason, config, admin);
		}
		waitKickPlayerInWarm = [];
	}
}

/** 删除缓存数据 */
export function deletePlayerLifeCache(personaId: number): void {
	for (let i = 0; i < playerLifeCacheList.length; i++) {
		const playerLifeData = playerLifeCacheList[i];
		if (playerLifeData.personaId === personaId) {
			playerLifeCacheList.splice(i, 1);
			break;
		}
	}
}

/** 获取缓存数据 */
export function getPlayerLifeCache(personaId: number): PlayerLife | null {
	for (const playerLifeData of playerLifeCacheList) {
		if (playerLifeData.personaId === personaId) {
			return playerLifeData;
		}
	}
	return null;
}

const { bot_name, bot_qq } = readConfigFile();
// 机器人自动屏蔽的管理员身份
const botAdmin: ServerAdmin = {
	name: bot_name,
	user_id: bot_qq
};

/** 检测玩家数据是否超过限制 */
export async function checkPlayersLimit(gameId: number, playerLifeData: PlayerLife, players: Player[], config: ServerConfig, isWarm: boolean): Promise<void> {
	// 是否是管理员
	const adminList = await getAdminMemberInfo(config.group_id, 1);
	const isAdmin = adminList.some((item) => item.player_name === playerLifeData.name);
	if (isAdmin) {
		logger.info(`玩家 ${playerLifeData.name} 是管理员, 无需检测`);
		return;
	}

	const group_id = config.group_id;
	const levelLimit = config.level;
	const warmLevelLimit = config.warm_level;
	const kpmLimit = config.kpm;
	const kdLimit = config.kd;
	const isTV = config.tv;

	const isWarmed = playerLifeData.isWarmed;
	const level = playerLifeData.level;
	const kpm = playerLifeData.kpm;
	const kd = playerLifeData.kd;

	let joinTime = -1;
	// 对应的player对象
	const player = players.find((item) => item.personaId === playerLifeData.personaId);
	if (player) {
		joinTime = player.joinTime;
	}

	// 新号
	if (level <= 10) {
		return;
	}

	let isNeedBan = false;
	let banReason = "";

	// 不暖服要踢出，暖服就不用踢出
	let isWarmNotBanStr = "";

	if (isWarmed) {
		if (level > warmLevelLimit) {
			isNeedBan = true;
			banReason = `暖服权益生效失败; 等级[${level}]大于暖服限制${warmLevelLimit}`;
		} else if (level > levelLimit && level <= warmLevelLimit) {
			sendMsgToQQGroup(group_id, `<服管/暖服权益生效>\n玩家: ${playerLifeData.name}\n等级: ${levelLimit} < [${level}] < ${warmLevelLimit}\n暖服权益生效成功!`, null);
		} else if (kpm > kpmLimit) {
			sendMsgToQQGroup(group_id, `<服管/暖服权益生效>\n玩家: ${playerLifeData.name}\nKPM: [${kpm}] 解除限制\n暖服权益生效成功!`, null);
		} else if (kd > kdLimit) {
			sendMsgToQQGroup(group_id, `<服管/暖服权益生效>\n玩家: ${playerLifeData.name}\nKD: [${kd}] 解除限制\n暖服权益生效成功!`, null);
		}
	} else {
		if (level > warmLevelLimit) {
			isNeedBan = true;
			banReason = `等级[${level}]大于限制${levelLimit}`;
		} else if (level > levelLimit && level <= warmLevelLimit) {
			isNeedBan = true;
			isWarmNotBanStr = `<服管/暖服权益生效>\n玩家: ${playerLifeData.name}\n等级: ${levelLimit} < [${level}] < ${warmLevelLimit}`;
			banReason = `等级[${level}]大于限制${levelLimit}`;
		}
		if (kpm > kpmLimit) {
			isNeedBan = true;
			isWarmNotBanStr = `<服管/暖服权益生效>\n玩家: ${playerLifeData.name}\nKPM: [${kpm}] 解除限制\n暖服权益生效成功`;
			banReason = `KPM[${kpm}]大于限制${kpmLimit}`;
		}
		if (kd > kdLimit) {
			isNeedBan = true;
			isWarmNotBanStr = `<服管/暖服权益生效>\n玩家: ${playerLifeData.name}\nKD: [${kd}] 解除限制\n暖服权益生效成功!`;
			banReason = `KD[${kd}]大于限制${kdLimit}`;
		}
	}
	if (isNeedBan) {
		// 踢出玩家
		if (!isWarm && isWarmNotBanStr !== "") {
			waitKickPlayerInWarm.push({
				gameId,
				playerLifeData,
				joinTime,
				reason: banReason,
				config,
				admin: botAdmin,
				isWarmNotBanStr: isWarmNotBanStr
			});
		} else {
			kickPlayer(gameId, playerLifeData, joinTime, banReason, config, botAdmin);
		}
	}
	logger.debug(`玩家 ${playerLifeData.name} 生涯数据检测完毕`);
}

/** 屏蔽玩家 */
export async function banPlayer(
	gameId: number,
	playerLifeData: PlayerLife,
	joinTime: number,
	reason: string,
	config: ServerConfig,
	admin: ServerAdmin,
	isReport: boolean = true
): Promise<{ isCanBan: boolean; reason: string }> {
	// 屏蔽原因检测
	const checkResult = await checkBanReason(config, playerLifeData, reason);
	if (!checkResult.isCanBan) {
		return { isCanBan: false, reason: checkResult.reason };
	}

	// 保存屏蔽数据
	const { name, personaId } = playerLifeData;
	// 北京时间
	const time = getNowDATETIME();
	addBanRecord(gameId, name, personaId, config.zh_name, admin.name, admin.user_id, reason, time, config.tv, false);

	// 发送屏蔽命令
	sendBanPlayerCmd(gameId, playerLifeData, joinTime, reason, config, admin, isReport);
	// 游戏内发送屏蔽消息
	adminBanKick(gameId, `玩家: ${playerLifeData.name} 已被屏蔽游戏 原因: ${reason} 处理人: ${admin.name}`, admin.name);
	return { isCanBan: true, reason: "" };
}

/** 踢出玩家 */
export async function kickPlayer(
	gameId: number,
	playerLifeData: PlayerLife,
	joinTime: number,
	reason: string,
	config: ServerConfig,
	admin: ServerAdmin,
	isReport: boolean = true
): Promise<{ isCanBan: boolean; reason: string }> {
	// 屏蔽原因检测
	const checkResult = await checkBanReason(config, playerLifeData, reason);
	if (!checkResult.isCanBan) {
		return { isCanBan: false, reason: checkResult.reason };
	}

	// 保存屏蔽数据
	const { name, personaId } = playerLifeData;
	// 北京时间
	const time = getNowDATETIME();
	addBanRecord(gameId, name, personaId, config.zh_name, admin.name, admin.user_id, reason, time, config.tv, true);

	// 发送踢出命令
	sendKickPlayerCmd(gameId, playerLifeData, joinTime, reason, config, admin, isReport);
	// 游戏内发送踢出消息
	adminBanKick(gameId, `玩家: ${playerLifeData.name} 已被踢出游戏 原因: ${reason} 处理人: ${admin.name}`, admin.name);
	return { isCanBan: true, reason: "" };
}

/** 屏蔽原因检测 */
export async function checkBanReason(config: ServerConfig, playerLifeData: PlayerLife, reason: string): Promise<{ isCanBan: boolean; reason: string }> {
	// 管理员检测
	const adminList = await getAdminMemberInfo(config.group_id, 1);
	const isAdmin = adminList.some((item) => item.player_name === playerLifeData.name);
	if (isAdmin) {
		return { isCanBan: false, reason: `玩家: ${playerLifeData.name}是管理员, 无法屏蔽` };
	}
	// 暖服检测
	const isWarmed = await isWarmPlayer(playerLifeData.name);
	if (isWarmed.isWarm && (reason.includes("超杀") || reason.includes("限杀"))) {
		return { isCanBan: false, reason: `玩家: ${playerLifeData.name}是暖服成员, 解除超杀限制` };
	}

	// 特殊无限制服, 关键词检测
	let serverName = config.zh_name;
	serverName = serverName.toLowerCase().trim();
	if (serverName.includes("无限制") || serverName.includes("wuxianzhi")) {
		if (reason.includes("2a")) {
			return { isCanBan: false, reason: `玩家: ${playerLifeData.name} 在无限制服, 允许使用2a` };
		}
	}

	return { isCanBan: true, reason: "" };
}
