import { handlePlayerVehicle, handlePlayerWeapon } from "../../common/handleData/handlePlayerWeapon";
import { PlayerLife } from "../../interface/player";
import { Player, PlayerManager, ServerAdmin, ServerConfig, ServerLog, ServerPlayers, ServerStatus, Team } from "../../interface/ServerInfo";
import { filterGroupMember } from "../../qq/memberManager";
import { sendMsgToQQGroup } from "../../qq/sendMessage";
import { fuzzySearch } from "../../utils/fuzzyQuery";
import logger from "../../utils/logger";
import { isLocalBlackList, isTempBlackList, removeTempBlackList } from "../ban/backListManager";
import { checkCardQueue } from "../cardQueue";
import { addDelGroupOnlineMember } from "../hs/onlineHistory";
import { addWarmPlayer, getWarmPlayerList } from "../hs/warmServer";
import { serverAutoSayUpdate } from "../serverSayManager";
import { getBotList } from "./botManager";
import { banPlayer, checkPlayersLife, checkPlayersWeaponVehicle, deletePlayerLifeCache, getPlayerLifeCache, kickPlayer } from "./checkPlayer";
import { addToQueue } from "./settlement";

/** 服务器内玩家管理器 */
export let serverPlayerManagers: ServerPlayerManager[] = [];

// 观战缓存
let spectatorCache: { [gameId: string]: Player[] } = {};

/** 更新服务器玩家信息 */
export async function updatePlayerManagers(serverDict: { [key: string]: any }, serverConfigList: ServerConfig[], queryGameId: number, spectators: Player[] | "cache") {
	// 查看，记录bot玩家，并排除bot玩家
	const botList = await getBotList();
	// 查看在serverList中是否有新服务器，有则创建新的ServerPlayerManager
	let gameIdList = Object.keys(serverDict);
	for (const gameId of gameIdList) {
		const serverData = serverDict[gameId];
		const serverName = serverData.serverinfo.name;
		const mapName = serverData.serverinfo.level;
		const mapMode = serverData.serverinfo.mode;
		const serverConfig = serverConfigList.find((config) => config.zh_name == serverName || config.en_name == serverName);
		if (!serverConfig) {
			logger.warn(`未找到服务器配置：${serverName}`);
			continue;
		}
		// 获得暖服玩家
		const warmPlayers = await getWarmPlayerList();

		const team1: Player[] = serverData.teams[0].players.map((player: any): Player => {
			return {
				name: player.name,
				personaId: player.player_id,
				team: Team.one,
				platoon: player.platoon,
				joinTime: player.join_time,
				warmTime: player.join_time,
				isWarmed: warmPlayers.includes(player.name),
				isBot: botList.includes(player.name)
			};
		});
		const team2: Player[] = serverData.teams[1].players.map((player: any): Player => {
			return {
				name: player.name,
				personaId: player.player_id,
				team: Team.two,
				platoon: player.platoon,
				joinTime: player.join_time,
				warmTime: player.join_time,
				isWarmed: warmPlayers.includes(player.name),
				isBot: botList.includes(player.name)
			};
		});
		const queue: Player[] = serverData.que.map((player: any): Player => {
			return {
				name: player.name,
				personaId: player.player_id,
				team: Team.queue,
				platoon: player.platoon,
				joinTime: player.join_time,
				warmTime: player.join_time,
				isWarmed: warmPlayers.includes(player.name),
				isBot: botList.includes(player.name)
			};
		});

		// 卡排队检测
		checkCardQueue(serverConfig, team1, team2, queue, gameId);

		let spectator: Player[] = [];
		if (queryGameId.toString() == gameId) {
			if (spectators === "cache") {
				spectator = spectatorCache[gameId] || [];
			} else {
				spectator = spectators || [];
				spectatorCache[gameId] = spectators || [];
			}
		} else {
			spectator = spectatorCache[gameId] || [];
		}

		if (team1.length == 0 && team2.length == 0 && queue.length == 0) {
			continue;
		}
		const serverPlayers: ServerPlayers = {
			soldier: team1.concat(team2),
			queue,
			spectator: spectator,
			bot: team1.concat(team2).filter((player) => player.isBot === true)
		};
		const serverPlayerManager = serverPlayerManagers.find((manager: PlayerManager) => manager.gameId == parseInt(gameId));
		if (serverPlayerManager) {
			serverPlayerManager.update(mapName, mapMode, serverPlayers);
		} else {
			const newServerPlayerManager = new ServerPlayerManager(parseInt(gameId), mapName, mapMode, serverConfig, serverPlayers);
			serverPlayerManagers.push(newServerPlayerManager);
		}
	}
}

