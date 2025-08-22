import { PlayerLife } from "../../interface/player";
import { Player, ServerAdmin, ServerConfig } from "../../interface/ServerInfo";
import { getAdminMemberInfo, isAdmin, isGroupMember } from "../../qq/memberManager";
import { sendMsgToQQGroup } from "../../qq/sendMessage";
import { statusAxios } from "../../utils/axios";
import { BanWeapon, PlayerWeaponLimitConfig, readConfigFile, readPlayerWeaponLimitConfig } from "../../utils/localFile";
import logger from "../../utils/logger";
import { addTempBlackList, isTempBlackList } from "../ban/backListManager";
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
		const playerNameList = waitQueue.map((item) => item.playerName);
		try {
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
						// 数据无效，重新加入队列
						if (!playerRes || now - playerRes.timestamp > validTime) {
							const newSettlement = { ...settlement, count: settlement.count + 1 };
							waitQueue.push(newSettlement);
						} else {
							// 有效数据
							isOverkill(settlement, playerRes.kills);
							isUseLimitWeapon(settlement.gameId, settlement.player, settlement.serverConfig, playerRes);
						}
					}
				}
			}
		} catch (e) {
			logger.info("未开启玩家战绩查询服务");
		}
	}
}

// 是否使用限制武器
async function isUseLimitWeapon(gameId: number, player: Player, serverConfig: ServerConfig, playerRes: any): Promise<void> {
	const { weapons, vehicles, gadgets } = playerRes;

	// 检查是否为临时黑名单用户
	const isTempBlack = await isTempBlackList(player.personaId);

	// 读取武器限制配置
	const banWeaponList = await readPlayerWeaponLimitConfig();

	// 是否是管理员
	const adminList = await getAdminMemberInfo(serverConfig.group_id, 1);
	const isadmin = adminList.some((item) => item.player_name == player.name);
	if (isadmin) {
		return;
	}

	if (banWeaponList.length > 0) {
		// 查找当前服务器的限制配置
		const banList = banWeaponList.find((item: PlayerWeaponLimitConfig) => item.server_name == serverConfig.zh_name || item.server_name == serverConfig.en_name);
		if (banList) {
			if (banList.ban_list && banList.ban_list.length > 0) {
				const now = new Date();

				banList.ban_list.forEach((item: BanWeapon) => {
					const { name, start_time, end_time } = item;

					// 计算当天的开始和结束时间
					const startTime = new Date(now.toDateString() + " " + start_time);
					const endTime = new Date(now.toDateString() + " " + end_time);

					// 检查是否在限制时间内
					const isInTimeRange = now >= startTime && now <= endTime;

					if (isInTimeRange) {
						// 检查玩家是否使用了限制武器
						const isUseWeapon = weapons.find((weapon: any) => weapon.name === name);
						if (isUseWeapon) {
							// 检查是否已经有该类型的黑名单记录
							const isExit = isTempBlack.find((item: any) => item.reason_type === "限制武器" && item.reason_text.includes(name));

							if (!isExit) {
								sendMsgToQQGroup(
									serverConfig.group_id,
									`${serverConfig.zh_name}\n玩家: ${player.name}\n使用限制武器【${name}】${isUseWeapon.kills}杀\n已自动加入临时黑名单\n解除请联系管理员`,
									null
								);
								addTempBlackList(player.name, player.personaId, "限制武器", `使用限制武器[${name}]${isUseWeapon.kills}杀`);
								kickOverPlayer(gameId, serverConfig, player, "限制武器", `使用限制武器[${name}]${isUseWeapon.kills}杀`);
							}
						}
						// 检查玩家是否使用了限制载具
						const isUseVehicle = vehicles.find((vehicle: any) => vehicle.name === name);
						if (isUseVehicle) {
							const isExit = isTempBlack.find((item: any) => item.reason_type === "限制载具" && item.reason_text.includes(name));
							if (!isExit) {
								sendMsgToQQGroup(
									serverConfig.group_id,
									`${serverConfig.zh_name}\n玩家: ${player.name}\n使用限制载具【${name}】${isUseVehicle.kills}杀\n已自动加入临时黑名单\n解除请联系管理员`,
									null
								);
								addTempBlackList(player.name, player.personaId, "限制载具", `使用限制载具[${name}]${isUseVehicle.kills}杀`);
								kickOverPlayer(gameId, serverConfig, player, "限制载具", `使用限制载具[${name}]${isUseVehicle.kills}杀`);
							}
						}

						// 检查玩家是否使用了限制道具
						const isUseGadget = gadgets.find((gadget: any) => gadget.name === name);
						if (isUseGadget) {
							const isExit = isTempBlack.find((item: any) => item.reason_type === "限制道具" && item.reason_text.includes(name));
							if (!isExit) {
								sendMsgToQQGroup(
									serverConfig.group_id,
									`${serverConfig.zh_name}\n玩家: ${player.name}\n使用限制道具【${name}】${isUseGadget.kills}杀\n已自动加入临时黑名单\n解除请联系管理员`,
									null
								);
								addTempBlackList(player.name, player.personaId, "限制道具", `使用限制道具[${name}]${isUseGadget.kills}杀`);
								kickOverPlayer(gameId, serverConfig, player, "限制道具", `使用限制道具[${name}]${isUseGadget.kills}杀`);
							}
						}
					}
				});
			}
		}
	}
}

