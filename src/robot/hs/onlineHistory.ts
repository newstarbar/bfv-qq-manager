import path from "path";
import logger from "../../utils/logger";
import { SQLiteDB } from "../../utils/sqlite";
import { GroupPlayer, Player } from "../../interface/ServerInfo";
import { filterGroupMember } from "../../qq/memberManager";
import { getNowDATE, getNowDATETIME } from "../../utils/timeTool";
import { setGroupMemberCard } from "../../qq/groupService";

const url = path.join(process.cwd(), "data", "onlineHistory.db");
const createOnlineTableSql = `CREATE TABLE IF NOT EXISTS onlinePlayers (
    user_id INTEGER PRIMARY KEY,
    group_id INTEGER NOT NULL,
    player_name TEXT,
    server_name TEXT,
    team INTEGER,
    admin_level INTEGER,
    is_warmed BOOLEAN,
    time_stamp INTEGER
)`;
const createHistoryTableSql = `CREATE TABLE IF NOT EXISTS onlineHistory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_name TEXT,
    server_name TEXT,
    is_warmed BOOLEAN,
    time DATETIME
)`;

/** 下线所有在线玩家 */
export async function offlineAllOnlineMember(): Promise<void> {
	const db = new SQLiteDB(url, createOnlineTableSql);
	await db.open();
	const sql = `SELECT * FROM onlinePlayers`;
	const result = await db.query(sql);
	if (result.length === 0) {
		return;
	}
	// 都删除
	const delSql = `DELETE FROM onlinePlayers`;
	await db.execute(delSql);
	await db.close();
	for (const item of result) {
		const { user_id, group_id, player_name } = item;
		// 设置取消游戏中
		setGroupMemberCard(group_id, user_id, player_name);
	}
}

/** 下线指定服务器所有在线玩家 */
export async function offlineServerOnlineMember(serverName: string): Promise<void> {
	const db = new SQLiteDB(url, createOnlineTableSql);
	await db.open();
	const sql = `SELECT * FROM onlinePlayers WHERE server_name = ?`;
	const params = [serverName];
	const result = await db.query(sql, params);
	if (result.length === 0) {
		return;
	}
	// 都删除
	const delSql = `DELETE FROM onlinePlayers WHERE server_name = ?`;
	await db.execute(delSql, params);
	await db.close();
	for (const item of result) {
		const { user_id, group_id, player_name } = item;
		// 设置取消游戏中
		setGroupMemberCard(group_id, user_id, player_name);
	}
}

/** 群友上下线 */
export async function addDelGroupOnlineMember(group_id: number, serverName: string, players: Player[], isAdd: boolean): Promise<void> {
	// 过滤出是群内的玩家
	const groupPlayers = await filterGroupMember(group_id, players);
	if (groupPlayers.length === 0) {
		return;
	}
	const db = new SQLiteDB(url, createOnlineTableSql);
	await db.open();
	for (const player of groupPlayers) {
		const { user_id, group_id, name, team, admin_level, isWarmed, joinTime } = player;
		let sql: string;
		let params: any[] = [];
		if (isAdd) {
			// 是否已在线
			const onlineSql = `SELECT * FROM onlinePlayers WHERE user_id = ? AND group_id = ?`;
			const onlineParams = [user_id, group_id];
			const onlineResult = await db.query(onlineSql, onlineParams);
			if (onlineResult.length > 0) {
				// 更新
				sql = `UPDATE onlinePlayers SET player_name = ?, server_name = ?, team = ?, admin_level = ?, is_warmed = ?, time_stamp = ? WHERE user_id = ? AND group_id = ?`;
				params = [name, serverName, team, admin_level, isWarmed ? 1 : 0, joinTime, user_id, group_id];
			} else {
				sql = `INSERT INTO onlinePlayers (user_id, group_id, player_name, server_name, team, admin_level, is_warmed, time_stamp) VALUES (?,?,?,?,?,?,?,?)`;
				params = [user_id, group_id, name, serverName, team, admin_level, isWarmed ? 1 : 0, joinTime];
				// 设置游戏中
				setGroupMemberCard(group_id, user_id, "游戏中-" + name);
				// 记录今日上线
				addTodayOnlineMember(serverName, groupPlayers);
			}
		} else {
			// 是否已在线
			const onlineSql = `SELECT * FROM onlinePlayers WHERE user_id = ? AND group_id = ?`;
			const onlineParams = [user_id, group_id];
			const onlineResult = await db.query(onlineSql, onlineParams);
			if (onlineResult.length === 0) {
				continue;
			}

			sql = `DELETE FROM onlinePlayers WHERE user_id = ? AND group_id = ?`;
			params = [user_id, group_id];
			// 设置取消游戏中
			setGroupMemberCard(group_id, user_id, name);
		}
		try {
			await db.execute(sql, params);
		} catch (error) {
			logger.error(`添加或删除群友${name}(${user_id})在线状态失败`, error);
		}
	}
	await db.close();
}