/** 关服事件 */
export async function closeServerPlayerManager(gameId: number): Promise<void> {
	const serverPlayerManager = serverPlayerManagers.find((manager: PlayerManager) => manager.gameId == gameId);
	if (serverPlayerManager) {
		await serverPlayerManager.closeEvent();
		serverPlayerManagers.splice(serverPlayerManagers.indexOf(serverPlayerManager), 1);
	}
}

/** 在所有服务器中查询一个玩家 */
export function queryPlayer(playerName: string): { player: Player; queryPlayerLife: PlayerLife | null; serverPlayerManager: PlayerManager } | null {
	for (const serverPlayerManager of serverPlayerManagers) {
		const players = serverPlayerManager.players.soldier.concat(serverPlayerManager.players.queue, serverPlayerManager.players.spectator);
		const player = players.find((player) => player.name === playerName);
		if (player) {
			const queryPlayerLife = getPlayerLifeCache(player.personaId);
			return { player, queryPlayerLife, serverPlayerManager };
		}
	}
	return null;
}

/** 查询名字最接近的玩家 */
export function queryNearlyName(playerName: string): string[] {
	// 所有玩家名的列表
	const allServerPlayerNames: string[] = [];
	for (const serverPlayerManager of serverPlayerManagers) {
		const players = serverPlayerManager.players.soldier.concat(serverPlayerManager.players.queue, serverPlayerManager.players.spectator);
		const playerNames = players.map((player: Player) => player.name);
		allServerPlayerNames.push(...playerNames);
	}
	// 找出所有名字最接近的玩家
	const nearlyPlayers = fuzzySearch(playerName, allServerPlayerNames);
	return nearlyPlayers;
}

/** 获取对应tag服务器的日志 */
export function getServerLog(tag: string, count: number): string {
	const server = serverPlayerManagers.find((manager) => manager.tag == tag);
	let message = "";
	if (server) {
		let index = 0;
		for (let i = server.serverLog.length - 1; i >= 0; i--) {
			if (index >= count) {
				break;
			}
			const log = server.serverLog[i];
			if (log.action === "join") {
				message += `${log.time.toLocaleString("zh-CN").split(",")[1]} ${log.playerName} [${log.team}] 加入=>\n`;
				message += `${log.time.toLocaleString("zh-CN").split(",")[1]} ${log.playerName} 离开\n`;
			}
			index++;
		}
	}
	if (message == "") {
		message = "暂无日志";
	}
	return message;
}

/** 服务器内玩家管理器 */
class ServerPlayerManager implements PlayerManager {
	tag: string;
	serverName: string;
	serverConfig: ServerConfig;
	gameId: number;
	mapName: string;
	mapMode: string;
	players: ServerPlayers;
	serverLog: ServerLog[];
	isWarm: boolean;

	constructor(gameId: number, mapName: string, mapMode: string, serverConfig: ServerConfig, players: ServerPlayers) {
		this.tag = serverConfig.tag;
		this.serverName = serverConfig.zh_name;
		this.serverConfig = serverConfig;
		this.gameId = gameId;
		this.mapName = mapName;
		this.mapMode = mapMode;

		this.players = players;
		this.joinEvent(players.soldier);

		this.serverLog = [];
		if (players.soldier.length > serverConfig.warm_player) {
			this.isWarm = true;
		} else {
			this.isWarm = false;
		}
	}

