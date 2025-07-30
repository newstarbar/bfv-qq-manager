import path from "path";
import { SQLiteDB } from "../../utils/sqlite";
import { isPlayerNameExist } from "../cx/basePlayerQuery";
import { getNowDATETIME } from "../../utils/timeTool";
import { LocalBlackPlayer } from "../../interface/player";
import { getAllServerConfig } from "../serverConfigManager";
import { ServerConfig } from "../../interface/ServerInfo";
import { sendMsgToQQFriend } from "../../qq/sendMessage";
import { readConfigFile } from "../../utils/localFile";

const url = path.join(process.cwd(), "data", "blackList.db");
const createLocalTableSql = `CREATE TABLE IF NOT EXISTS localBlackList (
    personaId INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    reason TEXT NOT NULL,
    admin_name TEXT NOT NULL,
    admin_qq INTEGER NOT NULL,
    time DATETIME NOT NULL
)`;
const createGlobalTableSql = `CREATE TABLE IF NOT EXISTS globalBlackList (
    personaId INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    reason TEXT NOT NULL,
    group_name TEXT NOT NULL,
    group_id INTEGER NOT NULL,
    admin_name TEXT NOT NULL,
    admin_qq INTEGER NOT NULL,
    time DATETIME NOT NULL
)`;
const createTempTableSql = `CREATE TABLE IF NOT EXISTS tempBlackList (
    personaId INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    reason_type TEXT NOT NULL,
    reason_text TEXT NOT NULL,
    time DATETIME NOT NULL
)`;

/** 添加本地黑名单 */
export async function addLocalBlackList(name: string, reason: string, admin_name: string, admin_qq: number): Promise<{ isSuccess: boolean; content: string }> {
	// 查询personaId
	const result = await isPlayerNameExist(name);
	// 判断result的类型
	if (typeof result !== "string") {
		const personaId = result.personaId;
		const db = new SQLiteDB(url, createLocalTableSql);
		await db.open();

		// 是否有小电视服务器
		const allServerConfig = await getAllServerConfig(false);
		const isTvServer = (allServerConfig as ServerConfig[]).some((item) => item.tv);
		if (isTvServer) {
			const group_name = readConfigFile().group_name;
			// 直接发送小电视屏蔽消息
			sendMsgToQQFriend(`/ban ${group_name} ${name} ${reason}`, 3889013937);
		}

		// 是否已经存在
		const querySql = `SELECT * FROM localBlackList WHERE personaId = ?`;
		const queryResult = await db.query(querySql, [personaId]);
		const today = getNowDATETIME();

		if (queryResult.length > 0) {
			// 更新
			const updateSql = `UPDATE localBlackList SET reason = ?, admin_name = ?, admin_qq = ?, time = ? WHERE personaId = ?`;
			await db.execute(updateSql, [reason, admin_name, admin_qq, today, personaId]);
			await db.close();
			return { isSuccess: true, content: `已经存在${name}的本地黑名单\n${personaId}\n状态已更新\n原因: ${reason}\n操作人: ${admin_name}\n操作QQ: ${admin_qq}` };
		} else {
			// 插入
			const insertSql = `INSERT INTO localBlackList (personaId, name, reason, admin_name, admin_qq, time) VALUES (?, ?, ?, ?, ?, ?)`;
			await db.execute(insertSql, [personaId, name, reason, admin_name, admin_qq, today]);
			await db.close();

			return { isSuccess: true, content: `添加${name}的本地黑名单成功\n${personaId}\n原因: ${reason}\n操作人: ${admin_name}\n操作QQ: ${admin_qq}` };
		}
	} else {
		return { isSuccess: false, content: result };
	}
}

