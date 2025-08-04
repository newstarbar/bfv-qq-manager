import { Player, PlayerManager, ServerConfig, ServerStatus, Team } from "../interface/ServerInfo";
import { sendMsgToQQGroup } from "../qq/sendMessage";
import { sendStartServerCmd } from "../qq/sendToRunRun";
import { bfvAxios, gtAxios, proxyAxios } from "../utils/axios";
import logger from "../utils/logger";
import { addQueryServer, addQueryServerDetail } from "./eaApiManger";
import { getAllServerConfig, getServerConfig, setServerOnline } from "./serverConfigManager";
import { closeServerPlayerManager, getServerLog, serverPlayerManagers, updatePlayerManagers } from "./player/serverPlayerManager";
import { readConfigFile } from "../utils/localFile";
import { AxiosError } from "axios";
import { translateMapModeName } from "../utils/translation";
import { offlineAllOnlineMember, offlineServerOnlineMember } from "./hs/onlineHistory";
import { getWarmPlayerList } from "./hs/warmServer";
import { sendGroupTxtFile } from "../qq/groupService";

// 开启的服务器列表
export let queryServerList: [ServerConfig, ServerStatus][] = [];

/** 开启[序号]服务器 */
export async function startServerCommand(tag: string, group_id: number, message_id: number): Promise<void> {
	// 服务器是否存在
	const serverConfig = await getServerConfig(tag);
	if (serverConfig.length === 0) {
		const allServerConfig = (await getAllServerConfig(false)) as ServerConfig[];
		let content = `序号: ${tag}服务器不存在\n当前服务器列表:\n`;
		for (const server of allServerConfig) {
			content += `[${server.tag}] 服名: ${server.zh_name}\n\n`;
		}
		await sendMsgToQQGroup(group_id, content, message_id);
		return;
	}
	// 服务器是否已经开启
	if (serverConfig[0].is_onlined) {
		await sendMsgToQQGroup(group_id, `序号: ${tag}服务器已经开启`, message_id);
		return;
	}
	// 开启服务器
	sendMsgToQQGroup(group_id, `接收到开启${tag}指令\n预计执行5次开服命令\n每次间隔5秒\n正在开启,请稍后...`, message_id);
	sendStartServerCmd(serverConfig[0], group_id, message_id);
}

/** 服务器重启，初始化添加进主循环框架 */
export async function initServerRestart(): Promise<string> {
	logger.info("初始化添加进主循环框架");
	// 重置服务器列表
	queryServerList = [];

	// 下线所有在线玩家
	offlineAllOnlineMember();
	// 取消所有玩家的游戏中状态

	const configs = (await getAllServerConfig(false)) as ServerConfig[];
	if (configs.length === 0) {
		return "你当前的服务器列表为空";
	}

	const { group_name: groupName } = await readConfigFile();
	if (groupName === null) {
		return "服务器监控开启失败, 群组名未设置";
	}
	try {
		const result = await addQueryServer(groupName);
		const serverList = result.gameservers;
		if (serverList.length === 0) {
			// 下线所有服务器
			for (const config of configs) {
				setServerOnline(config.tag, false);
			}
			return "所有服务器都没有开启";
		}
		let message = `群组名: ${groupName}\n当前服务器列表:\n`;
		for (const config of configs) {
			// 查询服务器是否在线
			const server = serverList.find((item: any) => item.name == config.zh_name || item.name == config.en_name);
			if (!server) {
				message += `序号: ${config.tag}\n服名: ${config.zh_name}\n状态: [未开启]\n\n`;
				setServerOnline(config.tag, false);
				continue;
			}
			addServerToMainLoop(config);
			message += `序号: ${config.tag}\n服名: ${config.zh_name}\n状态: [开启中]\n\n`;
			logger.info(`序号: ${config.tag} 服名: ${config.zh_name} 状态: [开启中]`);
		}
		return message;
	} catch (err) {
		logger.error("服务器监控开启失败: ", err);
		return "服务器监控开启失败";
	}
}