	/** 更新服务器玩家信息 */
	async update(mapName: string, mapMode: string, players: ServerPlayers): Promise<void> {
		this.mapName = mapName;
		this.mapMode = mapMode;

		// 处理暖服事件
		let afterWarmEventPlayers = await this.warmEvent(players);

		// 比较新旧玩家列表，更新日志
		const oldPlayers = this.players.soldier.concat(this.players.spectator);
		const newPlayers = afterWarmEventPlayers.soldier.concat(afterWarmEventPlayers.spectator);
		// 找出新加入的玩家和离开的玩家
		let joinPlayers = newPlayers.filter((player) => !oldPlayers.some((oldPlayer) => oldPlayer.personaId === player.personaId)).filter((player) => player.isBot === false);
		let leavePlayers = oldPlayers.filter((player) => !newPlayers.some((newPlayer) => newPlayer.personaId === player.personaId)).filter((player) => player.isBot === false);

		// 队列预加载玩家的加入和离开
		let queueJoinPlayers = afterWarmEventPlayers.queue
			.filter((player) => !this.players.queue.some((oldPlayer) => oldPlayer.personaId === player.personaId))
			.filter((player) => player.isBot === false);
		let queueLeavePlayers = this.players.queue
			.filter((player) => !afterWarmEventPlayers.queue.some((newPlayer) => newPlayer.personaId === player.personaId))
			.filter((player) => player.isBot === false);

		// 更新玩家列表
		this.players = afterWarmEventPlayers;
		this.players.bot = players.bot;

		// 服务器自动播报模块
		serverAutoSayUpdate(this.gameId, this.serverConfig, afterWarmEventPlayers, this.isWarm);

		// 执行进入事件
		if (joinPlayers.length > 0) {
			this.joinEvent(joinPlayers);
		}
		// 执行离开事件
		if (leavePlayers.length > 0) {
			this.leaveEvent(leavePlayers);
		}

		if (queueJoinPlayers.length > 0) {
			this.joinEvent(queueJoinPlayers);
		}
		if (queueLeavePlayers.length > 0) {
			this.leaveEvent(queueLeavePlayers);
		}

		// 生成日志
		const joinLog: ServerLog[] = joinPlayers.map((player) => ({
			time: new Date(),
			playerName: player.name,
			personaId: player.personaId,
			team: player.team,
			platoon: player.platoon,
			action: "join"
		}));
		const leaveLog: ServerLog[] = leavePlayers.map((player) => ({
			time: new Date(),
			playerName: player.name,
			personaId: player.personaId,
			team: player.team,
			platoon: player.platoon,
			action: "leave"
		}));
		if (joinLog.length > 0 || leaveLog.length > 0) {
			this.serverLog = this.serverLog.concat(joinLog, leaveLog);
		}
	}

	/** 一局结束事件 */
	async gameEndEvent(): Promise<void> {
		logger.debug(`服务器: ${this.serverName} 一局结束========================>>>>>>>>>`);

		for (const player of this.players.soldier) {
			addToQueue(this.gameId, this.serverConfig, player);
		}
	}