// 查询是否超杀
async function isOverkill(settlement: Settlement, playerKills: number): Promise<void> {
	const { serverConfig, player } = settlement;
	if (player.isWarmed) {
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

	// 是否已经在临时黑名单中
	const isTempBlack = await isTempBlackList(player.personaId);
	if (isTempBlack.length > 0) {
		return;
	}

	if (isGroup) {
		if (playerKills > serverConfig.kill) {
			sendMsgToQQGroup(
				serverConfig.group_id,
				`${serverConfig.zh_name}\n群友[${player.name}]超杀\n击杀数: ${playerKills} > ${serverConfig.kill}\n已自动加入临时黑名单\n暖服期间进服自动解除`,
				null
			);
			addTempBlackList(player.name, player.personaId, "超杀", `群内超杀数${playerKills}大于${serverConfig.kill}`);
			kickOverPlayer(settlement.gameId, serverConfig, player, "超杀", `群内超杀数${playerKills}大于${serverConfig.kill}`);
		}
	} else {
		if (playerKills > serverConfig.nokill) {
			sendMsgToQQGroup(
				serverConfig.group_id,
				`${serverConfig.zh_name}\n路人[${player.name}]超杀\n击杀数: ${playerKills} > ${serverConfig.nokill}\n已自动加入临时黑名单\n暖服期间进服自动解除`,
				null
			);
			addTempBlackList(player.name, player.personaId, "超杀", `路人超杀数${playerKills}大于${serverConfig.nokill}`);
			kickOverPlayer(settlement.gameId, serverConfig, player, "超杀", `路人超杀数${playerKills}大于${serverConfig.nokill}`);
		}
	}
}

// 加入待处理队列
export function addToQueue(gameId: number, serverConfig: ServerConfig, player: Player) {
	// 是否已经在队列中
	const exist = waitQueue.find((item) => item.playerName == player.name);
	if (exist) {
		return;
	}
	waitQueue.push({ serverConfig, gameId, playerName: player.name, player, count: 1 });
}

/** 踢出超杀玩家 */
function kickOverPlayer(gameId: number, serverConfig: ServerConfig, player: Player, reason_type: string, reason_text: string) {
	// 直接踢出
	const reason = `${reason_type}临时黑名单[${reason_text}]`;
	const admin: ServerAdmin = { name: readConfigFile().bot_name, user_id: 0 };
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