/**  服务器开启成功，添加进主循环框架 */
export async function addServerToMainLoop(serverConfig: ServerConfig): Promise<void> {
	const { group_name: groupName } = await readConfigFile();
	if (groupName === null) {
		logger.error("服务器监控开启失败, 群组名未设置");
		return;
	}
	try {
		const result = await addQueryServer(groupName);
		const serverList = result.gameservers;
		if (serverList.length === 0) {
			logger.error("服务器监控开启失败, 群组服务器Lenght为0");
			return;
		}
		const server = serverList.find((item: any) => item.name == serverConfig.zh_name || item.name == serverConfig.en_name);
		if (!server) {
			logger.error("服务器监控开启失败, 未查询到任何匹配服务器");
			return;
		}

		logger.debug(`服务器${serverConfig.zh_name} 加入主循环`);

		queryServerList.push([
			serverConfig,
			{
				tag: serverConfig.tag,
				zh_name: serverConfig.zh_name,
				en_name: serverConfig.en_name,
				gameId: server.gameId,
				mapName: server.mapName,
				mapMode: server.mapMode,
				soldier: server.slots.Soldier.current,
				spectator: server.slots.Spectator.current,
				queue: server.slots.Queue.current,
				rotationIndex: 0,
				currentTime: new Date().getTime()
			}
		]);
		setServerOnline(serverConfig.tag, true);
	} catch (err) {
		logger.error("服务器监控开启失败: ", err);
	}
}

/** 服务器关闭成功，从主循环框架中移除 */
export async function removeServerFromMainLoop(serverConfig: ServerConfig): Promise<void> {
	const index = queryServerList.findIndex((item) => item[0].tag === serverConfig.tag);
	if (index !== -1) {
		logger.debug(`服务器${serverConfig.zh_name} 移除主循环`);
		await closeServerPlayerManager(queryServerList[index][1].gameId);
		// 群播报服务器关闭
		const { group_id, zh_name } = queryServerList[index][0];
		if (queryServerList[index][1].soldier > 30) {
			sendMsgToQQGroup(
				group_id,
				`服务器: ${zh_name.replace("[MINI ROBOT]", "").replace("[mini robot]", "")}\n被炸服了!!!\n关服前人数: ${queryServerList[index][1].soldier}人\n时间: ${new Date().toLocaleString(
					"zh-CN"
				)}`,
				null
			);
			const logStr = await getServerLog(serverConfig.tag, 200);
			sendGroupTxtFile(group_id, "服务器日志", logStr, `服务器${zh_name.replace("[MINI ROBOT]", "").replace("[mini robot]", "")}所有玩家详细记录信息.txt`);
		} else {
			sendMsgToQQGroup(group_id, `服务器: ${zh_name.replace("[MINI ROBOT]", "").replace("[mini robot]", "")}\n状态: [已关闭]\n时间: ${new Date().toLocaleString("zh-CN")}`, null);
		}
		queryServerList.splice(index, 1);
		setServerOnline(serverConfig.tag, false);
		offlineServerOnlineMember(serverConfig.zh_name);
	}
}

/** 启动服务器主循环框架定时器 */
export function startServerLoop() {
	logger.info("启动服管主循环，开始监听服务器状态");
	serverMainLoop();
}

// 当前查询的服务器下标
let queryIndex = 0;

// 如果有观战，的上一次查询时间戳
let lastWatchQueryTimeDic: { [gameId: number]: number } = {};

// 如果有观战，bfv查询时间间隔
const watchQueryInterval = 30 * 1000; // 30秒