	/** 暖服事件 */
	async warmEvent(players: ServerPlayers): Promise<ServerPlayers> {
		// 去除bot
		let newSoldier = players.soldier.filter((player) => !player.isBot);

		if (this.isWarm) {
			// 是否凉服
			if (newSoldier.length < this.serverConfig.warm_player) {
				sendMsgToQQGroup(this.serverConfig.group_id, `服务器: ${this.serverName} 凉服了快来暖服!\n当前人数: ${newSoldier.length}/64`, null);

				// 更新所有玩家的warmTime
				newSoldier.forEach((player) => {
					// 补齐为16位时间戳
					player.warmTime = new Date().getTime() * 1000;
					player.isWarmed = false;
				});
				this.isWarm = false;
			}
		} else {
			// 是否暖服成功
			if (newSoldier.length >= 42) {
				this.isWarm = true;

				// 记录暖服玩家，按着joinTime倒序排序，取前十名
				const team1 = newSoldier
					.filter((player) => player.team === Team.one)
					.sort((a, b) => a.warmTime - b.warmTime)
					.slice(0, this.serverConfig.warm_player / 2);
				const team2 = newSoldier
					.filter((player) => player.team === Team.two)
					.sort((a, b) => a.warmTime - b.warmTime)
					.slice(0, this.serverConfig.warm_player / 2);

				// 记录暖服玩家数据
				const warmPlayers = team1.concat(team2).filter((player) => !player.isWarmed);
				await addWarmPlayer(this.serverName, warmPlayers);

				// 查询暖服玩家是否有超杀临时黑名单记录
				warmPlayers.forEach(async (player) => {
					const isTempBlack = await isTempBlackList(player.personaId);
					if (isTempBlack.length > 0) {
						// 解除临时黑名单
						await removeTempBlackList(player.personaId);
						sendMsgToQQGroup(this.serverConfig.group_id, `暖服玩家[${player.name}]\n已自动解除临时黑名单`, null);
					}
				});

				// 设置暖服玩家的isWarmed为true
				newSoldier.forEach((player) => {
					if (warmPlayers.some((warmPlayer) => warmPlayer.personaId === player.personaId)) {
						player.isWarmed = true;
					}
				});
				let content = `服务器: ${this.serverName} 暖服成功!\n暖服名单: \n`;
				for (const player of warmPlayers) {
					const time = ((new Date().getTime() - player.warmTime / 1000) / 1000 / 60).toFixed(1);
					content += `${player.name} [暖 ${time} 分钟]\n`;
				}
				content += `当前人数: ${newSoldier.length}/64\n以上玩家将有16小时的暖服权益`;
				sendMsgToQQGroup(this.serverConfig.group_id, content, null);

				// TODO: 是否有超杀玩家暖服，有则移出超杀黑名单
			} else {
				// 暖服超过30分钟直接计入暖服
				// for (const player of newSoldier) {
				//     // 当前时间与上次凉服时间差
				//     const timeDiff = new Date().getTime() - (player.warmTime / 1000);
				//     if (timeDiff > 40 * 60 * 1000 && !player.isWarmed) {
				//         // TODO: 记录暖服玩家数据
				//         logger.debug(`玩家 ${player.name} 暖服超过40分钟直接计入暖服`);
				//         sendMsgToQQGroup(this.serverConfig.group_id, `玩家: ${player.name}\n暖服超过40分钟直接计入暖服`, null);
				//         await addWarmPlayer(this.serverName, [player]);
				//         player.isWarmed = true;
				//         // TODO: 是否有超杀玩家暖服，有则移出超杀黑名单
				//     }
				// }
			}
		}
		return {
			soldier: newSoldier,
			queue: players.queue,
			spectator: players.spectator,
			bot: players.bot
		};
	}

