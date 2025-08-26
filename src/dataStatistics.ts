import { readConfigFile } from "./utils/localFile";
import { WebSocket } from "ws";
import logger from "./utils/logger";
import { bfvAxios, gtAxios } from "./utils/axios";
import path from "path";
import { SQLiteDB } from "./utils/sqlite";
import { sendBase64ImgToQQGroup, sendMsgToQQGroup } from "./qq/sendMessage";
import { htmlToBase64Image } from "./qq/generateBase64Image";
import express from "express";
import { Axios, AxiosError } from "axios";
import { getVersion } from "./utils/version";
import { Team } from "./interface/ServerInfo";

getVersion();

// 连接ws和http状态
const { ws_ip, ws_token, status_token, group_name } = readConfigFile();
const ws: WebSocket = new WebSocket(`ws://${ws_ip}/`, {
	headers: {
		Authorization: `Bearer ${ws_token}`
	}
});

// 类型约束
type Weapons = { name: string; categories: string; kills: number; timeEquipped: number };
type Vehicles = { name: string; categories: string; kills: number; timeEquipped: number };
type Gadgets = { name: string; categories: string; kills: number; timeEquipped: number };
type PlayerDetail = {
	name: string;
	personaId: number;
	team: Team;
	kills: number;
	killAssists: number; // 助攻
	heals: number; // 治疗分
	revives: number; // 救援数
	headshots: number; // 爆头数
	awardScore: number; // 奖励分
	bonusScore: number; // 奖金分
	squadScore: number; // 小队分
	totalScore: number; // 总分
	deaths: number;
	wins: number;
	loses: number;
	timePlayed: number;
	timestamp: number;
	weapons: Weapons[];
	vehicles: Vehicles[];
	gadgets: Gadgets[];
};

/** 玩家详细数据缓存 */
let detailDataCache: PlayerDetail[] = [];

/** 关服时间隔 */
const stopInterval = 60 * 15; // 15分钟
/** 开服时间隔 */
const startInterval = 60 * 4; // 5分钟

let count = 60 * 15;
let isOpening = false;

/** 当前查询时间 */
let currentQueryTime = 0;
/** 间隔查询时间 */
const queryInterval = 60; // 1分钟

// 数据库相关配置
const dbPath = path.join(process.cwd(), "data", "playerDetails.db");
const createPlayerDetailsTableSql = `CREATE TABLE IF NOT EXISTS playerDetails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    personaId INTEGER,
    kills INTEGER,
    deaths INTEGER,
    wins INTEGER,
    loses INTEGER,
    timePlayed INTEGER,
    killAssists INTEGER,
    heals INTEGER,
    revives INTEGER,
    headshots INTEGER,
    awardScore INTEGER,
    bonusScore INTEGER,
    squadScore INTEGER,
    totalScore INTEGER,
    timestamp INTEGER
)`;
const createWeaponsTableSql = `CREATE TABLE IF NOT EXISTS weapons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playerName TEXT,
    personaId INTEGER,
    name TEXT,
    categories TEXT,
    kills INTEGER,
    timeEquipped INTEGER,
    timestamp INTEGER
)`;
const createVehiclesTableSql = `CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playerName TEXT,
    personaId INTEGER,
    name TEXT,
    categories TEXT,
    kills INTEGER,
    timeEquipped INTEGER,
    timestamp INTEGER
)`;
const createGadgetsTableSql = `CREATE TABLE IF NOT EXISTS gadgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playerName TEXT,
    personaId INTEGER,
    name TEXT,
    categories TEXT,
    kills INTEGER,
    timeEquipped INTEGER,
    timestamp INTEGER
)`;

// 处理WebSocket连接
function handleWebSocket() {
	ws.on("open", () => {
		logger.info("WS 已连接");
	});

	ws.on("message", async (data) => {
		try {
			const e = JSON.parse(data.toString());
			if (e.message === "token验证失败") {
				logger.error("WS 验证失败, 请检查token是否正确\n请确认config.json中的status_token是否正确");
			} else {
				switch (e.post_type) {
					case "meta_event":
						handleMetaEvent(e);
						break;
					case "message":
						if (e.message_type === "group") {
							handleGroupMessage(e);
						}
						break;
				}
			}
		} catch (error) {
			logger.error(`处理WebSocket消息时出错: ${error}`);
		}
	});

	ws.on("close", (code) => {
		logger.info(`WS 已关闭: ${code}`);
	});

	ws.on("error", (err) => {
		logger.error(`WS 发生错误: ${err.message}`);
	});
}

// 处理元事件
function handleMetaEvent(e: any) {
	if (e.meta_event_type === "lifecycle") {
		// 可添加生命周期事件处理逻辑
	} else if (e.meta_event_type === "heartbeat") {
		// logger.info(`WebSocket 心跳包:online:${e.status.online},good:${e.status.good}`);
	}
}

// 处理群消息
async function handleGroupMessage(e: any) {
	const { message_id, group_id, user_id, raw_message, sender } = e;
	const regex1 = /^rank(=|＝)(\S+)$/;
	const regex2 = /^record(=|＝)(\S+)$/;

	if (raw_message == "rank") {
		// 是否在间隔时间外
		const now = new Date().getTime();
		if (now - currentQueryTime < queryInterval * 1000) {
			const currentInterval = Math.floor((currentQueryTime + queryInterval * 1000 - now) / 1000);
			sendMsgToQQGroup(group_id, `查询间隔时间太短\n请${currentInterval}秒后再试`, message_id);
			return;
		}
		currentQueryTime = now;
		sendMsgToQQGroup(e.group_id, "正在查询排行榜, 请稍后...", message_id);
		drawRankList(e.group_id);
	} else if (regex1.test(raw_message)) {
		const name = raw_message.match(regex1)![2];
		const message = await queryPlayer(name);
		sendMsgToQQGroup(group_id, message, message_id);
	} else if (regex2.test(raw_message)) {
		const name = raw_message.match(regex2)![2];
		const message = await queryPlayerDetail(name);
		sendMsgToQQGroup(group_id, message, message_id);
	}
}

// 主循环
function main() {
	// 凌晨4点清空缓存
	if (new Date().getHours() == 4 && detailDataCache.length > 0) {
		detailDataCache = [];
	}

	count++;

	if (isOpening) {
		if (count > startInterval) {
			count = 0;
			query();
		}
	} else {
		if (count > stopInterval) {
			count = 0;
			query();
		}
	}
}

// 查询服务器和玩家数据
async function query() {
	logger.debug(`开始查询${group_name}服务器列表`);
	try {
		const serverRes = await gtAxios().get("bfv/servers/", {
			params: {
				name: group_name
			},
			timeout: 30000
		});

		const server = serverRes.data.servers;

		if (!server || server.length === 0) {
			logger.warn(`没有服务器: ${group_name}`);
			isOpening = false;
			return;
		}
		isOpening = true;

		logger.debug(`服务器列表: ${server.map((server: any) => server.gameId).join(",")}，开始查询服务器内部玩家列表`);
		const gameIdStr = server.map((server: any) => server.gameId).join(",");

		try {
			const playerRes = await gtAxios().get("bfv/players/", {
				params: {
					gameid: gameIdStr
				},
				timeout: 30000
			});

			let allPlayers: any[] = [];

			const serverData = playerRes.data;
			if (server.length === 1) {
				let team1 = serverData.teams[0].players;
				let team2 = serverData.teams[1].players;
				team1.forEach((player: any) => {
					player.team = Team.one;
				});
				team2.forEach((player: any) => {
					player.team = Team.two;
				});
				allPlayers = [...team1, ...team2];
			} else {
				for (let i = 0; i < server.length; i++) {
					const gameId = server[i].gameId;
					if (!serverData[gameId] || !serverData[gameId].teams) {
						continue;
					}
					let team1 = serverData[gameId].teams[0].players;
					// 添加队伍标签属性
					team1.forEach((player: any) => {
						player.team = Team.one;
					});

					let team2 = serverData[gameId].teams[1].players;
					team2.forEach((player: any) => {
						player.team = Team.two;
					});

					// 合并队伍数据
					allPlayers.push(...team1, ...team2);
				}
			}

			if (allPlayers.length === 0) {
				logger.debug(`服务器${group_name}无玩家，玩家数据: ${allPlayers.length} 个`);
				return;
			}
			logger.debug(`服务器${group_name}玩家列表共: ${allPlayers.length}个，开始查询玩家详细数据`);
			let playerPersonaIds: number[] = allPlayers.map((player: any) => player.player_id);

			const leafPlayers = detailDataCache.filter((player: any) => !playerPersonaIds.includes(player.personaId));
			if (leafPlayers.length > 0) {
				playerPersonaIds.push(...leafPlayers.map((player: any) => player.personaId));
			}

			try {
				const detailRes = await bfvAxios().post("worker/player/getBatchAllStats", { personaIds: playerPersonaIds, detail: true, timeout: 60000 });
				const detailData = detailRes.data.data;

				for (let i = 0; i < detailData.length; i++) {
					const player = detailData[i];
					const personaId = player.personaId;
					const isLeafPlayer = leafPlayers.find((player: any) => player.personaId == personaId);
					const name = isLeafPlayer ? isLeafPlayer.name : allPlayers.find((player: any) => player.player_id == personaId).name;
					const team = isLeafPlayer ? isLeafPlayer.team : allPlayers.find((player: any) => player.player_id == personaId).team;

					const newPlayer: PlayerDetail = {
						name,
						personaId,
						team,
						kills: player.kills,
						deaths: player.deaths,
						wins: player.wins,
						loses: player.loses,
						timePlayed: player.timePlayed,
						killAssists: player.killAssists,
						heals: player.heals,
						revives: player.revives,
						headshots: player.headshots,
						awardScore: player.awardScore,
						bonusScore: player.bonusScore,
						squadScore: player.squadScore,
						totalScore: player.totalScore,
						timestamp: new Date().getTime(),
						weapons: player.weapons.map((weapon: any) => ({
							name: weapon.name,
							categories: weapon.categories,
							kills: weapon.kills,
							timeEquipped: weapon.timeEquipped
						})),
						vehicles: player.vehicles.map((vehicle: any) => ({
							name: vehicle.name,
							categories: vehicle.categories,
							kills: vehicle.kills,
							timeEquipped: vehicle.timeEquipped
						})),
						gadgets: player.gadgets.map((gadget: any) => ({
							name: gadget.name,
							categories: gadget.categories,
							kills: gadget.kills,
							timeEquipped: gadget.timeEquipped
						}))
					};

					const cachePlayer = detailDataCache.find((player: any) => player.personaId == personaId);
					if (cachePlayer) {
						// 有没有personaId相同，但team不同的数据
						if (cachePlayer.team != newPlayer.team) {
							// 更新缓存
							const index = detailDataCache.findIndex((player: any) => player.personaId == personaId);
							detailDataCache[index] = newPlayer;
						} else {
							const diff = calculateDiff(cachePlayer, newPlayer);
							if (diff.diffKills != 0) {
								logger.debug(formatDiffMessage(name, personaId, diff));
								await saveData(name, personaId, diff);
								if (isLeafPlayer) {
									detailDataCache = detailDataCache.filter((player: any) => player.personaId != personaId);
								} else {
									const index = detailDataCache.findIndex((player: any) => player.personaId == personaId);
									detailDataCache[index] = newPlayer;
								}
							}
						}
					} else {
						detailDataCache.push(newPlayer);
						logger.info(formatNewPlayerMessage(newPlayer));
					}
				}
			} catch (e) {
				const error = e as AxiosError;
				count = startInterval / 2;
				logger.warn(`BFV查询服务器玩家详细战绩数据失败: ${error.message}`);
			}
		} catch (e) {
			const error = e as AxiosError;
			const errorData: any = error.response?.data;
			if (errorData && errorData.errors && errorData.errors[0] === "server not found") {
				logger.info(`未查询到服务器: ${group_name}`);
			} else if (error.status === 401) {
				logger.info(`服务器当前无玩家`);
			} else {
				count = startInterval / 2;
				logger.error(`GT查询服务器${group_name}玩家列表失败: ${error.message}`);
			}
		}
	} catch (e) {
		const error = e as AxiosError;
		count = startInterval / 2;
		logger.warn(`GT查询社区服务器列表失败: ${error.message}`);
	}
}