/** 记录今日上线 */
export async function addTodayOnlineMember(serverName: string, players: GroupPlayer[]) {
	const db = new SQLiteDB(url, createHistoryTableSql);
	await db.open();
	// 查看是否已有记录
	let today = getNowDATE();
	const sql = `SELECT * FROM onlineHistory WHERE time >= ?`;
	const params = [today];
	const result = await db.query(sql, params);
	for (const player of players) {
		const { name, isWarmed } = player;
		// 没有记录则插入
		const isExist = result.some((item) => item.player_name === name);
		if (!isExist) {
			today = getNowDATETIME();
			const insertSql = `INSERT INTO onlineHistory (player_name, server_name, is_warmed, time) VALUES (?,?,?,?)`;
			const insertParams = [name, serverName, isWarmed ? 1 : 0, today];
			try {
				await db.execute(insertSql, insertParams);
			} catch (error) {
				logger.error(`插入今日上线记录失败`, error);
			}
		}
	}
	await db.close();
}

/** 设置暖服 */
export async function setWarmPlayer(playerName: string, serverName: string): Promise<void> {
	const db = new SQLiteDB(url, createOnlineTableSql);
	await db.open();
	// 查找玩家
	const sql = `SELECT * FROM onlineHistory WHERE player_name = ? AND server_name = ? ORDER BY time DESC`;
	const params = [playerName, serverName];
	const result = await db.query(sql, params);
	if (result.length === 0) {
		// 插入
		const insertSql = `INSERT INTO onlineHistory (player_name, server_name, is_warmed, time) VALUES (?,?,?,?)`;
		const insertParams = [playerName, serverName, 1, getNowDATETIME()];
		db.execute(insertSql, insertParams);
		return;
	}
	const { id, is_warmed, time } = result[0];
	const today = getNowDATE();
	if (is_warmed && today != getNowDATE(time)) {
		return;
	}
	// 设置暖服
	const setWarmSql = `UPDATE onlineHistory SET is_warmed = 1 WHERE id = ?`;
	const setWarmParams = [id];
	await db.execute(setWarmSql, setWarmParams);
}

/** 获取在线群友 */
export async function getOnlineGroupMember(group_id: number): Promise<GroupPlayer[]> {
	const db = new SQLiteDB(url, createOnlineTableSql);
	await db.open();
	const sql = `SELECT * FROM onlinePlayers WHERE group_id = ? ORDER BY server_name`;
	const params = [group_id];
	const result = await db.query(sql, params);
	const groupPlayers: GroupPlayer[] = [];
	for (const item of result) {
		const { user_id, group_id, player_name, server_name, team, admin_level, time_stamp, is_warmed } = item;
		const player: GroupPlayer = {
			user_id,
			group_id,
			name: player_name,
			server_name: server_name,
			personaId: -1,
			platoon: "",
			team,
			admin_level,
			isWarmed: is_warmed,
			isBot: false,
			warmTime: 0,
			joinTime: time_stamp
		};
		groupPlayers.push(player);
	}
	await db.close();
	return groupPlayers;
}

/** 获取上线记录 */
export async function getOnlineHistory(playerName: string | null = null, year: number | null = null, month: number | null = null): Promise<any[]> {
	if (!year || !month) {
		year = new Date().getFullYear();
		month = new Date().getMonth() + 1;
	}
	// 获取当月的所有记录
	const start = getNowDATETIME(new Date(year, month - 1, 1).getTime());
	const end = getNowDATETIME(new Date(year, month, 1).getTime());

	let sql: string;
	let params: any[] = [];
	if (!playerName) {
		// 查询所有玩家
		sql = `SELECT * FROM onlineHistory WHERE time >= ? AND time < ? ORDER BY time DESC`;
		params = [start, end];
	} else {
		// 查询指定玩家
		sql = `SELECT * FROM onlineHistory WHERE player_name = ? AND time >= ? AND time < ? ORDER BY time DESC`;
		params = [playerName, start, end];
	}

	const db = new SQLiteDB(url, createHistoryTableSql);
	await db.open();
	const result = await db.query(sql, params);
	return result;
}

/** 获取所有上线记录 */
export async function getAllOnlineHistory(count: number = 10): Promise<any[]> {
	const db = new SQLiteDB(url, createHistoryTableSql);
	await db.open();
	// 上线加1，暖服加4，返回每个玩家的计算结果，统计权重最高的10个玩家，同时返回权重
	const sql = `SELECT player_name, COUNT(*) + SUM(is_warmed) * 4 AS total_count FROM onlineHistory GROUP BY player_name ORDER BY total_count DESC LIMIT ?`;
	const params = [count];
	const result = await db.query(sql, params);
	await db.close();
	return result;
}