/** 删除本地黑名单 */
export async function deleteLocalBlackList(name: string): Promise<string> {
	let message = "";
	// 本地黑名单
	const localDB = new SQLiteDB(url, createLocalTableSql);
	await localDB.open();

	// 是否有小电视服务器
	const allServerConfig = await getAllServerConfig(false);
	const isTvServer = (allServerConfig as ServerConfig[]).some((item) => item.tv);
	if (isTvServer) {
		const group_name = readConfigFile().group_name;
		// 直接发送小电视屏蔽消息
		sendMsgToQQFriend(`/unban ${group_name} ${name}`, 3889013937);
	}

	// 是否存在
	const querySql = `SELECT * FROM localBlackList WHERE name = ?`;
	const queryResult = await localDB.query(querySql, [name]);
	if (queryResult.length > 0) {
		const sql = `DELETE FROM localBlackList WHERE name = ?`;
		await localDB.execute(sql, [name]);
		message += `在本地黑名单中: \n删除${name}成功\n`;
	} else {
		message += `在本地黑名单中: \n${name}不存在\n`;
	}
	await localDB.close();

	// 临时黑名单
	const tempDB = new SQLiteDB(url, createTempTableSql);
	await tempDB.open();
	// 是否存在
	const tempQuerySql = `SELECT * FROM tempBlackList WHERE name = ?`;
	const tempQueryResult = await tempDB.query(tempQuerySql, [name]);
	if (tempQueryResult.length > 0) {
		const tempSql = `DELETE FROM tempBlackList WHERE name = ?`;
		await tempDB.execute(tempSql, [name]);
		message += `在临时黑名单中: \n删除${name}成功\n`;
	} else {
		message += `在临时黑名单中: \n${name}不存在\n`;
	}
	await tempDB.close();
	return message;
}

/** 查看所有本地黑名单 */
export async function getAllLocalBlackList(): Promise<LocalBlackPlayer[]> {
	const db = new SQLiteDB(url, createLocalTableSql);
	await db.open();
	const querySql = `SELECT * FROM localBlackList ORDER BY time DESC`;
	const queryResult = (await db.query(querySql)) as LocalBlackPlayer[];
	await db.close();
	return queryResult;
}

/** 是否是本地黑名单 */
export async function isLocalBlackList(personaId: number): Promise<LocalBlackPlayer[]> {
	const db = new SQLiteDB(url, createLocalTableSql);
	await db.open();
	const querySql = `SELECT * FROM localBlackList WHERE personaId = ?`;
	const queryResult = await db.query(querySql, [personaId]);
	await db.close();
	return queryResult;
}

/** 添加临时黑名单 */
export async function addTempBlackList(name: string, personaId: number, reason_type: string, reason_text: string): Promise<{ isSuccess: boolean; content: string }> {
	// 是否已经存在
	const db = new SQLiteDB(url, createTempTableSql);
	await db.open();
	const querySql = `SELECT * FROM tempBlackList WHERE personaId = ?`;
	const queryResult = await db.query(querySql, [personaId]);
	const today = getNowDATETIME();
	if (queryResult.length > 0) {
		// 更新
		const updateSql = `UPDATE tempBlackList SET name = ?, reason_type = ?, reason_text = ?, time = ? WHERE personaId = ?`;
		await db.execute(updateSql, [name, reason_type, reason_text, today, personaId]);
		await db.close();
		return { isSuccess: true, content: `已经存在${name}的临时黑名单\n状态已更新\n原因类型: ${reason_type}\n原因内容: ${reason_text}` };
	} else {
		// 插入
		const insertSql = `INSERT INTO tempBlackList (personaId, name, reason_type, reason_text, time) VALUES (?, ?, ?, ?, ?)`;
		await db.execute(insertSql, [personaId, name, reason_type, reason_text, today]);
		await db.close();
		return { isSuccess: true, content: `添加${name}的临时黑名单成功\n原因类型: ${reason_type}\n原因内容: ${reason_text}` };
	}
}

/** 查看所有临时黑名单 */
export async function getAllTempBlackList(): Promise<{ name: string; personaId: number; reason_type: string; reason_text: string; time: string }[]> {
	const db = new SQLiteDB(url, createTempTableSql);
	await db.open();
	const querySql = `SELECT * FROM tempBlackList ORDER BY time DESC`;
	const queryResult = await db.query(querySql);
	await db.close();
	return queryResult;
}