// 计算差异
function calculateDiff(cachePlayer: PlayerDetail, newPlayer: PlayerDetail) {
	const diffKills = newPlayer.kills - cachePlayer.kills;
	const diffDeaths = newPlayer.deaths - cachePlayer.deaths;
	const diffWins = newPlayer.wins - cachePlayer.wins;
	const diffloses = newPlayer.loses - cachePlayer.loses;
	const diffTimePlayed = newPlayer.timePlayed - cachePlayer.timePlayed;

	const diffKillAssists = newPlayer.killAssists - cachePlayer.killAssists;
	const diffHeals = newPlayer.heals - cachePlayer.heals;
	const diffRevives = newPlayer.revives - cachePlayer.revives;
	const diffHeadshots = newPlayer.headshots - cachePlayer.headshots;

	const diffAwardScore = newPlayer.awardScore - cachePlayer.awardScore;
	const diffBonusScore = newPlayer.bonusScore - cachePlayer.bonusScore;
	const diffSquadScore = newPlayer.squadScore - cachePlayer.squadScore;
	const diffTotalScore = newPlayer.totalScore - cachePlayer.totalScore;

	const diffWeapons = getDiffItems(cachePlayer.weapons, newPlayer.weapons);
	const diffVehicles = getDiffItems(cachePlayer.vehicles, newPlayer.vehicles);
	const diffGadgets = getDiffItems(cachePlayer.gadgets, newPlayer.gadgets);

	return {
		diffKills,
		diffDeaths,
		diffWins,
		diffloses,
		diffTimePlayed,
		diffKillAssists,
		diffHeals,
		diffRevives,
		diffHeadshots,
		diffAwardScore,
		diffBonusScore,
		diffSquadScore,
		diffTotalScore,
		diffWeapons,
		diffVehicles,
		diffGadgets
	};
}

// 获取差异项
function getDiffItems(cacheItems: any[], newItems: any[]) {
	const diffItems = [];
	for (let i = 0; i < newItems.length; i++) {
		const newItem = newItems[i];
		const cacheItem = cacheItems.find((cacheItem: any) => cacheItem.name == newItem.name);
		if (cacheItem) {
			const diffKills = newItem.kills - cacheItem.kills;
			const diffTimeEquipped = newItem.timeEquipped - cacheItem.timeEquipped;
			if (diffKills != 0) {
				diffItems.push({
					name: newItem.name,
					categories: newItem.categories,
					kills: diffKills,
					timeEquipped: diffTimeEquipped
				});
			}
		}
	}
	return diffItems;
}

// 格式化差异消息
function formatDiffMessage(name: string, personaId: number, diff: any) {
	return `玩家新增一条记录：${name} ${personaId} \n击杀：${diff.diffKills} 死亡：${diff.diffDeaths} 胜利：${diff.diffWins} 失败：${diff.diffloses} 时长：${diff.diffTimePlayed} 助攻：${
		diff.diffKillAssists
	} 治疗：${diff.diffHeals} 救援：${diff.diffRevives} 爆头：${diff.diffHeadshots} 奖励分：${diff.diffAwardScore} 附加分：${diff.diffBonusScore} 小队分：${diff.diffSquadScore} 总分：${
		diff.diffTotalScore
	} \n武器：${diff.diffWeapons.map((weapon: any) => `${weapon.name} ${weapon.categories} ${weapon.kills} ${weapon.timeEquipped}`).join(",")} \n载具：${diff.diffVehicles
		.map((vehicle: any) => `${vehicle.name} ${vehicle.categories} ${vehicle.kills} ${vehicle.timeEquipped}`)
		.join(",")} \n配备：${diff.diffGadgets.map((gadget: any) => `${gadget.name} ${gadget.categories} ${gadget.kills} ${gadget.timeEquipped}`).join(",")}`;
}

// 格式化新玩家消息
function formatNewPlayerMessage(player: PlayerDetail) {
	return `玩家新增一条缓存记录：${player.name} ${player.personaId} 总击杀: ${player.kills} 总死亡: ${player.deaths} 总胜利: ${player.wins} 总失败: ${player.loses} 总时长: ${player.timePlayed} 总助攻: ${player.killAssists} 总治疗: ${player.heals} 总救援: ${player.revives} 总爆头: ${player.headshots} 奖励分: ${player.awardScore} 附加分: ${player.bonusScore} 小队分: ${player.squadScore} 总分: ${player.totalScore}`;
}