	/** 玩家进入事件 */
	async joinEvent(players: Player[]) {
		logger.info(`玩家: ${players.map((player) => player.name).join(", ")} 进入==> ${this.serverName}`);

		// 是否是群友
		const groupList = await filterGroupMember(this.serverConfig.group_id, players);
		if (!this.isWarm && this.players.soldier.length <= this.serverConfig.warm_player && groupList.length > 0) {
			// 暖服播报
			let newServerName = this.serverName.replace("[MINI ROBOT]", "").replace("[mini robot]", "");
			sendMsgToQQGroup(
				this.serverConfig.group_id,
				`${newServerName}\n玩家: ${groupList.map((player) => player.name).join(", ")}\n正在暖服!!!\n当前人数: ${this.players.soldier.length}/64`,
				null
			);
		}

		const warmPlayerList = await getWarmPlayerList();
		let newPlayerlist = [];
		for (const player of players) {
			if (warmPlayerList.some((warmPlayr) => warmPlayr === player.name)) {
				player.isWarmed = true;
				newPlayerlist.push(player);
			} else {
				newPlayerlist.push(player);
			}
		}

		// 是否是临时黑名单玩家
		for (let player of players) {
			const isLocalBlack = await isTempBlackList(player.personaId);
			if (isLocalBlack.length > 0) {
				// 是否为暖服期间
				if (this.isWarm) {
					// 直接踢出
					const reason = `${isLocalBlack[0].reason_type}临时黑名单[${isLocalBlack[0].reason_text}]`;
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
					kickPlayer(this.gameId, tempPlayerLife, player.joinTime, reason, this.serverConfig, admin, true);
				}
			}
		}

		// 屏蔽黑名单玩家(除超杀黑名单外)
		for (const player of newPlayerlist) {
			const isLocalBlack = await isLocalBlackList(player.personaId);
			let isBlack = false;
			let reason = "";
			let admin: ServerAdmin = { name: "", user_id: 0 };
			if (isLocalBlack.length > 0) {
				isBlack = true;
				if (this.serverConfig.tv) {
					reason = `${isLocalBlack[0].reason}`;
				} else {
					reason = `本地黑名单[${isLocalBlack[0].reason}]`;
				}
				admin = { name: isLocalBlack[0].admin_name, user_id: isLocalBlack[0].admin_qq };
			}
			// 踢出黑名单玩家
			if (isBlack) {
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
				banPlayer(this.gameId, tempPlayerLife, player.joinTime, reason, this.serverConfig, admin, true);
			}
		}

		// 检测生涯数据，超过限制直接踢出
		checkPlayersLife(this.gameId, newPlayerlist, this.serverConfig, this.isWarm);
		// 检测武器数据是否异常，异常则踢出
		checkPlayersWeaponVehicle(this.gameId, players, this.serverConfig);

		// 上线记录，群昵称显示-游戏中
		addDelGroupOnlineMember(this.serverConfig.group_id, this.serverName, newPlayerlist, true);
	}

	/** 玩家离开事件 */
	async leaveEvent(players: Player[]): Promise<void> {
		logger.info(`玩家: ${players.map((player) => player.name).join(", ")} 离开 ${this.serverName}`);

		for (const player of players) {
			// 清除详细数据缓存
			deletePlayerLifeCache(player.personaId);
		}

		// 群昵称取消-游戏中
		await addDelGroupOnlineMember(this.serverConfig.group_id, this.serverName, players, false);

		players.forEach((player) => {
			addToQueue(this.gameId, this.serverConfig, player);
		});
	}

	/** 服务器关闭事件 */
	async closeEvent(): Promise<void> {
		// 记录服务器关闭日志
		logger.info(`服务器 ${this.serverName}(${this.gameId}) ======>关闭`);

		// 退出所有玩家
		let players = this.players.soldier;
		players = players.concat(this.players.queue);
		players = players.concat(this.players.spectator);

		for (const player of players) {
			// 清除详细数据缓存
			deletePlayerLifeCache(player.personaId);
		}

		// 群昵称取消-游戏中
		await addDelGroupOnlineMember(this.serverConfig.group_id, this.serverName, players, false);
	}
}

/** 查找加群玩家是否在线 */
export function handleAddGroupPlayerIsOnline(group_id: number, playerName: string): void {
	// 查找玩家是否在线
	for (const serverPlayerManager of serverPlayerManagers) {
		const res = serverPlayerManager.players.soldier.find((player) => player.name == playerName);
		if (res) {
			addDelGroupOnlineMember(group_id, serverPlayerManager.serverName, [res], true);
			return;
		}
	}
}