/** 服务器主循环框架 */
async function serverMainLoop(): Promise<void> {
	if (queryServerList.length === 0) {
		setTimeout(() => {
			serverMainLoop();
		}, 10 * 1000);
		return;
	}
	if (queryIndex >= queryServerList.length) {
		queryIndex = 0;
	}
	const queryServer = queryServerList[queryIndex];
	const group_id = queryServer[0].group_id;
	const queryGameId = queryServer[1].gameId;

	// 查询服务器信息状态
	try {
		const result = await addQueryServerDetail(queryGameId);
		// 是否已经关闭
		if (!result) {
			removeServerFromMainLoop(queryServer[0]);
			setTimeout(() => {
				serverMainLoop();
			}, 10 * 1000);
			return;
		}

		// 服务器是否换地图
		if (result.rotationIndex != queryServerList[queryIndex][1].rotationIndex) {
			queryServerList[queryIndex][1].rotationIndex = result.rotationIndex;
			queryServerList[queryIndex][1].currentTime = new Date().getTime();

			const lastMapName = translateMapModeName(queryServerList[queryIndex][1].mapName);
			const currentMapName = translateMapModeName(result.mapName);
			const message = `=======地图切换========\n【服名】: ${queryServer[0].zh_name
				.replace("[MINI ROBOT]", "")
				.replace("[mini robot]", "")}\n【上一局地图】: ${lastMapName}\n【当前地图】: ${currentMapName}\n当前是第 ${result.rotationIndex + 1} 张地图\n======================`;
			const serverManager = serverPlayerManagers.find((item: PlayerManager) => item.gameId == queryGameId);
			if (serverManager) {
				serverManager.gameEndEvent();
			}
			// 发送一局游戏结束事件
			sendMsgToQQGroup(group_id, message, null);
		}
		// logger.debug(`服务器${queryServer[0].name} 状态更新`);
		// 更新服务器状态
		queryServerList[queryIndex][1].mapName = result.mapName;
		queryServerList[queryIndex][1].mapMode = result.mapMode;
		queryServerList[queryIndex][1].soldier = result.slots.Soldier.current;
		queryServerList[queryIndex][1].spectator = result.slots.Spectator.current;
		queryServerList[queryIndex][1].queue = result.slots.Queue.current;
		queryIndex++;

		// 服务器玩家检测
		setTimeout(() => {
			serverPlayerCheckLoop(queryGameId, result.slots.Spectator.current);
		}, 4 * 1000);
	} catch (err) {
		logger.error(`查询服务器${queryServer[0].tag}信息失败`);
	}

	setTimeout(() => {
		serverMainLoop();
	}, 10 * 1000);
}

/** 服务器玩家检测循环 */
async function serverPlayerCheckLoop(queryGameId: number, spectatorCount: number): Promise<void> {
	// 前10个服务器
	const gameIdList = queryServerList.map((item) => item[1].gameId).slice(0, 10);

	try {
		const serverList = await gtAxios().get("bfv/players/", {
			params: {
				gameid: gameIdList.join(",")
			}
		});
		if (serverList.status !== 200) {
			return;
		}

		let spectators: Player[] | "cache" = "cache";
		// 是否有观战
		if (spectatorCount > 0) {
			const now = new Date().getTime();
			let lastWatchQueryTime = lastWatchQueryTimeDic[queryGameId] || 0;
			if (now - lastWatchQueryTime > watchQueryInterval) {
				lastWatchQueryTimeDic[queryGameId] = now;
				// 获取观战玩家信息
				try {
					let serverPlayers: any;
					serverPlayers = await bfvAxios().get("bfv/players", {
						params: {
							gameId: queryGameId
						}
					});
					if (serverPlayers.status === 200) {
						const bfvSpectators = serverPlayers.data.data.players.spectators;
						const spectatorList: Player[] = [];
						// 获得暖服玩家
						const warmPlayers = await getWarmPlayerList();

						for (const player of bfvSpectators) {
							spectatorList.push({
								name: player.name,
								personaId: player.personaId,
								team: Team.spectator,
								platoon: player.platoon,
								joinTime: player.join,
								warmTime: player.join,
								isWarmed: warmPlayers.includes(player.name),
								isBot: false
							});
						}
						spectators = spectatorList;
					} else {
						spectators = "cache";
					}
				} catch (e) {
					spectators = "cache";
				}
			} else {
				spectators = "cache";
			}
		}

		// 更新服务器玩家信息
		if (gameIdList.length == 1) {
			const gameId = gameIdList[0].toString();
			updatePlayerManagers(
				{ [gameId]: serverList.data },
				queryServerList.map((item) => item[0]),
				queryGameId,
				spectators
			);
		} else {
			updatePlayerManagers(
				serverList.data,
				queryServerList.map((item) => item[0]),
				queryGameId,
				spectators
			);
		}
	} catch (err) {
		const error = err as AxiosError;
		logger.error("服务器玩家检测失败: ", error.code);
	}
}

/** 获取所有服务器的状态 */
export function getAllServerStatus(): ServerStatus[] {
	const serverList = queryServerList.map((item) => item[1]);
	return serverList;
}