// 保存数据
async function saveData(
	name: string,
	personaId: number,
	diff: {
		diffKills: number;
		diffDeaths: number;
		diffWins: number;
		diffloses: number;
		diffTimePlayed: number;
		diffKillAssists: number;
		diffHeals: number;
		diffRevives: number;
		diffHeadshots: number;
		diffAwardScore: number;
		diffBonusScore: number;
		diffSquadScore: number;
		diffTotalScore: number;
		diffWeapons: Weapons[];
		diffVehicles: Vehicles[];
		diffGadgets: Gadgets[];
	}
) {
	const timestamp = new Date().getTime();
	const db = new SQLiteDB(dbPath, createPlayerDetailsTableSql);
	try {
		await db.open();
		await db.execute(createWeaponsTableSql);
		await db.execute(createVehiclesTableSql);
		await db.execute(createGadgetsTableSql);

		const sql = `INSERT INTO playerDetails (name, personaId, kills, deaths, wins, loses, timePlayed, killAssists, heals, revives, headshots, awardScore, bonusScore, squadScore, totalScore, timestamp) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
		const params = [
			name,
			personaId,
			diff.diffKills,
			diff.diffDeaths,
			diff.diffWins,
			diff.diffloses,
			diff.diffTimePlayed,
			diff.diffKillAssists,
			diff.diffHeals,
			diff.diffRevives,
			diff.diffHeadshots,
			diff.diffAwardScore,
			diff.diffBonusScore,
			diff.diffSquadScore,
			diff.diffTotalScore,
			timestamp
		];
		await db.execute(sql, params);

		const weaponSql = `INSERT INTO weapons (playerName, personaId, name, categories, kills, timeEquipped, timestamp) VALUES (?,?,?,?,?,?,?)`;
		const vehicleSql = `INSERT INTO vehicles (playerName, personaId, name, categories, kills, timeEquipped, timestamp) VALUES (?,?,?,?,?,?,?)`;
		const gadgetSql = `INSERT INTO gadgets (playerName, personaId, name, categories, kills, timeEquipped, timestamp) VALUES (?,?,?,?,?,?,?)`;

		diff.diffWeapons.forEach((weapon: Weapons) => {
			const params = [name, personaId, weapon.name, weapon.categories, weapon.kills, weapon.timeEquipped, timestamp];
			db.execute(weaponSql, params);
		});
		diff.diffVehicles.forEach((vehicle: Vehicles) => {
			const params = [name, personaId, vehicle.name, vehicle.categories, vehicle.kills, vehicle.timeEquipped, timestamp];
			db.execute(vehicleSql, params);
		});
		diff.diffGadgets.forEach((gadget: Gadgets) => {
			const params = [name, personaId, gadget.name, gadget.categories, gadget.kills, gadget.timeEquipped, timestamp];
			db.execute(gadgetSql, params);
		});
	} catch (error) {
		logger.error(`保存数据时出错: ${error}`);
	} finally {
		await db.close();
	}
}

// 查询某玩家战绩
async function queryPlayer(playerName: string): Promise<string> {
	try {
		const db = new SQLiteDB(dbPath, createPlayerDetailsTableSql);
		await db.open();
		const res = await db.query(`SELECT * FROM playerDetails WHERE name = ? ORDER BY timestamp DESC LIMIT 5`, [playerName]);
		// 计算胜率
		const sql = `SELECT COUNT(*) AS wins, COUNT(*) - COUNT(CASE WHEN loses > 0 THEN 1 END) AS loses FROM playerDetails WHERE name = ?`;
		const params = [playerName];
		const [winLoseRes] = await db.query(sql, params);
		const winRate = (winLoseRes.wins / (winLoseRes.wins + winLoseRes.loses)) * 100;

		// 总对局场数
		const totalGames = await db.query(`SELECT COUNT(*) AS total FROM playerDetails WHERE name = ?`, [playerName]);
		const totalGamesNum = totalGames[0].total;
		await db.close();

		if (res.length > 0) {
			let message = `玩家${playerName}最近5次战绩：\n\n总胜率: ${winRate.toFixed(1)}%\n总对局: ${totalGamesNum}场\n\n`;
			res.forEach((data: any) => {
				const winLose = getWinLoseMessage(data);
				const time = formatTimestamp(data.timestamp);
				message += `【状态: ${winLose}】 ${data.kills}杀\n${data.killAssists}助攻  ${data.deaths} 死  ${data.revives}救援  ${data.headshots}爆头\n总分: ${(data.totalScore / 10000).toFixed(
					1
				)}w  时长: ${(data.timePlayed / 60).toFixed(1)}分钟\n奖励分: ${data.awardScore}\n附加分: ${data.bonusScore}\n小队分: ${data.squadScore}\n===${time}===\n\n`;
			});
			return message;
		} else {
			return `暂无${playerName}的战绩记录`;
		}
	} catch (error) {
		logger.error(`查询玩家战绩时出错: ${error}`);
		return `查询玩家战绩时出错`;
	}
}

// 查询某玩家详细数据
async function queryPlayerDetail(playerName: string): Promise<string> {
	try {
		const db = new SQLiteDB(dbPath, createPlayerDetailsTableSql);
		await db.open();
		db.execute(createWeaponsTableSql);
		db.execute(createVehiclesTableSql);
		db.execute(createGadgetsTableSql);

		const res = await db.query(`SELECT * FROM playerDetails WHERE name = ? ORDER BY timestamp DESC LIMIT 5`, [playerName]);
		const weapons = await db.query(`SELECT * FROM weapons WHERE playerName = ? ORDER BY timestamp DESC LIMIT 100`, [playerName]);
		const vehicles = await db.query(`SELECT * FROM vehicles WHERE playerName = ? ORDER BY timestamp DESC LIMIT 100`, [playerName]);
		const gadgets = await db.query(`SELECT * FROM gadgets WHERE playerName = ? ORDER BY timestamp DESC LIMIT 100`, [playerName]);
		await db.close();
		// 格式化字符串数据
		if (res.length > 0) {
			let message = `玩家${playerName}最近5次详细战绩：\n\n`;
			for (let i = 0; i < res.length; i++) {
				const data = res[i];

				const weapon = weapons.filter((weapon: any) => weapon.timestamp == data.timestamp);
				const vehicle = vehicles.filter((vehicle: any) => vehicle.timestamp == data.timestamp);
				const gadget = gadgets.filter((gadget: any) => gadget.timestamp == data.timestamp);

				weapon.forEach((weapon: any) => {
					message += `${weapon.kills}杀 ${weapon.name} ${(weapon.timeEquipped / 60).toFixed(1)}分钟\n`;
				});
				message += "\n";
				vehicle.forEach((vehicle: any) => {
					message += `${vehicle.kills}杀 ${vehicle.name} ${(vehicle.timeEquipped / 60).toFixed(1)}分钟\n`;
				});
				message += "\n";
				gadget.forEach((gadget: any) => {
					message += `${gadget.kills}杀 ${gadget.name} ${(gadget.timeEquipped / 60).toFixed(1)}分钟\n`;
				});
				const time = formatTimestamp(data.timestamp);
				message += `===${time}===\n\n`;
			}
			return message;
		}
		return "暂无详细数据";
	} catch (error) {
		logger.error(`查询${playerName}详细数据时出错: ${error}`);
		return "查询详细数据时出错";
	}
}

// 查询某玩家最近一次战绩
async function queryPlayerLastDetail(playerName: string): Promise<PlayerDetail | null> {
	try {
		const db = new SQLiteDB(dbPath, createPlayerDetailsTableSql);
		await db.open();
		const res = await db.query(`SELECT * FROM playerDetails WHERE name = ? ORDER BY timestamp DESC LIMIT 1`, [playerName]);
		await db.close();

		if (res.length > 0) {
			const data = res[0];
			return data;
		} else {
			return null;
		}
	} catch (error) {
		logger.error(`查询${playerName}最近一次战绩时出错: ${error}`);
		return null;
	}
}

// 批量查询玩家的最近一次战绩（关联数据与主记录时间戳匹配）
async function batchQueryPlayerLastDetail(playerNames: string[]): Promise<PlayerDetail[] | null> {
	try {
		const db = new SQLiteDB(dbPath, createPlayerDetailsTableSql);
		await db.open();
		db.execute(createWeaponsTableSql);
		db.execute(createVehiclesTableSql);
		db.execute(createGadgetsTableSql);

		// 构建参数列表（主表和三个关联表各用一次playerNames）
		const params = [...playerNames, ...playerNames, ...playerNames, ...playerNames];

		// 关联查询，确保武器、载具、配备数据与玩家战绩时间戳匹配
		const query = `
      SELECT 
        -- 玩家基本战绩信息
        pd.id,
        pd.name,
        pd.personaId,
        pd.kills,
        pd.deaths,
        pd.wins,
        pd.loses,
        pd.timePlayed,
        pd.killAssists,
        pd.heals,
        pd.revives,
        pd.headshots,
        pd.awardScore,
        pd.bonusScore,
        pd.squadScore,
        pd.totalScore,
        pd.timestamp as detail_timestamp,
        
        -- 武器信息（包含时间戳）
        w.name as weapon_name,
        w.categories as weapon_categories,
        w.kills as weapon_kills,
        w.timeEquipped as weapon_timeEquipped,
        w.timestamp as weapon_timestamp,
        
        -- 载具信息（包含时间戳）
        v.name as vehicle_name,
        v.categories as vehicle_categories,
        v.kills as vehicle_kills,
        v.timeEquipped as vehicle_timeEquipped,
        v.timestamp as vehicle_timestamp,
        
        -- 配件信息（包含时间戳）
        g.name as gadget_name,
        g.categories as gadget_categories,
        g.kills as gadget_kills,
        g.timeEquipped as gadget_timeEquipped,
        g.timestamp as gadget_timestamp
        
      FROM (
        -- 玩家最新战绩主表
        SELECT *,
        ROW_NUMBER() OVER (PARTITION BY name ORDER BY timestamp DESC) as rn
        FROM playerDetails 
        WHERE name IN (${playerNames.map(() => "?").join(",")})
      ) pd
      
      -- 左连接同时间戳的武器数据
      LEFT JOIN (
        SELECT *
        FROM weapons
        WHERE playerName IN (${playerNames.map(() => "?").join(",")})
      ) w ON pd.name = w.playerName AND pd.timestamp = w.timestamp
      
      -- 左连接同时间戳的载具数据
      LEFT JOIN (
        SELECT *
        FROM vehicles
        WHERE playerName IN (${playerNames.map(() => "?").join(",")})
      ) v ON pd.name = v.playerName AND pd.timestamp = v.timestamp
      
      -- 左连接同时间戳的配件数据
      LEFT JOIN (
        SELECT *
        FROM gadgets
        WHERE playerName IN (${playerNames.map(() => "?").join(",")})
      ) g ON pd.name = g.playerName AND pd.timestamp = g.timestamp
      
      WHERE pd.rn = 1
    `;

		const rawResults = await db.query(query, params);
		await db.close();

		if (rawResults.length === 0) {
			return null;
		}

		// 按玩家名分组，合并同玩家的多条武器/载具/配件记录
		const groupedResults: Record<string, PlayerDetail> = {};

		for (const raw of rawResults) {
			const playerName = raw.name;

			// 如果是新玩家，初始化基本信息
			if (!groupedResults[playerName]) {
				groupedResults[playerName] = {
					name: raw.name,
					team: Team.unKnown,
					personaId: raw.personaId,
					kills: raw.kills,
					deaths: raw.deaths,
					wins: raw.wins,
					loses: raw.loses,
					timePlayed: raw.timePlayed,
					killAssists: raw.killAssists,
					heals: raw.heals,
					revives: raw.revives,
					headshots: raw.headshots,
					awardScore: raw.awardScore,
					bonusScore: raw.bonusScore,
					squadScore: raw.squadScore,
					totalScore: raw.totalScore,
					timestamp: raw.detail_timestamp,
					weapons: [],
					vehicles: [],
					gadgets: []
				};
			}

			// 添加武器数据（去重处理）
			if (raw.weapon_name && !groupedResults[playerName].weapons.some((w) => w.name === raw.weapon_name)) {
				groupedResults[playerName].weapons.push({
					name: raw.weapon_name,
					categories: raw.weapon_categories,
					kills: raw.weapon_kills,
					timeEquipped: raw.weapon_timeEquipped
				});
			}

			// 添加载具数据（去重处理）
			if (raw.vehicle_name && !groupedResults[playerName].vehicles.some((v) => v.name === raw.vehicle_name)) {
				groupedResults[playerName].vehicles.push({
					name: raw.vehicle_name,
					categories: raw.vehicle_categories,
					kills: raw.vehicle_kills,
					timeEquipped: raw.vehicle_timeEquipped
				});
			}

			// 添加配件数据（去重处理）
			if (raw.gadget_name && !groupedResults[playerName].gadgets.some((g) => g.name === raw.gadget_name)) {
				groupedResults[playerName].gadgets.push({
					name: raw.gadget_name,
					categories: raw.gadget_categories,
					kills: raw.gadget_kills,
					timeEquipped: raw.gadget_timeEquipped
				});
			}
		}

		// 转换为数组返回
		return Object.values(groupedResults);
	} catch (error) {
		logger.error(`批量查询玩家最近一次战绩时出错: ${error}`);
		return null;
	}
}

// 获取本局结局消息
function getWinLoseMessage(data: any) {
	if (data.wins > 0) {
		return "胜利！";
	} else if (data.loses > 0) {
		return "失败！";
	} else {
		return "中途退出";
	}
}

// 格式化时间戳
function formatTimestamp(timestamp: number) {
	const date = new Date(timestamp);
	return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
}

/** 绘制排行榜 */
async function drawRankList(group_id: number, isMerge: boolean = true): Promise<void> {
	const db = new SQLiteDB(dbPath, createPlayerDetailsTableSql);
	await db.open();
	await db.execute(createWeaponsTableSql);
	await db.execute(createVehiclesTableSql);
	await db.execute(createGadgetsTableSql);

	// 获取昨天的数据和今天的数据
	const yesterday = new Date();
	yesterday.setDate(yesterday.getDate() - 1);
	yesterday.setHours(0, 0, 0, 0);
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const yesterdayPlayerData = await db.query(`SELECT * FROM playerDetails WHERE timestamp >= ? AND timestamp < ?`, [yesterday.getTime(), today.getTime()]);

	const weaponData = await db.query(`SELECT * FROM weapons WHERE timestamp >= ?`, [yesterday.getTime()]);
	const vehicleData = await db.query(`SELECT * FROM vehicles WHERE timestamp >= ?`, [yesterday.getTime()]);
	// const gadgetData = await db.query(`SELECT * FROM gadgets WHERE timestamp >= ?`, [yesterday.getTime()]);

	const todayPlayerData = await db.query(`SELECT * FROM playerDetails WHERE timestamp >= ?`, [today.getTime()]);

	// #region 击杀榜，KD榜，KPM榜 数据准备
	// 昨日击杀前10（每个玩家只保留最高击杀记录）
	const yesterdayKills = yesterdayPlayerData
		? [
				...yesterdayPlayerData
					.reduce((acc, data) => {
						// 检查是否已有该玩家记录且当前击杀数更高
						if (!acc.has(data.name) || data.kills > acc.get(data.name).kills) {
							acc.set(data.name, { name: data.name, kills: data.kills });
						}
						return acc;
					}, new Map())
					.values()
		  ]
				.sort((a, b) => b.kills - a.kills)
				.slice(0, 10)
		: [];

	// 昨日KD前10（每个玩家只保留最高记录）
	const yesterdayKD = yesterdayPlayerData
		? [
				...yesterdayPlayerData
					.reduce((acc, player) => {
						const kd = player.deaths === 0 ? player.kills : parseFloat((player.kills / player.deaths).toFixed(1));

						const existing = acc.get(player.name);
						if (!existing || kd > existing.kd) {
							acc.set(player.name, { name: player.name, kd });
						}
						return acc;
					}, new Map())
					.values()
		  ]
				.sort((a, b) => b.kd - a.kd)
				.slice(0, 10)
		: [];

	// 昨日KPM前10（每个玩家只保留最高记录）
	const yesterdayKPM = yesterdayPlayerData
		? [
				...yesterdayPlayerData
					.reduce((acc, player) => {
						const kpm = player.timePlayed < 100 ? 0 : parseFloat((player.kills / (player.timePlayed / 60)).toFixed(1));

						const existing = acc.get(player.name);
						if (!existing || kpm > existing.kpm) {
							acc.set(player.name, { name: player.name, kpm });
						}
						return acc;
					}, new Map())
					.values()
		  ]
				.sort((a, b) => b.kpm - a.kpm)
				.slice(0, 10)
		: [];

	// 昨日最高助攻
	const yesterdayAssists = yesterdayPlayerData
		? yesterdayPlayerData
				.map((data: any) => {
					return {
						name: data.name,
						assists: data.killAssists
					};
				})
				.sort((a: any, b: any) => b.assists - a.assists)
				.slice(0, 1)[0]
		: null;

	// 昨日最高爆头
	const yesterdayHeadshots = yesterdayPlayerData
		? yesterdayPlayerData
				.map((data: any) => {
					return {
						name: data.name,
						headshots: data.headshots
					};
				})
				.sort((a: any, b: any) => b.headshots - a.headshots)
				.slice(0, 1)[0]
		: null;

	// 昨日最长时长
	const yesterdayLongestTime = yesterdayPlayerData
		? yesterdayPlayerData
				.map((data: any) => {
					return {
						name: data.name,
						time: data.timePlayed
					};
				})
				.sort((a: any, b: any) => b.time - a.time)
				.slice(0, 1)[0]
		: null;

	// 昨日最高救援
	const yesterdayMostRevives = yesterdayPlayerData
		? yesterdayPlayerData
				.map((data: any) => {
					return {
						name: data.name,
						revives: data.revives
					};
				})
				.sort((a: any, b: any) => b.revives - a.revives)
				.slice(0, 1)[0]
		: null;

	// 今日击杀前10（每个玩家只保留最高记录）
	const todayKills = todayPlayerData
		? [
				...todayPlayerData
					.reduce((acc, data) => {
						const existing = acc.get(data.name);
						if (!existing || data.kills > existing.kills) {
							acc.set(data.name, { name: data.name, kills: data.kills });
						}
						return acc;
					}, new Map())
					.values()
		  ]
				.sort((a, b) => b.kills - a.kills)
				.slice(0, 10)
		: [];

	// 今日KD前10（每个玩家只保留最高记录）
	const todayKD = todayPlayerData
		? [
				...todayPlayerData
					.reduce((acc, data) => {
						const kd = data.deaths === 0 ? data.kills : parseFloat((data.kills / data.deaths).toFixed(1));

						const existing = acc.get(data.name);
						if (!existing || kd > existing.kd) {
							acc.set(data.name, { name: data.name, kd });
						}
						return acc;
					}, new Map())
					.values()
		  ]
				.sort((a, b) => b.kd - a.kd)
				.slice(0, 10)
		: [];

	// 今日KPM前10（每个玩家只保留最高记录）
	const todayKPM = todayPlayerData
		? [
				...todayPlayerData
					.reduce((acc, data) => {
						const kpm = data.timePlayed < 100 ? 0 : parseFloat((data.kills / (data.timePlayed / 60)).toFixed(1));

						const existing = acc.get(data.name);
						if (!existing || kpm > existing.kpm) {
							acc.set(data.name, { name: data.name, kpm });
						}
						return acc;
					}, new Map())
					.values()
		  ]
				.sort((a, b) => b.kpm - a.kpm)
				.slice(0, 10)
		: [];

	// 今日最高助攻
	const todayMostAssists = todayPlayerData
		? todayPlayerData
				.map((data: any) => {
					return {
						name: data.name,
						assists: data.killAssists
					};
				})
				.sort((a: any, b: any) => b.assists - a.assists)
				.slice(0, 1)[0]
		: null;

	// 今日最高爆头
	const todayMostHeadshots = todayPlayerData
		? todayPlayerData
				.map((data: any) => {
					return {
						name: data.name,
						headshots: data.headshots
					};
				})
				.sort((a: any, b: any) => b.headshots - a.headshots)
				.slice(0, 1)[0]
		: null;

	// 今日最长时长
	const todayLongestTime = todayPlayerData
		? todayPlayerData
				.map((data: any) => {
					return {
						name: data.name,
						time: data.timePlayed
					};
				})
				.sort((a: any, b: any) => b.time - a.time)
				.slice(0, 1)[0]
		: null;

	// 今日最高救援
	const todayMostRevives = todayPlayerData
		? todayPlayerData
				.map((data: any) => {
					return {
						name: data.name,
						revives: data.revives
					};
				})
				.sort((a: any, b: any) => b.revives - a.revives)
				.slice(0, 1)[0]
		: null;

	// #endregion

	// #region 武器 载具 配备 数据准备
	// 每种武器的今天和昨天的最高击杀
	let weaponKills: { playerName: string; weaponName: string; kills: number }[] = [];
	weaponData.forEach((data: any) => {
		const kills = data.kills;
		const weaponName = data.name;

		const isInWeaponKills = weaponKills.find((item: any) => item.weaponName === weaponName);
		if (isInWeaponKills) {
			if (isInWeaponKills.kills < kills) {
				const index = weaponKills.findIndex((item: any) => item.weaponName === weaponName);
				weaponKills[index].kills = kills;
				weaponKills[index].playerName = data.playerName;
			}
		} else {
			weaponKills.push({
				playerName: data.playerName,
				weaponName: weaponName,
				kills: kills
			});
		}
	});
	// 取前10名武器击杀数据
	const weaponKillsTop10 = weaponKills.sort((a: any, b: any) => b.kills - a.kills).slice(0, 10);

	// 每种载具的今天和昨天的最高击杀
	let vehicleKills: { playerName: string; vehicleName: string; kills: number }[] = [];
	vehicleData.forEach((data: any) => {
		const kills = data.kills;
		const vehicleName = data.name;

		const isInVehicleKills = vehicleKills.find((item: any) => item.vehicleName === vehicleName);
		if (isInVehicleKills) {
			if (isInVehicleKills.kills < kills) {
				const index = vehicleKills.findIndex((item: any) => item.vehicleName === vehicleName);
				vehicleKills[index].kills = kills;
				vehicleKills[index].playerName = data.playerName;
			}
		} else {
			vehicleKills.push({
				playerName: data.playerName,
				vehicleName: vehicleName,
				kills: kills
			});
		}
	});
	// 取前10名载具击杀数据
	const vehicleKillsTop10 = vehicleKills.sort((a: any, b: any) => b.kills - a.kills).slice(0, 10);

	// 最强刀男
	const KnifeKills = weaponData.filter((data: any) => data.categories == "M");
	// 合并同playerName的刀具数据
	const KnifeKillsMap = KnifeKills.reduce((acc: any, cur: any) => {
		const { playerName, kills } = cur;
		if (acc[playerName]) {
			acc[playerName] += kills;
		} else {
			acc[playerName] = kills;
		}
		return acc;
	}, {});
	const KnifeKillsTop = Object.entries(KnifeKillsMap)
		.sort((a: any, b: any) => b[1] - a[1])
		.slice(0, 1)[0];

	// 最强制导
	const MissileKills = weaponData.filter((data: any) => data.categories == "SP" && data.name != "区域火炮");
	// 合并同playerName的导弹数据
	const MissileKillsMap = MissileKills.reduce((acc: any, cur: any) => {
		const { playerName, kills } = cur;
		if (acc[playerName]) {
			acc[playerName] += kills;
		} else {
			acc[playerName] = kills;
		}
		return acc;
	}, {});
	const MissileKillsTop = Object.entries(MissileKillsMap)
		.sort((a: any, b: any) => b[1] - a[1])
		.slice(0, 1)[0];

	// #endregion

	// 以下为基准时间戳（北京时间2025年8月1日）
	const baseTimestamp = new Date("2025-08-01T00:00:00+08:00").getTime();
	// 计算当前赛季(一个赛季两个月)的赛季编号 (北京时间)
	const currentTimestamp = new Date().getTime();
	const seasonNumber = Math.floor((currentTimestamp - baseTimestamp) / (1000 * 60 * 60 * 24 * 60)) + 1;

	const htmlKill = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${readConfigFile().group_name} S${seasonNumber}赛季排行榜 - 击杀 & 特殊统计</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css" rel="stylesheet">
  
  <!-- 配置Tailwind主题 -->
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: '#165DFF',
            secondary: '#36D399',
            accent: '#A855F7',
            danger: '#F87272',
            dark: '#1E293B',
            'dark-light': '#334155',
            'gray-custom': '#94A3B8',
            'yesterday-bg': '#2A3A54',
            'yesterday-accent': '#60A5FA', // 昨日主题色（浅蓝）
            'today-bg': '#2D3A56',
            'today-accent': '#F59E0B', // 今日主题色（金黄）
          },
          fontFamily: {
            inter: ['Inter', 'sans-serif'],
          },
        },
      }
    }
  </script>
  
  <!-- 自定义工具类 -->
  <style type="text/tailwindcss">
    @layer utilities {
      .content-auto {
        content-visibility: auto;
      }
      .stat-card {
        @apply bg-dark-light rounded-xl p-4 shadow-md border border-gray-700/20 transition-all duration-300 hover:shadow-lg;
      }
      .time-section {
        @apply rounded-2xl p-4 mb-5 border transition-all duration-300;
      }
      .time-section-yesterday {
        @apply border-yesterday-accent/30 bg-yesterday-bg hover:border-yesterday-accent/50;
      }
      .time-section-today {
        @apply border-today-accent/30 bg-today-bg hover:border-today-accent/50;
      }
      .table-row {
        @apply border-b border-gray-700/30;
      }
      .table-header {
        @apply text-left border-b pb-2 px-2 text-sm font-medium;
      }
      .table-header-yesterday {
        @apply text-yesterday-accent/80 border-yesterday-accent/20;
      }
      .table-header-today {
        @apply text-today-accent/80 border-today-accent/20;
      }
      .table-cell {
        @apply py-2 px-2 text-sm;
      }
      .trophy-1 {
        @apply text-yellow-500 font-bold;
      }
      .trophy-2 {
        @apply text-gray-300 font-bold;
      }
      .trophy-3 {
        @apply text-amber-700 font-bold;
      }
      .fixed-two-column {
        @apply grid grid-cols-2 gap-5;
      }
      .section-card {
        @apply bg-dark-light rounded-xl p-4 shadow-md border border-gray-700/20 transition-all duration-300 hover:shadow-xl;
      }
      .section-card-yesterday {
        @apply hover:border-yesterday-accent/50;
      }
      .section-card-today {
        @apply hover:border-today-accent/50;
      }
      .animate-value {
        @apply transition-all duration-700;
      }
      .badge {
        @apply inline-block px-2 py-0.5 rounded-full text-xs font-medium;
      }
      .rank-badge {
        @apply inline-flex items-center justify-center w-6 h-6 rounded-full mr-2 text-xs font-bold;
      }
      .rank-badge-1 {
        @apply bg-yellow-500 text-dark;
      }
      .rank-badge-2 {
        @apply bg-gray-400 text-dark;
      }
      .rank-badge-3 {
        @apply bg-amber-700 text-white;
      }
      .rank-badge-other {
        @apply bg-gray-700 text-gray-200;
      }
      .player-name {
        @apply flex items-center;
      }
    }
  </style>
</head>
<body class="bg-dark text-gray-100 font-inter min-h-screen">
  <div class="container mx-auto px-4 py-5 max-w-7xl">
    <!-- 头部 -->
    <header class="mb-5 text-center">
      <div class="inline-flex items-center justify-center p-3 rounded-2xl bg-dark-light/50 mb-3 border border-gray-700/30">
        <i class="fa fa-trophy text-yellow-500 mr-3 animate-pulse text-xl"></i>
        <h1 class="text-3xl font-bold text-white">${readConfigFile().group_name} S${seasonNumber}赛季排行榜</h1>
        <span class="mx-2 text-gray-500">|</span>
        <span class="text-lg font-medium bg-gradient-to-r from-yesterday-accent to-today-accent text-transparent bg-clip-text">击杀 & 特殊统计</span>
        <i class="fa fa-trophy text-yellow-500 ml-3 animate-pulse text-xl"></i>
      </div>
      <p class="text-gray-custom text-sm flex items-center justify-center">
        <i class="fa fa-refresh mr-1"></i>玩家数据统计 | 数据每5分钟更新
      </p>
    </header>
    
    <!-- 数据概览 -->
    <div class="time-section bg-dark-light border-gray-700/30 mb-6">
      <div class="flex items-center mb-4 border-b border-gray-700/30 pb-2">
        <i class="fa fa-bar-chart text-primary mr-2"></i>
        <h2 class="text-lg font-bold">数据概览</h2>
        <span class="ml-auto text-xs bg-gray-700/30 px-2 py-0.5 rounded-full flex items-center">
          <i class="fa fa-calendar-o mr-1"></i>${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}
        </span>
      </div>
      
      <div class="grid grid-cols-4 gap-4 mb-4">
        <!-- 昨日天才少年 -->
        <div class="stat-card border-l-4 border-yesterday-accent hover:border-yesterday-accent/80 transform transition-transform hover:scale-[1.02]">
          <div class="flex justify-between items-start">
			<div>
				
            <div class="text-yesterday-accent/80 text-xs mb-1 flex items-center">
                <i class="fa fa-moon-o mr-1"></i>昨日天才少年
              </div>
			  <div class="badge bg-yesterday-accent/20 text-yesterday-accent">
					<i class="fa fa-crosshairs mr-1"></i>最高击杀
				</div>
              <div class="text-white font-medium">
                <i class="fa fa-user-circle-o mr-1 text-yesterday-accent"></i>
                ${yesterdayKills.length > 0 ? yesterdayKills[0].name : "暂无数据"}
              </div>
            </div>
          </div>
          <div class="text-2xl font-bold text-white mt-1 flex items-center">
            <span>${yesterdayKills.length > 0 ? yesterdayKills[0].kills : "暂无数据"}</span>
            <span class="ml-1 text-yesterday-accent">杀</span>
          </div>
        </div>
        
        <!-- 昨日战场天使 -->
        <div class="stat-card border-l-4 border-yesterday-accent/70 hover:border-yesterday-accent/80 transform transition-transform hover:scale-[1.02]">
          <div class="flex justify-between items-start">
            <div>
              <div class="text-yesterday-accent/80 text-xs mb-1 flex items-center">
                <i class="fa fa-moon-o mr-1"></i>昨日战场天使
              </div>
			  <div class="badge bg-yesterday-accent/20 text-yesterday-accent">
              <i class="fa fa-heartbeat mr-1"></i>最高救援
            </div>
              <div class="text-white font-medium">
                <i class="fa fa-user-circle-o mr-1 text-yesterday-accent"></i>
                ${yesterdayMostRevives ? yesterdayMostRevives.name : "暂无数据"}
              </div>
            </div>
          </div>
          <div class="text-2xl font-bold text-white mt-1 flex items-center">
            <span>救</span>
            <span class="ml-1 text-yesterday-accent">${yesterdayMostRevives ? yesterdayMostRevives.revives : "暂无数据"}</span>
          </div>
        </div>
        
        <!-- 今日天才少年 -->
        <div class="stat-card border-l-4 border-today-accent hover:border-today-accent/80 transform transition-transform hover:scale-[1.02]">
          <div class="flex justify-between items-start">
            <div>
              <div class="text-today-accent/80 text-xs mb-1 flex items-center">
                <i class="fa fa-sun-o mr-1"></i>今日天才少年
              </div>
			  <div class="badge bg-today-accent/20 text-today-accent">
              <i class="fa fa-crosshairs mr-1"></i>最高击杀
            </div>
              <div class="text-white font-medium">
                <i class="fa fa-user-circle-o mr-1 text-today-accent"></i>
                ${todayKills.length > 0 ? todayKills[0].name : "暂无数据"}
              </div>
            </div>
          </div>
          <div class="text-2xl font-bold text-white mt-1 flex items-center">
            <span>${todayKills.length > 0 ? todayKills[0].kills : "暂无数据"}</span>
            <span class="ml-1 text-today-accent">杀</span>
          </div>
        </div>
        
        <!-- 今日战场天使 -->
        <div class="stat-card border-l-4 border-secondary transform transition-transform hover:scale-[1.02]">
          <div class="flex justify-between items-start">
            <div>
              <div class="text-secondary/80 text-xs mb-1 flex items-center">
                <i class="fa fa-sun-o mr-1"></i>今日战场天使
              </div>
			  <div class="badge bg-secondary/20 text-secondary">
              <i class="fa fa-heartbeat mr-1"></i>最高救援
            </div>
              <div class="text-white font-medium">
                <i class="fa fa-user-circle-o mr-1 text-secondary"></i>
                ${todayMostRevives ? todayMostRevives.name : "暂无数据"}
              </div>
            </div>
          </div>
          <div class="text-2xl font-bold text-white mt-1 flex items-center">
            <span>救援:</span>
            <span class="ml-1 text-secondary">${todayMostRevives ? todayMostRevives.revives : "暂无数据"}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 固定两列布局 - 左侧昨日 / 右侧今日 -->
    <div class="fixed-two-column">
      <!-- 左侧：昨日数据（蓝色系） -->
      <div>
        <div class="time-section time-section-yesterday relative overflow-hidden">
          <!-- 昨日标签 -->
          <div class="absolute -top-2 -right-8 bg-yesterday-accent/20 text-yesterday-accent px-10 py-1 transform rotate-45 text-xs font-medium">
            昨日
          </div>
          
          <div class="flex items-center mb-4 border-b border-yesterday-accent/20 pb-2">
            <i class="fa fa-moon-o text-yesterday-accent mr-2"></i>
            <h2 class="text-lg font-bold text-yesterday-accent">昨日数据</h2>
            <span class="ml-auto text-xs bg-yesterday-accent/10 text-yesterday-accent/80 px-2 py-0.5 rounded-full flex items-center">
              <i class="fa fa-clock-o mr-1"></i>统计周期: 20:00-24:00
            </span>
          </div>
          
          <!-- 昨日排行榜 -->
          <div class="space-y-4">
            <!-- 击杀排行榜 -->
            <div class="section-card section-card-yesterday">
              <h2 class="text-lg font-bold mb-3 flex items-center text-yesterday-accent">
                <i class="fa fa-crosshairs mr-2"></i>
                <span>击杀排行榜</span>
                <span class="ml-2 text-xs bg-yesterday-accent/10 text-yesterday-accent px-2 py-0.5 rounded-full">
                  <i class="fa fa-trophy mr-1"></i>TOP榜单
                </span>
              </h2>
              <div class="overflow-hidden">
                <table class="w-full">
                  <thead>
                    <tr>
                      <th class="table-header table-header-yesterday w-1/6">排名</th>
                      <th class="table-header table-header-yesterday w-4/6">玩家</th>
                      <th class="table-header table-header-yesterday w-1/6 text-right">击杀</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${yesterdayKills
						.map((data, index) => {
							const rankClass = index === 0 ? "rank-badge-1" : index === 1 ? "rank-badge-2" : index === 2 ? "rank-badge-3" : "rank-badge-other";
							return `
                          <tr class="table-row hover:bg-yesterday-accent/5 transition-colors">
                            <td class="table-cell">
                              <span class="${rankClass}">${index + 1}</span>
                            </td>
                            <td class="table-cell player-name">
                              <i class="fa fa-user-o mr-2 text-yesterday-accent/60"></i>
                              ${data.name}
                            </td>
                            <td class="table-cell text-right font-medium text-yesterday-accent">
                              ${data.kills}
                            </td>
                          </tr>
                        `;
						})
						.join("")}
                  </tbody>
                </table>
              </div>
            </div>
            
            <!-- 特殊统计 -->
            <div class="section-card section-card-yesterday">
              <h2 class="text-lg font-bold mb-3 flex items-center text-yesterday-accent">
                <i class="fa fa-star mr-2"></i>特殊统计
                <span class="ml-2 text-xs bg-yesterday-accent/10 text-yesterday-accent px-2 py-0.5 rounded-full">
                  <i class="fa fa-bar-chart mr-1"></i>详情
                </span>
              </h2>
              <div class="space-y-3">
                <div class="flex justify-between items-center p-3 border-b border-yesterday-accent/10 hover:bg-yesterday-accent/5 rounded-lg transition-colors">
                  <div class="flex items-center">
                    <i class="fa fa-handshake-o text-yesterday-accent mr-2"></i>
                    <span>补刀手</span>
                  </div>
                  <div class="font-medium text-yesterday-accent/90">
                    ${yesterdayAssists ? `${yesterdayAssists.name} <span class="text-white">(${yesterdayAssists.assists}助攻)</span>` : "暂无数据"}
                  </div>
                </div>
                
                <div class="flex justify-between items-center p-3 border-b border-yesterday-accent/10 hover:bg-yesterday-accent/5 rounded-lg transition-colors">
                  <div class="flex items-center">
                    <i class="fa fa-bullseye text-yesterday-accent mr-2"></i>
                    <span>正中红心</span>
                  </div>
                  <div class="font-medium text-yesterday-accent/90">
                    ${yesterdayHeadshots ? `${yesterdayHeadshots.name} <span class="text-white">(${yesterdayHeadshots.headshots}爆头)</span>` : "暂无数据"}
                  </div>
                </div>
                
                <div class="flex justify-between items-center p-3 hover:bg-yesterday-accent/5 rounded-lg transition-colors">
                  <div class="flex items-center">
                    <i class="fa fa-clock-o text-yesterday-accent mr-2"></i>
                    <span>完美员工</span>
                  </div>
                  <div class="font-medium text-yesterday-accent/90">
                    ${yesterdayLongestTime ? `${yesterdayLongestTime.name} <span class="text-white">(${(yesterdayLongestTime.time / 60).toFixed(1)}分钟)</span>` : "暂无数据"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 右侧：今日数据（金黄系） -->
      <div>
        <div class="time-section time-section-today relative overflow-hidden">
          <!-- 今日标签 -->
          <div class="absolute -top-2 -right-8 bg-today-accent/20 text-today-accent px-10 py-1 transform rotate-45 text-xs font-medium">
            今日
          </div>
          
          <div class="flex items-center mb-4 border-b border-today-accent/20 pb-2">
            <i class="fa fa-sun-o text-today-accent mr-2"></i>
            <h2 class="text-lg font-bold text-today-accent">今日数据</h2>
            <span class="ml-auto text-xs bg-today-accent/10 text-today-accent/80 px-2 py-0.5 rounded-full flex items-center">
              <i class="fa fa-clock-o mr-1"></i>统计周期: 20:00-24:00
            </span>
          </div>
          
          <!-- 今日排行榜 -->
          <div class="space-y-4">
            <!-- 击杀排行榜 -->
            <div class="section-card section-card-today">
              <h2 class="text-lg font-bold mb-3 flex items-center text-today-accent">
                <i class="fa fa-crosshairs mr-2"></i>
                <span>击杀排行榜</span>
                <span class="ml-2 text-xs bg-today-accent/10 text-today-accent px-2 py-0.5 rounded-full">
                  <i class="fa fa-trophy mr-1"></i>TOP榜单
                </span>
              </h2>
              <div class="overflow-hidden">
                <table class="w-full">
                  <thead>
                    <tr>
                      <th class="table-header table-header-today w-1/6">排名</th>
                      <th class="table-header table-header-today w-4/6">玩家</th>
                      <th class="table-header table-header-today w-1/6 text-right">击杀</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${todayKills
						.map((data, index) => {
							const rankClass = index === 0 ? "rank-badge-1" : index === 1 ? "rank-badge-2" : index === 2 ? "rank-badge-3" : "rank-badge-other";
							return `
                          <tr class="table-row hover:bg-today-accent/5 transition-colors">
                            <td class="table-cell">
                              <span class="${rankClass}">${index + 1}</span>
                            </td>
                            <td class="table-cell player-name">
                              <i class="fa fa-user-o mr-2 text-today-accent/60"></i>
                              ${data.name}
                            </td>
                            <td class="table-cell text-right font-medium text-today-accent">
                              ${data.kills}
                            </td>
                          </tr>
                        `;
						})
						.join("")}
                  </tbody>
                </table>
              </div>
            </div>
            
            <!-- 特殊统计 -->
            <div class="section-card section-card-today">
              <h2 class="text-lg font-bold mb-3 flex items-center text-today-accent">
                <i class="fa fa-star mr-2"></i>特殊统计
                <span class="ml-2 text-xs bg-today-accent/10 text-today-accent px-2 py-0.5 rounded-full">
                  <i class="fa fa-bar-chart mr-1"></i>详情
                </span>
              </h2>
              <div class="space-y-3">
                <div class="flex justify-between items-center p-3 border-b border-today-accent/10 hover:bg-today-accent/5 rounded-lg transition-colors">
                  <div class="flex items-center">
                    <i class="fa fa-handshake-o text-today-accent mr-2"></i>
                    <span>补刀手</span>
                  </div>
                  <div class="font-medium text-today-accent/90">
                    ${todayMostAssists ? `${todayMostAssists.name} <span class="text-white">(${todayMostAssists.assists}助攻)</span>` : "暂无数据"}
                  </div>
                </div>
                
                <div class="flex justify-between items-center p-3 border-b border-today-accent/10 hover:bg-today-accent/5 rounded-lg transition-colors">
                  <div class="flex items-center">
                    <i class="fa fa-bullseye text-today-accent mr-2"></i>
                    <span>正中红心</span>
                  </div>
                  <div class="font-medium text-today-accent/90">
                    ${todayMostHeadshots ? `${todayMostHeadshots.name} <span class="text-white">(${todayMostHeadshots.headshots}爆头)</span>` : "暂无数据"}
                  </div>
                </div>
                
                <div class="flex justify-between items-center p-3 hover:bg-today-accent/5 rounded-lg transition-colors">
                  <div class="flex items-center">
                    <i class="fa fa-clock-o text-today-accent mr-2"></i>
                    <span>完美员工</span>
                  </div>
                  <div class="font-medium text-today-accent/90">
                    ${todayLongestTime ? `${todayLongestTime.name} <span class="text-white">(${(todayLongestTime.time / 60).toFixed(1)}分钟)</span>` : "暂无数据"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 页脚 -->
    <footer class="mt-5 text-center text-gray-custom text-xs py-3 border-t border-gray-700/30">
      <div class="flex flex-col sm:flex-row justify-center items-center gap-2">
        <i class="fa fa-gamepad text-yesterday-accent"></i>
        <p>${readConfigFile().group_name} S${seasonNumber}赛季排行榜 - 击杀 & 特殊统计 &copy; ${new Date().getFullYear()}</p>
        <span class="hidden sm:inline">|</span>
        <p>数据统计周期: 每日00:00-24:00</p>
        <i class="fa fa-gamepad text-today-accent"></i>
      </div>
    </footer>
  </div>
</body>
</html>`;

	const htmlKDKPM = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${readConfigFile().group_name} S${seasonNumber}赛季排行榜 - KD & KPM</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css" rel="stylesheet">
  
  <!-- 配置Tailwind主题 -->
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: '#165DFF', // 恢复蓝色主色调
            secondary: '#36D399',
            accent: '#A855F7',
            danger: '#F87272',
            dark: '#1E293B',
            'dark-light': '#334155',
            'gray-custom': '#94A3B8',
            'yesterday-bg': '#2A3A54',
            'yesterday-accent': '#60A5FA', // 昨日主题色（浅蓝）
            'today-bg': '#2D3A56',
            'today-accent': '#F59E0B', // 今日主题色（金黄）
            'trophy-gold': '#F59E0B',
            'trophy-silver': '#9CA3AF',
            'trophy-bronze': '#D97706',
          },
          fontFamily: {
            inter: ['Inter', 'sans-serif'],
          },
        },
      }
    }
  </script>
  
  <!-- 自定义工具类 -->
  <style type="text/tailwindcss">
    @layer utilities {
      .content-auto {
        content-visibility: auto;
      }
      .stat-card {
        @apply bg-dark-light rounded-xl p-4 shadow-md border border-gray-700/20 transition-all duration-300 hover:shadow-lg;
      }
      .time-section {
        @apply rounded-2xl p-4 mb-5 border transition-all duration-300;
      }
      .time-section-yesterday {
        @apply border-yesterday-accent/30 bg-yesterday-bg hover:border-yesterday-accent/50;
      }
      .time-section-today {
        @apply border-today-accent/30 bg-today-bg hover:border-today-accent/50;
      }
      .table-row {
        @apply border-b border-gray-700/30;
      }
      .table-header {
        @apply text-left border-b pb-2 px-2 text-sm font-medium;
      }
      .table-header-yesterday {
        @apply text-yesterday-accent/80 border-yesterday-accent/20;
      }
      .table-header-today {
        @apply text-today-accent/80 border-today-accent/20;
      }
      .table-cell {
        @apply py-2 px-2 text-sm;
      }
      .trophy-1 {
        @apply text-yellow-500 font-bold;
      }
      .trophy-2 {
        @apply text-gray-300 font-bold;
      }
      .trophy-3 {
        @apply text-amber-700 font-bold;
      }
      .fixed-two-column {
        @apply grid grid-cols-2 gap-5;
      }
      .section-card {
        @apply bg-dark-light rounded-xl p-4 shadow-md border border-gray-700/20 transition-all duration-300 hover:shadow-xl;
      }
      .section-card-yesterday {
        @apply hover:border-yesterday-accent/50;
      }
      .section-card-today {
        @apply hover:border-today-accent/50;
      }
      .animate-value {
        @apply transition-all duration-700;
      }
      .badge {
        @apply inline-block px-2 py-0.5 rounded-full text-xs font-medium;
      }
      .rank-badge {
        @apply inline-flex items-center justify-center w-6 h-6 rounded-full mr-2 text-xs font-bold;
      }
      .rank-badge-1 {
        @apply bg-yellow-500 text-dark;
      }
      .rank-badge-2 {
        @apply bg-gray-400 text-dark;
      }
      .rank-badge-3 {
        @apply bg-amber-700 text-white;
      }
      .rank-badge-other {
        @apply bg-gray-700 text-gray-200;
      }
      .player-name {
        @apply flex items-center;
      }
      .kd-value {
        @apply inline-block px-2 py-1 rounded-md bg-yesterday-accent/10 text-yesterday-accent;
      }
      .kpm-value {
        @apply inline-block px-2 py-1 rounded-md bg-today-accent/10 text-today-accent;
      }
    }
  </style>
