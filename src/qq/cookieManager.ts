import path from "path";
import { SQLiteDB } from "../utils/sqlite";
import { queryTag, updateSession } from "../robot/eaApiManger";
import { sendMsgToQQFriend } from "./sendMessage";

const url = path.join(process.cwd(), "data", "cookies.db");
const createTableSql = `CREATE TABLE IF NOT EXISTS cookies (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_name TEXT NOT NULL,
    sid TEXT NOT NULL,
    is_valid INTEGER DEFAULT 1,
    tag TEXT DEFAULT ''
)`;

/** 修改或添加EA cookie */
export async function modifyOrAddEACookie(user_id: number, player_name: string, sid: string): Promise<string> {
	const db = new SQLiteDB(url, createTableSql);
	await db.open();
	// 查看是否存在cookie
	const sql = `SELECT COUNT(*) AS count FROM cookies WHERE user_id = ?`;
	const params = [user_id];
	const result = await db.query(sql, params);
	if (result[0].count > 0) {
		// 更新cookie
		const sql = `UPDATE cookies SET sid = ?, is_valid = 1 WHERE user_id = ?`;
		const params = [sid, user_id];
		await db.execute(sql, params);
	} else {
		// 添加cookie
		const sql = `INSERT INTO cookies (user_id, player_name, sid) VALUES (?,?,?)`;
		const params = [user_id, player_name, sid];
		await db.execute(sql, params);
	}
	await db.close();
	let message = `玩家: ${player_name}\nCookie更新或绑定成功`;
	return message;
}

/** 删除EA cookie */
export async function deleteEACookie(user_id: number): Promise<string> {
	const db = new SQLiteDB(url, createTableSql);
	await db.open();
	// 是否存在cookie
	const sql = `SELECT COUNT(*) AS count FROM cookies WHERE user_id = ?`;
	const params = [user_id];
	const result = await db.query(sql, params);
	if (result[0].count > 0) {
		// 删除cookie
		const sql = `DELETE FROM cookies WHERE user_id = ?`;
		const params = [user_id];
		await db.execute(sql, params);
		return `qq: ${user_id}\nCookie删除成功\n你已成功解绑Cookie`;
	} else {
		return `qq: ${user_id}\n该QQ号没有绑定Cookie`;
	}
}

/** 获取所有cookie */
export async function getAllCookie(is_valid: boolean = true): Promise<any[]> {
	const db = new SQLiteDB(url, createTableSql);
	await db.open();
	if (is_valid) {
		const sql = `SELECT * FROM cookies WHERE is_valid = 1`;
		const result = await db.query(sql);
		return result;
	} else {
		const sql = `SELECT * FROM cookies ORDER BY is_valid DESC`;
		const result = await db.query(sql);
		return result;
	}
}

/** cookie过期 */
export async function expireCookie(player_name: string): Promise<void> {
	const db = new SQLiteDB(url, createTableSql);
	await db.open();
	// 是否存在cookie
	const sql = `SELECT * FROM cookies WHERE player_name = ?`;
	const params = [player_name];
	const result = await db.query(sql, params);
	if (result.length > 0) {
		// 过期cookie
		const sql = `UPDATE cookies SET is_valid = 0 WHERE player_name = ?`;
		const params = [player_name];
		await db.execute(sql, params);
		sendMsgToQQFriend(`玩家名: ${player_name}\n您的Cookie已过期\n请使用sid=???重新验证`, result[0].user_id);
	}
	await db.close();
}

/** 设置tag */
export async function setTag(player_name: string, tag: string): Promise<string> {
	const db = new SQLiteDB(url, createTableSql);
	await db.open();
	// 是否存在cookie
	const sql = `SELECT COUNT(*) AS count FROM cookies WHERE player_name = ?`;
	const params = [player_name];
	const result = await db.query(sql, params);
	if (result[0].count > 0) {
		// 用来的tag拥有者
		const sql = `SELECT player_name FROM cookies WHERE tag = ?`;
		const params = [tag];
		const result = await db.query(sql, params);

		// 取消原有tag
		const sql1 = `UPDATE cookies SET tag = '' WHERE player_name = ?`;
		const params1 = [player_name];
		await db.execute(sql1, params1);

		// 设置tag
		const sql2 = `UPDATE cookies SET tag = ? WHERE player_name = ?`;
		const params2 = [tag, player_name];
		await db.execute(sql2, params2);
		await db.close();

		// 如果是更新EA查询的sid，就更新session
		if (tag === queryTag) {
			updateSession();
		}

		return `玩家: ${player_name}\n${tag}设置成功\n原[${result[0].tag}] --> 现[${player_name}]`;
	} else {
		await db.close();
		return `玩家: ${player_name}\n该玩家没有绑定Cookie\n请先绑定Cookie`;
	}
}

/** 获取tag */
export async function getTag(tag: string): Promise<any[]> {
	const db = new SQLiteDB(url, createTableSql);
	await db.open();
	const sql = `SELECT * FROM cookies WHERE tag = ?`;
	const params = [tag];
	const result = await db.query(sql, params);
	await db.close();
	return result;
}