/** 是否是临时黑名单 */
export async function isTempBlackList(personaId: number): Promise<{ name: string; reason_type: string; reason_text: string; time: string }[]> {
	const db = new SQLiteDB(url, createTempTableSql);
	await db.open();
	const querySql = `SELECT * FROM tempBlackList WHERE personaId = ?`;
	const queryResult = await db.query(querySql, [personaId]);
	await db.close();
	return queryResult;
}

/** 移除临时黑名单 */
export async function removeTempBlackList(name: string): Promise<string> {
	const db = new SQLiteDB(url, createTempTableSql);
	await db.open();
	const sql = `DELETE FROM tempBlackList WHERE name = ?`;
	await db.execute(sql, [name]);
	await db.close();
	return `移除${name}的临时黑名单成功`;
}

/** 添加全局黑名单 */
export async function addGlobalBlackList(
	name: string,
	personaId: number,
	reason: string,
	group_name: string,
	group_id: number,
	admin_name: string,
	admin_qq: number,
	time: string
): Promise<{ isSuccess: boolean; content: string }> {
	// 是否已经存在
	const db = new SQLiteDB(url, createGlobalTableSql);
	await db.open();
	const querySql = `SELECT * FROM globalBlackList WHERE personaId = ?`;
	const queryResult = await db.query(querySql, [personaId]);
	if (queryResult.length > 0) {
		// 更新
		const updateSql = `UPDATE globalBlackList SET name = ?, reason = ?, group_name = ?, group_id = ?, admin_name = ?, admin_qq = ?, time = ? WHERE personaId = ?`;
		await db.execute(updateSql, [name, reason, group_name, group_id, admin_name, admin_qq, time, personaId]);
		await db.close();
		return { isSuccess: true, content: `已经存在${name}的全局黑名单\n${personaId}\n状态已更新\n原因: ${reason}\n操作人: ${admin_name}\n操作QQ: ${admin_qq}` };
	} else {
		// 插入
		const insertSql = `INSERT INTO globalBlackList (personaId, name, reason, group_name, group_id, admin_name, admin_qq, time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
		await db.execute(insertSql, [personaId, name, reason, group_name, group_id, admin_name, admin_qq, time]);
		await db.close();
		return { isSuccess: true, content: `添加${name}的全局黑名单成功\n${personaId}\n原因: ${reason}\n操作人: ${admin_name}\n操作QQ: ${admin_qq}` };
	}
}

/** 删除全局黑名单 */
export async function deleteGlobalBlackList(name: string): Promise<string> {
	let message = "";
	// 全局黑名单
	const globalDB = new SQLiteDB(url, createGlobalTableSql);
	await globalDB.open();
	// 是否存在
	const querySql = `SELECT * FROM globalBlackList WHERE name = ?`;
	const queryResult = await globalDB.query(querySql, [name]);
	if (queryResult.length > 0) {
		const sql = `DELETE FROM globalBlackList WHERE name = ?`;
		await globalDB.execute(sql, [name]);
		message += `在全局黑名单中: \n删除${name}成功\n`;
	} else {
		message += `在全局黑名单中: \n${name}不存在\n`;
	}
	await globalDB.close();
	return message;
}

/** 查看所有全局黑名单 */
export async function getAllGlobalBlackList(): Promise<{ personaId: number; name: string; reason: string; group_name: string; admin_name: string; admin_qq: number; time: string }[]> {
	const db = new SQLiteDB(url, createGlobalTableSql);
	await db.open();
	const querySql = `SELECT * FROM globalBlackList ORDER BY time DESC`;
	const queryResult = await db.query(querySql);
	await db.close();
	return queryResult;
}

/** 是否是全局黑名单 */
export async function isGlobalBlackList(personaId: number): Promise<{ personaId: number; name: string; reason: string; group_name: string; admin_name: string; admin_qq: number; time: string }[]> {
	const db = new SQLiteDB(url, createGlobalTableSql);
	await db.open();
	const querySql = `SELECT * FROM globalBlackList WHERE personaId = ?`;
	const queryResult = await db.query(querySql, [personaId]);
	await db.close();
	return queryResult;
}