</head>
<body class="bg-dark text-gray-100 font-inter min-h-screen">
  <div class="container mx-auto px-4 py-5 max-w-7xl">
    <!-- 头部 -->
    <header class="mb-5 text-center">
      <div class="inline-flex items-center justify-center p-3 rounded-2xl bg-dark-light/50 mb-3 border border-gray-700/30">
        <i class="fa fa-trophy text-yellow-500 mr-3 animate-pulse text-xl"></i>
        <h1 class="text-3xl font-bold text-white">${readConfigFile().group_name} S${seasonNumber}赛季排行榜</h1>
        <span class="mx-2 text-gray-500">|</span>
        <span class="text-lg font-medium bg-gradient-to-r from-yesterday-accent to-today-accent text-transparent bg-clip-text">KD & KPM</span>
        <i class="fa fa-trophy text-yellow-500 ml-3 animate-pulse text-xl"></i>
      </div>
      <p class="text-gray-custom text-sm flex items-center justify-center">
        <i class="fa fa-refresh mr-1"></i>玩家数据统计 | 数据每5分钟更新
      </p>
    </header>
    
    <!-- 数据概览 -->
    <div class="time-section bg-dark-light border-gray-700/30 mb-6">
      <div class="flex items-center mb-4 border-b border-gray-700/30 pb-2">
        <i class="fa fa-bar-chart text-primary mr-2"></i>
        <h2 class="text-lg font-bold">数据概览</h2>
        <span class="ml-auto text-xs bg-gray-700/30 px-2 py-0.5 rounded-full flex items-center">
          <i class="fa fa-calendar-o mr-1"></i>${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}
        </span>
      </div>
      
      <div class="grid grid-cols-4 gap-4 mb-4">
        <!-- 交换今日和昨日数据的位置 -->
        <div class="stat-card border-l-4 border-yesterday-accent hover:border-yesterday-accent/80 transform transition-transform hover:scale-[1.02]">
          <div class="flex justify-between items-start mb-3">
            <div>
              <div class="text-yesterday-accent/80 text-xs mb-1 flex items-center">
                <i class="fa fa-moon-o mr-1"></i>昨日最高KD
              </div>
              <div class="text-white font-medium flex items-center">
                <i class="fa fa-user-circle-o mr-1 text-yesterday-accent"></i>
                <span class="text-base">${yesterdayKD.length > 0 ? yesterdayKD[0].name : "暂无数据"}</span>
              </div>
            </div>
            <div class="badge bg-yesterday-accent/20 text-yesterday-accent">
              <i class="fa fa-bolt mr-1"></i>KD
            </div>
          </div>
          <div class="text-2xl font-bold text-white mt-1 flex items-center">
            <span>${yesterdayKD.length > 0 ? yesterdayKD[0].kd : "暂无数据"}</span>
          </div>
        </div>
        
        <div class="stat-card border-l-4 border-yesterday-accent/70 hover:border-yesterday-accent/80 transform transition-transform hover:scale-[1.02]">
          <div class="flex justify-between items-start mb-3">
            <div>
              <div class="text-yesterday-accent/80 text-xs mb-1 flex items-center">
                <i class="fa fa-moon-o mr-1"></i>昨日最高KP
              </div>
              <div class="text-white font-medium flex items-center">
                <i class="fa fa-user-circle-o mr-1 text-yesterday-accent"></i>
                <span class="text-base">${yesterdayKPM.length > 0 ? yesterdayKPM[0].name : "暂无数据"}</span>
              </div>
            </div>
            <div class="badge bg-yesterday-accent/20 text-yesterday-accent">
              <i class="fa fa-bolt mr-1"></i>KP
            </div>
          </div>
          <div class="text-2xl font-bold text-white mt-1 flex items-center">
            <span>${yesterdayKPM.length > 0 ? yesterdayKPM[0].kpm : "暂无数据"}</span>
          </div>
        </div>
        
        <div class="stat-card border-l-4 border-today-accent hover:border-today-accent/80 transform transition-transform hover:scale-[1.02]">
          <div class="flex justify-between items-start mb-3">
            <div>
              <div class="text-today-accent/80 text-xs mb-1 flex items-center">
                <i class="fa fa-sun-o mr-1"></i>今日最高KD
              </div>
              <div class="text-white font-medium flex items-center">
                <i class="fa fa-user-circle-o mr-1 text-today-accent"></i>
                <span class="text-base">${todayKD.length > 0 ? todayKD[0].name : "暂无数据"}</span>
              </div>
            </div>
            <div class="badge bg-today-accent/20 text-today-accent">
              <i class="fa fa-bolt mr-1"></i>KD
            </div>
          </div>
          <div class="text-2xl font-bold text-white mt-1 flex items-center">
            <span>${todayKD.length > 0 ? todayKD[0].kd : "暂无数据"}</span>
          </div>
        </div>
        
        <div class="stat-card border-l-4 border-secondary transform transition-transform hover:scale-[1.02]">
          <div class="flex justify-between items-start mb-3">
            <div>
              <div class="text-secondary/80 text-xs mb-1 flex items-center">
                <i class="fa fa-sun-o mr-1"></i>今日最高KP
              </div>
              <div class="text-white font-medium flex items-center">
                <i class="fa fa-user-circle-o mr-1 text-secondary"></i>
                <span class="text-base">${todayKPM.length > 0 ? todayKPM[0].name : "暂无数据"}</span>
              </div>
            </div>
            <div class="badge bg-secondary/20 text-secondary">
              <i class="fa fa-bolt mr-1"></i>KP
            </div>
          </div>
          <div class="text-2xl font-bold text-white mt-1 flex items-center">
            <span>${todayKPM.length > 0 ? todayKPM[0].kpm : "暂无数据"}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 固定两列布局 - 左侧固定为昨日数据，右侧固定为今日数据 -->
    <div class="fixed-two-column">
      <!-- 左侧内容：昨日数据 -->
      <div>
        <div class="time-section time-section-yesterday relative overflow-hidden">
          <!-- 昨日标签 -->
          <div class="absolute -top-2 -right-8 bg-yesterday-accent/20 text-yesterday-accent px-10 py-1 transform rotate-45 text-xs font-medium">
            昨日
          </div>
          
          <div class="flex items-center mb-4 border-b border-yesterday-accent/20 pb-2">
            <i class="fa fa-moon-o text-yesterday-accent mr-2"></i>
            <h2 class="text-lg font-bold text-yesterday-accent">昨日数据</h2>
            <span class="ml-auto text-xs bg-yesterday-accent/10 text-yesterday-accent/80 px-2 py-0.5 rounded-full flex items-center">
              <i class="fa fa-clock-o mr-1"></i>统计周期: 20:00-24:00
            </span>
          </div>
          
          <!-- 昨日排行榜 -->
          <div class="space-y-4">
            <!-- KD排行榜 -->
            <div class="section-card section-card-yesterday">
              <h2 class="text-lg font-bold mb-3 flex items-center text-yesterday-accent">
                <i class="fa fa-balance-scale text-yesterday-accent mr-2"></i>
                <span>KD排行榜</span>
                <span class="ml-2 text-xs bg-yesterday-accent/10 text-yesterday-accent px-2 py-0.5 rounded-full">击杀/死亡</span>
              </h2>
              <div class="overflow-hidden">
                <table class="w-full">
                  <thead>
                    <tr>
                      <th class="table-header table-header-yesterday w-1/6">排名</th>
                      <th class="table-header table-header-yesterday w-4/6">玩家</th>
                      <th class="table-header table-header-yesterday w-1/6 text-right">KD</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${yesterdayKD
						.map((data, index) => {
							const rankClass = index === 0 ? "rank-badge-1" : index === 1 ? "rank-badge-2" : index === 2 ? "rank-badge-3" : "rank-badge-other";
							return `
                          <tr class="table-row hover:bg-yesterday-accent/5 transition-colors">
                            <td class="table-cell">
                              <span class="${rankClass}">${index + 1}</span>
                            </td>
                            <td class="table-cell player-name">
                              <i class="fa fa-user-o mr-2 text-yesterday-accent/60"></i>
                              ${data.name}
                            </td>
                            <td class="table-cell text-right">
                              <span class="kd-value">${data.kd}</span>
                            </td>
                          </tr>
                        `;
						})
						.join("")}
                  </tbody>
                </table>
              </div>
            </div>
            
            <!-- KPM排行榜 -->
            <div class="section-card section-card-yesterday">
              <h2 class="text-lg font-bold mb-3 flex items-center text-yesterday-accent">
                <i class="fa fa-bolt text-yesterday-accent mr-2"></i>
                <span>KPM排行榜</span>
                <span class="ml-2 text-xs bg-yesterday-accent/10 text-yesterday-accent px-2 py-0.5 rounded-full">击杀/分钟</span>
              </h2>
              <div class="overflow-hidden">
                <table class="w-full">
                  <thead>
                    <tr>
                      <th class="table-header table-header-yesterday w-1/6">排名</th>
                      <th class="table-header table-header-yesterday w-4/6">玩家</th>
                      <th class="table-header table-header-yesterday w-1/6 text-right">KPM</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${yesterdayKPM
						.map((data, index) => {
							const rankClass = index === 0 ? "rank-badge-1" : index === 1 ? "rank-badge-2" : index === 2 ? "rank-badge-3" : "rank-badge-other";
							return `
                          <tr class="table-row hover:bg-yesterday-accent/5 transition-colors">
                            <td class="table-cell">
                              <span class="${rankClass}">${index + 1}</span>
                            </td>
                            <td class="table-cell player-name">
                              <i class="fa fa-user-o mr-2 text-yesterday-accent/60"></i>
                              ${data.name}
                            </td>
                            <td class="table-cell text-right">
                              <span class="kpm-value">${data.kpm}</span>
                            </td>
                          </tr>
                        `;
						})
						.join("")}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 右侧内容：今日数据 -->
      <div>
        <div class="time-section time-section-today relative overflow-hidden">
          <!-- 今日标签 -->
          <div class="absolute -top-2 -right-8 bg-today-accent/20 text-today-accent px-10 py-1 transform rotate-45 text-xs font-medium">
            今日
          </div>
          
          <div class="flex items-center mb-4 border-b border-today-accent/20 pb-2">
            <i class="fa fa-sun-o text-today-accent mr-2"></i>
            <h2 class="text-lg font-bold text-today-accent">今日数据</h2>
            <span class="ml-auto text-xs bg-today-accent/10 text-today-accent/80 px-2 py-0.5 rounded-full flex items-center">
              <i class="fa fa-clock-o mr-1"></i>统计周期: 20:00-24:00
            </span>
          </div>
          
          <!-- 今日排行榜 -->
          <div class="space-y-4">
            <!-- KD排行榜 -->
            <div class="section-card section-card-today">
              <h2 class="text-lg font-bold mb-3 flex items-center text-today-accent">
                <i class="fa fa-balance-scale text-today-accent mr-2"></i>
                <span>KD排行榜</span>
                <span class="ml-2 text-xs bg-today-accent/10 text-today-accent px-2 py-0.5 rounded-full">击杀/死亡</span>
              </h2>
              <div class="overflow-hidden">
                <table class="w-full">
                  <thead>
                    <tr>
                      <th class="table-header table-header-today w-1/6">排名</th>
                      <th class="table-header table-header-today w-4/6">玩家</th>
                      <th class="table-header table-header-today w-1/6 text-right">KD</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${todayKD
						.map((data, index) => {
							const rankClass = index === 0 ? "rank-badge-1" : index === 1 ? "rank-badge-2" : index === 2 ? "rank-badge-3" : "rank-badge-other";
							return `
                          <tr class="table-row hover:bg-today-accent/5 transition-colors">
                            <td class="table-cell">
                              <span class="${rankClass}">${index + 1}</span>
                            </td>
                            <td class="table-cell player-name">
                              <i class="fa fa-user-o mr-2 text-today-accent/60"></i>
                              ${data.name}
                            </td>
                            <td class="table-cell text-right">
                              <span class="kd-value">${data.kd}</span>
                            </td>
                          </tr>
                        `;
						})
						.join("")}
                  </tbody>
                </table>
              </div>
            </div>
            
            <!-- KPM排行榜 -->
            <div class="section-card section-card-today">
              <h2 class="text-lg font-bold mb-3 flex items-center text-today-accent">
                <i class="fa fa-bolt text-today-accent mr-2"></i>
                <span>KPM排行榜</span>
                <span class="ml-2 text-xs bg-today-accent/10 text-today-accent px-2 py-0.5 rounded-full">击杀/分钟</span>
              </h2>
              <div class="overflow-hidden">
                <table class="w-full">
                  <thead>
                    <tr>
                      <th class="table-header table-header-today w-1/6">排名</th>
                      <th class="table-header table-header-today w-4/6">玩家</th>
                      <th class="table-header table-header-today w-1/6 text-right">KPM</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${todayKPM
						.map((data, index) => {
							const rankClass = index === 0 ? "rank-badge-1" : index === 1 ? "rank-badge-2" : index === 2 ? "rank-badge-3" : "rank-badge-other";
							return `
                          <tr class="table-row hover:bg-today-accent/5 transition-colors">
                            <td class="table-cell">
                              <span class="${rankClass}">${index + 1}</span>
                            </td>
                            <td class="table-cell player-name">
                              <i class="fa fa-user-o mr-2 text-today-accent/60"></i>
                              ${data.name}
                            </td>
                            <td class="table-cell text-right">
                              <span class="kpm-value">${data.kpm}</span>
                            </td>
                          </tr>
                        `;
						})
						.join("")}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 页脚 -->
    <footer class="mt-5 text-center text-gray-custom text-xs py-3 border-t border-gray-700/30">
      <div class="flex flex-col sm:flex-row justify-center items-center gap-2">
        <i class="fa fa-gamepad text-yesterday-accent"></i>
        <p>${readConfigFile().group_name} S${seasonNumber}赛季排行榜 - KD & KPM &copy; ${new Date().getFullYear()}</p>
        <span class="hidden sm:inline">|</span>
        <p>数据统计周期: 每日00:00-24:00</p>
        <i class="fa fa-gamepad text-today-accent"></i>
      </div>
    </footer>
  </div>
