import path from "path";
import { SQLiteDB } from "../../utils/sqlite";

const url = path.join(process.cwd(), "data", "botList.db");
const createTableSql = `CREATE TABLE IF NOT EXISTS botList (
    name TEXT NOT NULL
)`;

/** 更新bot列表 */
export async function updateBotList(content: string): Promise<string> {
	// 使用正则表达式提取游戏 ID
	let playerList = content
		.split("\n")
		.map((line) => {
			const match = line.match(/^\S+/);
			return match ? match[0] : null;
		})
		.filter((id) => id !== null && id !== ""); // 去掉空值和空字符串
	if (playerList.length > 0) {
		// 清空原有数据
		const db = new SQLiteDB(url, createTableSql);
		await db.open();
		// await db.execute("DELETE FROM botList");
		// 获取原有数据
		const oldList = await db.query("SELECT name FROM botList");
		const oldListSet = new Set(oldList.map((item) => item.name));
		// 合并数据
		playerList = playerList.concat(Array.from(oldListSet));
		// 去重
		playerList = Array.from(new Set(playerList));
		// 写入新数据
		let playerLenght = playerList.length;
		for (let i = 0; i < playerLenght; i++) {
			const name = playerList[i];
			const insertSQL = `INSERT INTO botList (name) VALUES (?)`;
			await db.execute(insertSQL, [name]);
		}
		await db.close();
		return "更新Bot名单, 当前共有" + playerList.length + "个Bot";
	} else {
		return "没有更新Bot名单, 无有效数据, 格式不正确";
	}
}

/** 查询是否为Bot */
export async function isBot(name: string): Promise<boolean> {
	const db = new SQLiteDB(url, createTableSql);
	await db.open();
	const result = await db.query("SELECT * FROM botList WHERE name = ?", [name]);
	await db.close();
	return result.length > 0;
}

/** 获取所有Bot名单 */
export async function getBotList(): Promise<string[]> {
	const db = new SQLiteDB(url, createTableSql);
	await db.open();
	const result = await db.query("SELECT name FROM botList");
	await db.close();
	return result.map((item) => item.name);
}
