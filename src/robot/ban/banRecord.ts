import path from "path";
import logger from "../../utils/logger";
import { SQLiteDB } from "../../utils/sqlite";

const url = path.join(process.cwd(), "data", "banRecord.db");
const createTableSql = `CREATE TABLE IF NOT EXISTS banRecord (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_name TEXT NOT NULL,
    persona_id INTEGER NOT NULL,
    server_name TEXT NOT NULL,
    game_id INTEGER NOT NULL,
    admin_name TEXT NOT NULL,
    admin_user_id INTEGER NOT NULL,
    reason TEXT NOT NULL,
    is_kick BOOLEAN NOT NULL,
    is_tv BOOLEAN NOT NULL,
    time DATETIME NOT NULL
)`;

/** 添加屏蔽记录 */
export async function addBanRecord(
	gameId: number,
	playerName: string,
	personaId: number,
	serverName: string,
	admin_name: string,
	admin_user_id: number,
	reason: string,
	time: string,
	is_tv: boolean,
	is_kick: boolean
) {
	const db = new SQLiteDB(url, createTableSql);
	await db.open();
	const sql = "INSERT INTO banRecord (player_name, persona_id, server_name, game_id, admin_name, admin_user_id, reason, is_tv, is_kick, time) VALUES (?,?,?,?,?,?,?,?,?,?)";
	const params = [playerName, personaId, serverName, gameId, admin_name, admin_user_id, reason, is_tv ? 1 : 0, is_kick ? 1 : 0, time];
	await db.execute(sql, params);
	await db.close();
	logger.info(`添加屏蔽记录成功，玩家：${playerName}, 服务器：${serverName}, 原因：${reason}`);
}

/** 获取屏蔽记录 */
export async function getPlayerBanRecord(playerName: string): Promise<any[]> {
	const db = new SQLiteDB(url, createTableSql);
	await db.open();
	const sql = "SELECT * FROM banRecord WHERE player_name = ? ORDER BY time DESC";
	const params = [playerName];
	const result = await db.query(sql, params);
	await db.close();
	// 一个月内的记录
	const oneMonthAgo = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000);
	const records = result.filter((record) => new Date(record.time) > oneMonthAgo);
	return records;
}