</body>
</html>`;

	const htmlWeaponVehicle = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${readConfigFile().group_name} S${seasonNumber}赛季武器载具配备数据</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css" rel="stylesheet">
  
  <!-- 配置Tailwind主题 -->
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: '#165DFF', // 主色调（蓝色）
            secondary: '#36D399', // 辅助色（绿色）
            accent: '#A855F7', // 强调色（紫色）
            danger: '#F87272', // 危险色（红色）
            dark: '#1E293B', // 背景深色
            'dark-light': '#334155', // 卡片背景色
            'gray-custom': '#94A3B8', // 次要文本色
            'weapon-bg': '#2A3A54', // 武器数据背景色
            'weapon-accent': '#60A5FA', // 武器数据强调色（蓝色）
            'vehicle-bg': '#2D3A56', // 载具数据背景色
            'vehicle-accent': '#F59E0B', // 载具数据强调色（金黄）
            'trophy-gold': '#F59E0B', // 金色
            'trophy-silver': '#9CA3AF', // 银色
            'trophy-bronze': '#D97706', // 铜色
          },
          fontFamily: {
            inter: ['Inter', 'sans-serif'],
          },
        },
      }
    }
  </script>
  
  <!-- 自定义工具类 -->
  <style type="text/tailwindcss">
    @layer utilities {
      .content-auto {
        content-visibility: auto;
      }
      .stat-card {
        @apply bg-dark-light rounded-xl p-4 shadow-md border border-gray-700/20 transition-all duration-300 hover:shadow-lg;
      }
      .data-section {
        @apply rounded-2xl p-4 mb-5 border transition-all duration-300;
      }
      .weapon-section {
        @apply border-weapon-accent/30 bg-weapon-bg hover:border-weapon-accent/50;
      }
      .vehicle-section {
        @apply border-vehicle-accent/30 bg-vehicle-bg hover:border-vehicle-accent/50;
      }
      .special-section {
        @apply border-accent/30 bg-dark-light hover:border-accent/50;
      }
      .table-row {
        @apply border-b border-gray-700/30;
      }
      .table-header {
        @apply text-left border-b pb-2 px-2 text-sm font-medium;
      }
      .table-header-weapon {
        @apply text-weapon-accent/80 border-weapon-accent/20;
      }
      .table-header-vehicle {
        @apply text-vehicle-accent/80 border-vehicle-accent/20;
      }
      .table-cell {
        @apply py-2 px-2 text-sm;
      }
      .rank-badge {
        @apply inline-flex items-center justify-center w-6 h-6 rounded-full mr-2 text-xs font-bold;
      }
      .rank-badge-1 {
        @apply bg-yellow-500 text-dark;
      }
      .rank-badge-2 {
        @apply bg-gray-400 text-dark;
      }
      .rank-badge-3 {
        @apply bg-amber-700 text-white;
      }
      .rank-badge-other {
        @apply bg-gray-700 text-gray-200;
      }
      .badge {
        @apply inline-block px-2 py-0.5 rounded-full text-xs font-medium;
      }
      .weapon-value {
        @apply inline-block px-2 py-1 rounded-md bg-weapon-accent/10 text-weapon-accent;
      }
      .vehicle-value {
        @apply inline-block px-2 py-1 rounded-md bg-vehicle-accent/10 text-vehicle-accent;
      }
      .special-value {
        @apply inline-block px-2 py-1 rounded-md bg-accent/10 text-accent;
      }
      .animate-value {
        @apply transition-all duration-700;
      }
    }
  </style>
</head>
<body class="bg-dark text-gray-100 font-inter min-h-screen">
  <div class="container mx-auto px-4 py-5 max-w-7xl">
    <!-- 头部 -->
    <header class="mb-5 text-center">
      <div class="inline-flex items-center justify-center p-3 rounded-2xl bg-dark-light/50 mb-3 border border-gray-700/30">
        <i class="fa fa-bomb text-weapon-accent mr-3 animate-pulse text-xl"></i>
        <h1 class="text-3xl font-bold text-white">${readConfigFile().group_name} S${seasonNumber}赛季武器载具数据</h1>
        <i class="fa fa-truck text-vehicle-accent ml-3 animate-pulse text-xl"></i>
      </div>
      <p class="text-gray-custom text-sm flex items-center justify-center">
        <i class="fa fa-refresh mr-1"></i>玩家数据统计 | 数据每5分钟更新
      </p>
    </header>
    
    <!-- 数据概览 -->
    <div class="data-section bg-dark-light border-gray-700/30 mb-6">
      <div class="flex items-center mb-4 border-b border-gray-700/30 pb-2">
        <i class="fa fa-bar-chart text-primary mr-2"></i>
        <h2 class="text-lg font-bold">数据概览</h2>
        <span class="ml-auto text-xs bg-gray-700/30 px-2 py-0.5 rounded-full flex items-center">
          <i class="fa fa-calendar-o mr-1"></i>${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${String(new Date().getDate()).padStart(2, "0")}
        </span>
      </div>
      
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div class="stat-card border-l-4 border-weapon-accent hover:border-weapon-accent/80 transform transition-transform hover:scale-[1.02]">
          <div class="flex justify-between items-start mb-3">
            <div>
              <div class="text-weapon-accent/80 text-xs mb-1 flex items-center">
                <i class="fa fa-crosshairs mr-1"></i>总击杀
              </div>
            </div>
            <div class="badge bg-weapon-accent/20 text-weapon-accent">
              <i class="fa fa-bolt mr-1"></i>武器
            </div>
          </div>
          <div class="text-2xl font-bold text-white mt-1 flex items-center">
            <span class="text-base">${weaponData.reduce((acc, item) => acc + item.kills, 0)}</span>
          </div>
        </div>
        
        <div class="stat-card border-l-4 border-vehicle-accent hover:border-vehicle-accent/80 transform transition-transform hover:scale-[1.02]">
          <div class="flex justify-between items-start mb-3">
            <div>
              <div class="text-vehicle-accent/80 text-xs mb-1 flex items-center">
                <i class="fa fa-truck mr-1"></i>总击杀
              </div>
            </div>
            <div class="badge bg-vehicle-accent/20 text-vehicle-accent">
              <i class="fa fa-bolt mr-1"></i>载具
            </div>
          </div>
          <div class="text-2xl font-bold text-white mt-1 flex items-center">
            <span class="text-base">${vehicleData.reduce((acc, item) => acc + item.kills, 0)}</span>
          </div>
        </div>
        
        <div class="stat-card border-l-4 border-trophy-gold hover:border-trophy-gold/80 transform transition-transform hover:scale-[1.02]">
          <div class="flex justify-between items-start mb-3">
            <div>
              <div class="text-trophy-gold/80 text-xs mb-1 flex items-center">
                <i class="fa fa-star mr-1"></i>最强刀男
              </div>
              <div class="text-white font-medium flex items-center">
                <i class="fa fa-user-o mr-1 text-trophy-gold"></i>
                <span class="text-base">${KnifeKillsTop ? KnifeKillsTop[0] : "暂无数据"}</span>
              </div>
            </div>
            <div class="badge bg-yellow-500/20 text-yellow-500">
              <i class="fa fa-knife mr-1"></i>刀杀
            </div>
          </div>
          <div class="text-2xl font-bold text-white mt-1 flex items-center">
            <span>${KnifeKillsTop ? KnifeKillsTop[1] : "0"}</span>
          </div>
        </div>
        
        <div class="stat-card border-l-4 border-accent hover:border-accent/80 transform transition-transform hover:scale-[1.02]">
          <div class="flex justify-between items-start mb-3">
            <div>
              <div class="text-accent/80 text-xs mb-1 flex items-center">
                <i class="fa fa-rocket mr-1"></i>最强制导
              </div>
              <div class="text-white font-medium flex items-center">
                <i class="fa fa-user-o mr-1 text-accent"></i>
                <span class="text-base">${MissileKillsTop ? MissileKillsTop[0] : "暂无数据"}</span>
              </div>
            </div>
            <div class="badge bg-accent/20 text-accent">
              <i class="fa fa-rocket mr-1"></i>导弹
            </div>
          </div>
          <div class="text-2xl font-bold text-white mt-1 flex items-center">
            <span>${MissileKillsTop ? MissileKillsTop[1] : "0"}</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 武器和载具数据展示 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <!-- 武器数据 -->
      <div>
        <div class="data-section weapon-section relative overflow-hidden">
          <!-- 武器标签 -->
          <div class="absolute -top-2 -right-8 bg-weapon-accent/20 text-weapon-accent px-10 py-1 transform rotate-45 text-xs font-medium">
            武器数据
          </div>
          
          <div class="flex items-center mb-4 border-b border-weapon-accent/20 pb-2">
            <i class="fa fa-gun text-weapon-accent mr-2"></i>
            <h2 class="text-lg font-bold text-weapon-accent">武器击杀排行榜</h2>
            <span class="ml-auto text-xs bg-weapon-accent/10 text-weapon-accent/80 px-2 py-0.5 rounded-full flex items-center">
              <i class="fa fa-clock-o mr-1"></i>今日数据
            </span>
          </div>
          
          <div class="section-card">
            <h2 class="text-lg font-bold mb-3 flex items-center text-weapon-accent">
              <i class="fa fa-list-ol text-weapon-accent mr-2"></i>
              <span>武器击杀TOP10</span>
            </h2>
            <div class="overflow-hidden">
              <table class="w-full">
                <thead>
                  <tr>
                    <th class="table-header table-header-weapon w-1/6">排名</th>
                    <th class="table-header table-header-weapon w-3/6">武器</th>
                    <th class="table-header table-header-weapon w-2/6">玩家</th>
                    <th class="table-header table-header-weapon w-1/6 text-right">击杀</th>
                  </tr>
                </thead>
                <tbody>
                  ${weaponKillsTop10
						.map((data, index) => {
							const rankClass = index === 0 ? "rank-badge-1" : index === 1 ? "rank-badge-2" : index === 2 ? "rank-badge-3" : "rank-badge-other";
							return `
                        <tr class="table-row hover:bg-weapon-accent/5 transition-colors">
                          <td class="table-cell">
                            <span class="${rankClass}">${index + 1}</span>
                          </td>
                          <td class="table-cell">
                            <i class="fa fa-crosshairs mr-2 text-weapon-accent/60"></i>
                            ${data.weaponName}
                          </td>
                          <td class="table-cell">
                            <i class="fa fa-user-o mr-2 text-weapon-accent/60"></i>
                            ${data.playerName}
                          </td>
                          <td class="table-cell text-right">
                            <span class="weapon-value">${data.kills}</span>
                          </td>
                        </tr>
                      `;
						})
						.join("")}
                </tbody>
              </table>
            </div>
          </div>
          
          <!-- 最强刀男 -->
          <div class="section-card">
            <h2 class="text-lg font-bold mb-3 flex items-center text-trophy-gold">
              <i class="fa fa-star text-trophy-gold mr-2"></i>
              <span>最强刀男</span>
            </h2>
            <div class="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <div class="w-12 h-12 rounded-full bg-yellow-500/20 flex items-center justify-center mr-3">
                    <i class="fa fa-knife text-trophy-gold text-2xl"></i>
                  </div>
                  <div>
                    <div class="text-sm text-gray-custom">玩家</div>
                    <div class="text-lg font-bold">${KnifeKillsTop ? KnifeKillsTop[0] : "暂无数据"}</div>
                  </div>
                </div>
                <div class="text-center">
                  <div class="text-sm text-gray-custom">总刀杀</div>
                  <div class="text-3xl font-bold text-trophy-gold">${KnifeKillsTop ? KnifeKillsTop[1] : "0"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 载具数据 -->
      <div>
        <div class="data-section vehicle-section relative overflow-hidden">
          <!-- 载具标签 -->
          <div class="absolute -top-2 -right-8 bg-vehicle-accent/20 text-vehicle-accent px-10 py-1 transform rotate-45 text-xs font-medium">
            载具数据
          </div>
          
          <div class="flex items-center mb-4 border-b border-vehicle-accent/20 pb-2">
            <i class="fa fa-truck text-vehicle-accent mr-2"></i>
            <h2 class="text-lg font-bold text-vehicle-accent">载具击杀排行榜</h2>
            <span class="ml-auto text-xs bg-vehicle-accent/10 text-vehicle-accent/80 px-2 py-0.5 rounded-full flex items-center">
              <i class="fa fa-clock-o mr-1"></i>今日数据
            </span>
          </div>
          
          <div class="section-card">
            <h2 class="text-lg font-bold mb-3 flex items-center text-vehicle-accent">
              <i class="fa fa-list-ol text-vehicle-accent mr-2"></i>
              <span>载具击杀TOP10</span>
            </h2>
            <div class="overflow-hidden">
              <table class="w-full">
                <thead>
                  <tr>
                    <th class="table-header table-header-vehicle w-1/6">排名</th>
                    <th class="table-header table-header-vehicle w-3/6">载具</th>
                    <th class="table-header table-header-vehicle w-2/6">玩家</th>
                    <th class="table-header table-header-vehicle w-1/6 text-right">击杀</th>
                  </tr>
                </thead>
                <tbody>
                  ${vehicleKillsTop10
						.map((data, index) => {
							const rankClass = index === 0 ? "rank-badge-1" : index === 1 ? "rank-badge-2" : index === 2 ? "rank-badge-3" : "rank-badge-other";
							return `
                        <tr class="table-row hover:bg-vehicle-accent/5 transition-colors">
                          <td class="table-cell">
                            <span class="${rankClass}">${index + 1}</span>
                          </td>
                          <td class="table-cell">
                            <i class="fa fa-truck mr-2 text-vehicle-accent/60"></i>
                            ${data.vehicleName}
                          </td>
                          <td class="table-cell">
                            <i class="fa fa-user-o mr-2 text-vehicle-accent/60"></i>
                            ${data.playerName}
                          </td>
                          <td class="table-cell text-right">
                            <span class="vehicle-value">${data.kills}</span>
                          </td>
                        </tr>
                      `;
						})
						.join("")}
                </tbody>
              </table>
            </div>
          </div>
          
          <!-- 最强制导 -->
          <div class="section-card">
            <h2 class="text-lg font-bold mb-3 flex items-center text-accent">
              <i class="fa fa-rocket text-accent mr-2"></i>
              <span>最强制导</span>
            </h2>
            <div class="p-4 bg-accent/5 border border-accent/20 rounded-lg">
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <div class="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center mr-3">
                    <i class="fa fa-rocket text-accent text-2xl"></i>
                  </div>
                  <div>
                    <div class="text-sm text-gray-custom">玩家</div>
                    <div class="text-lg font-bold">${MissileKillsTop ? MissileKillsTop[0] : "暂无数据"}</div>
                  </div>
                </div>
                <div class="text-center">
                  <div class="text-sm text-gray-custom">总导弹击杀</div>
                  <div class="text-3xl font-bold text-accent">${MissileKillsTop ? MissileKillsTop[1] : "0"}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 页脚 -->
    <footer class="mt-5 text-center text-gray-custom text-xs py-3 border-t border-gray-700/30">
      <div class="flex flex-col sm:flex-row justify-center items-center gap-2">
        <i class="fa fa-gamepad text-weapon-accent"></i>
        <p>${readConfigFile().group_name} S${seasonNumber}赛季武器载具数据 &copy; ${new Date().getFullYear()}</p>
        <span class="hidden sm:inline">|</span>
        <p>数据统计周期: 每日20:00-24:00</p>
        <i class="fa fa-gamepad text-vehicle-accent"></i>
      </div>
    </footer>
  </div>
</body>
</html>`;

	const base64ImgKill = await htmlToBase64Image(htmlKill);
	sendBase64ImgToQQGroup(group_id, base64ImgKill, null);
	const base64ImgKDKPM = await htmlToBase64Image(htmlKDKPM);
	sendBase64ImgToQQGroup(group_id, base64ImgKDKPM, null);
	const base64ImgWeaponVehicle = await htmlToBase64Image(htmlWeaponVehicle);
	sendBase64ImgToQQGroup(group_id, base64ImgWeaponVehicle, null);
}

