import { PlayerLife } from "../../interface/player";
import { Player, ServerAdmin, ServerConfig } from "../../interface/ServerInfo";
import { getAdminMemberInfo, isAdmin, isGroupMember } from "../../qq/memberManager";
import { sendMsgToQQGroup } from "../../qq/sendMessage";
import { statusAxios } from "../../utils/axios";
import { readConfigFile } from "../../utils/localFile";
import logger from "../../utils/logger";
import { addTempBlackList } from "../ban/backListManager";
import { kickPlayer } from "./checkPlayer";

interface Settlement {
	serverConfig: ServerConfig;
	gameId: number;
	playerName: string;
	player: Player;
	count: number;
}

// 待处理队列
let waitQueue: Settlement[] = [];

// 定时器
let timer: NodeJS.Timeout | null = null;

// 初始化定时器
export function initSettlementTimer() {
	if (timer) {
		clearInterval(timer);
	}
	logger.info("初始化定时器");
	timer = setInterval(() => {
		handleQueue();
	}, 10 * 1000);
}

// 有效数据界定范围
const validTime = 10 * 60 * 1000; // 10分钟

// 过期数据cout最大值
const maxCount = 6 * 12; // 12分钟

// 处理队列
async function handleQueue() {
	if (waitQueue.length > 0) {
		// 过滤名称相同的玩家
		waitQueue = waitQueue.filter((item, index, arr) => {
			return arr.findIndex((item2) => item2.playerName === item.playerName) === index;
		});

		const playerNameList = waitQueue.map((item) => item.playerName);
		const res = await statusAxios().post("batch/player/lastest", {
			playerNames: playerNameList,
			token: readConfigFile().status_token
		});
		if (res.status === 200) {
			if (res.data == null) {
				// 清空队列
				waitQueue = [];
			} else {
				const now = new Date().getTime();
				for (let i = 0; i < waitQueue.length; i++) {
					const settlement = waitQueue.shift();
					if (!settlement) {
						return;
					}
					if (settlement.count >= maxCount) {
						// 超过最大次数
						continue;
					}
					const playerRes = res.data.find((item: any) => item.name == settlement.playerName);
					if (!playerRes || now - playerRes.timestamp > validTime) {
						const newSettlement = { ...settlement, count: settlement.count + 1 };
						waitQueue.push(newSettlement);
					} else {
						// 有效数据
						isOverkill(settlement, playerRes.kills);
					}
				}
			}
		}
	}
}

// 查询是否超杀
async function isOverkill(settlement: Settlement, playerKills: number) {
	const { serverConfig, player } = settlement;
	if (player.isWarmed) {
		return;
	}
	// DEBUG临时小电视服忽略
	if (serverConfig.tv) {
		return;
	}

	// 是否是管理员
	const adminList = await getAdminMemberInfo(serverConfig.group_id, 1);
	const isadmin = adminList.some((item) => item.player_name == player.name);
	if (isadmin) {
		return;
	}
	// 是否是群友
	const isGroup = await isGroupMember(serverConfig.group_id, player.name);
	if (isGroup) {
		if (playerKills > serverConfig.kill) {
			sendMsgToQQGroup(
				serverConfig.group_id,
				`${serverConfig.zh_name}\n群友[${player.name}]超杀\n击杀数: ${playerKills} > ${serverConfig.kill}\n已自动加入临时黑名单\n暖服期间进服自动解除`,
				null
			);
			addTempBlackList(player.name, player.personaId, "超杀", `群内超杀数${playerKills}大于${serverConfig.kill}`);
			kickOverKillPlayer(settlement.gameId, serverConfig, player, `群内超杀数${playerKills}大于${serverConfig.kill}`);
		}
	} else {
		if (playerKills > serverConfig.nokill) {
			sendMsgToQQGroup(
				serverConfig.group_id,
				`${serverConfig.zh_name}\n路人[${player.name}]超杀\n击杀数: ${playerKills} > ${serverConfig.nokill}\n已自动加入临时黑名单\n暖服期间进服自动解除`,
				null
			);
			addTempBlackList(player.name, player.personaId, "超杀", `路人超杀数${playerKills}大于${serverConfig.nokill}\n已自动加入临时黑名单\n暖服期间进服自动解除`);
			kickOverKillPlayer(settlement.gameId, serverConfig, player, `路人超杀数${playerKills}大于${serverConfig.nokill}`);
		}
	}
}

// 加入待处理队列
export function addToQueue(gameId: number, serverConfig: ServerConfig, player: Player) {
	waitQueue.push({ serverConfig, gameId, playerName: player.name, player, count: 1 });
}

/** 踢出超杀玩家 */
function kickOverKillPlayer(gameId: number, serverConfig: ServerConfig, player: Player, reason_text: string) {
	// 直接踢出
	const reason = `超杀临时黑名单[${reason_text}]`;
	const admin: ServerAdmin = { name: "机器人", user_id: 0 };
	const tempPlayerLife: PlayerLife = {
		name: player.name,
		personaId: player.personaId,
		level: -1,
		kills: -1,
		deaths: -1,
		timePlayed: -1,
		wins: -1,
		losses: -1,
		longestHeadShot: -1,
		kpm: -1,
		kd: -1,
		isWarmed: player.isWarmed
	};
	kickPlayer(gameId, tempPlayerLife, player.joinTime, reason, serverConfig, admin, false);
}