// 初始化
function init() {
	handleWebSocket();
	setInterval(main, 1000);
}

init();

// 接收所有未处理的错误消息防止程序崩溃
process.on("uncaughtException", (err) => {
	const date = new Date();
	logger.error(`未处理的错误: ${err.message}\n${err.stack}\n${date.toLocaleString()}`);
});

const app = express();
// 开放post接口,端口默认为7639
app.listen(7639, () => {
	logger.info("服务器已启动, 监听端口: 7639");
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 查询玩家的最近一次战绩数据
app.post("/player/lastest", async (req, res) => {
	const { playerName, token } = req.body;
	if (token != status_token) {
		res.status(401).json({ message: "无效的token" });
		return;
	}
	if (!playerName) {
		res.status(400).json({ message: "缺少玩家名称" });
		return;
	}
	const playerData = await queryPlayerLastDetail(playerName);
	if (playerData) {
		res.json(playerData);
	} else {
		// 返回null
		res.json(null);
	}
});

// 批量查询玩家的最近一次战绩数据
app.post("/batch/player/lastest", async (req, res) => {
	const { playerNames, token } = req.body;
	if (token != status_token) {
		res.status(401).json({ message: "无效的token" });
		return;
	}
	if (!playerNames || !Array.isArray(playerNames)) {
		res.status(400).json({ message: "缺少玩家名称列表" });
		return;
	}
	const playerData = await batchQueryPlayerLastDetail(playerNames);
	if (playerData) {
		res.json(playerData);
	} else {
		// 返回null
		res.json(null);
	}
});
