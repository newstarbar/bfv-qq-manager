import { ServerConfig } from "../interface/ServerInfo";

import path from "path";
import { SQLiteDB } from "../utils/sqlite";
import { decodeHTML } from "../utils/stringTool";
import { readConfigFile } from "../utils/localFile";
import { sendMsgToQQGroup } from "../qq/sendMessage";
import logger from "../utils/logger";

const url = path.join(process.cwd(), "data", "serverConfig.db");
const createTableSql = `CREATE TABLE IF NOT EXISTS serverConfig (
    tag TEXT PRIMARY KEY,
    group_id INTEGER,
	zh_name TEXT,
    en_name TEXT,
    id TEXT,
    level INTEGER,
    warm_level INTEGER,
    kd INTEGER,
    kpm INTEGER,
    nokill INTEGER,
    kill INTEGER,
    warm_player INTEGER,
    tv BOOLEAN,
    is_onlined BOOLEAN DEFAULT 0
)`;

/** 创建服务器配置 */
export async function createServerConfig(serverConfig: ServerConfig, group_id: number): Promise<string> {
	const { group_name: groupName } = await readConfigFile();
	if (!groupName) {
		return `请先使用group命令\n来设置你的群组名`;
	}

	const tempServerName = serverConfig.zh_name.toLowerCase();
	const tempGroupName = groupName.toLowerCase();
	if (!tempServerName.includes(tempGroupName)) {
		return `服务器名称中未找到群组名${groupName}\n请修改服务器名称后再创建`;
	}

	const db = new SQLiteDB(url, createTableSql);
	await db.open();

	// 如果表中没有zh_name,en_name字段则删表重建
	const tableInfo = await db.query("PRAGMA table_info(serverConfig)");
	if (!tableInfo.some((item) => item.name === "zh_name") || !tableInfo.some((item) => item.name === "en_name")) {
		// 发送所有原表数据
		const oldConfigs = await db.query("SELECT * FROM serverConfig");
		let content = `服务器配置数据库更新，清空所有数据更新\n`;
		for (const oldConfig of oldConfigs) {
			const { tag, group_id, name, id, level, warm_level, kd, kpm, nokill, kill, warm_player, tv } = oldConfig;
			content += `create=${tag} "${name}" ${id} ${level} ${warm_level} ${kd} ${kpm} ${nokill} ${kill} ${warm_player} ${tv}\n`;
		}
		sendMsgToQQGroup(group_id, content, null);

		await db.execute("DROP TABLE serverConfig");
		await db.execute(createTableSql);
	}

	// 是否已经存在
	const exist = await db.query("SELECT * FROM serverConfig WHERE tag = ?", [serverConfig.tag]);
	if (exist.length > 0) {
		return `服务器配置${serverConfig.tag}\n已经存在, 请勿重复创建\n如需修改 使用update命令`;
	}
	// 插入数据
	await db.execute("INSERT INTO serverConfig (tag, group_id, zh_name, en_name, id, level, warm_level, kd, kpm, nokill, kill, warm_player, tv) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)", [
		serverConfig.tag,
		group_id,
		serverConfig.zh_name,
		serverConfig.en_name,
		serverConfig.id,
		serverConfig.level,
		serverConfig.warm_level,
		serverConfig.kd,
		serverConfig.kpm,
		serverConfig.nokill,
		serverConfig.kill,
		serverConfig.warm_player,
		serverConfig.tv
	]);
	await db.close();
	return `服务器配置${serverConfig.tag}\n创建成功\n\n中文服名: ${serverConfig.zh_name}\n原英文服名: ${serverConfig.en_name}\n群聊: ${group_id}\n服务器ID: ${serverConfig.id}\n限制等级 <${
		serverConfig.level
	}\n限制暖服等级 < ${serverConfig.warm_level}\n限制KD < ${serverConfig.kd}\n限制KPM < ${serverConfig.kpm}\n未加群击杀 < ${serverConfig.nokill}\n加群击杀 < ${serverConfig.kill}\n暖服人数 < ${
		serverConfig.warm_player
	} 人时\n 是否为小电视服: ${serverConfig.tv ? "[是]" : "[否]"}`;
}

/** 更新服务器配置 */
export async function updateServerConfig(tag: string, config: string, value: string | number): Promise<string> {
	if (config == "en_name" || config == "zh_name") {
		const { group_name: groupName } = await readConfigFile();
		if (!groupName) {
			return `请先使用group命令\n来设置你的群组名`;
		}

		const tempServerName = (value as string).toLowerCase();
		const tempGroupName = groupName.toLowerCase();
		if (!tempServerName.includes(tempGroupName)) {
			return `服务器名称中未找到群组名${groupName}\n请修改服务器名称后再更新`;
		}
	}

	const db = new SQLiteDB(url, createTableSql);
	await db.open();

	// 如果表中没有zh_name,en_name字段则删表重建
	const tableInfo = await db.query("PRAGMA table_info(serverConfig)");
	if (!tableInfo.some((item) => item.name === "zh_name") || !tableInfo.some((item) => item.name === "en_name")) {
		// 发送所有原表数据
		const oldConfigs = await db.query("SELECT * FROM serverConfig");
		let content = `服务器配置数据库更新，清空所有数据更新\n`;
		for (const oldConfig of oldConfigs) {
			const { tag, group_id, name, id, level, warm_level, kd, kpm, nokill, kill, warm_player, tv } = oldConfig;
			content += `create=${tag} "${name}" ${id} ${level} ${warm_level} ${kd} ${kpm} ${nokill} ${kill} ${warm_player} ${tv}\n`;
			sendMsgToQQGroup(group_id, content, null);
		}

		await db.execute("DROP TABLE serverConfig");
		await db.execute(createTableSql);
	}

	// 是否存在
	const exist = await db.query("SELECT * FROM serverConfig WHERE tag = ?", [tag]);
	if (exist.length === 0) {
		return `服务器配置${tag}\n不存在, 请先创建`;
	}
	// 查看config是否合规
	if (
		config != "zh_name" &&
		config != "en_name" &&
		config != "group_id" &&
		config != "id" &&
		config != "level" &&
		config != "warm_level" &&
		config != "kd" &&
		config != "kpm" &&
		config != "nokill" &&
		config != "kill" &&
		config != "warm_player" &&
		config != "tv"
	) {
		return `服务器配置项${config}\n不存在, 请检查配置名称\n合法配置名称: zh_name, en_name, group_id, id, level, warm_level, kd, kpm, nokill, kill, warm_player, tv\n指令config查看解释说明`;
	}
	let newValue = value;
	if (config == "en_name" || config == "zh_name") {
		newValue = decodeHTML(value as string);
	}
	// 更新数据
	const sql = `UPDATE serverConfig SET ${config} = ? WHERE tag = ?`;
	const params = [newValue, tag];
	await db.execute(sql, params);
	await db.close();
	return `服务器配置${config}\n更新成功\n${config}: ${newValue}\n请记得使用check命令刷新`;
}

/** 删除服务器配置 */
export async function deleteServerConfig(tag: string): Promise<string> {
	const db = new SQLiteDB(url, createTableSql);
	await db.open();
	// 是否存在
	const exist = await db.query("SELECT * FROM serverConfig WHERE tag = ?", [tag]);
	if (exist.length === 0) {
		return `服务器配置${tag}\n不存在, 请检查配置名称`;
	}
	// 删除数据
	await db.execute("DELETE FROM serverConfig WHERE tag = ?", [tag]);
	await db.close();
	return `服务器配置${tag}\n删除成功`;
}

/** 查看服务器配置 */
export async function getServerConfig(tag: string): Promise<any[]> {
	const db = new SQLiteDB(url, createTableSql);
	await db.open();
	// 是否存在
	const result = await db.query("SELECT * FROM serverConfig WHERE tag = ?", [tag]);
	await db.close();
	return result;
}

/** 查看所有服务器配置 */
export async function getAllServerConfig(is_text: boolean = true): Promise<string | ServerConfig[]> {
	const db = new SQLiteDB(url, createTableSql);
	await db.open();
	// 如果表中没有zh_name,en_name字段则删表重建
	const tableInfo = await db.query("PRAGMA table_info(serverConfig)");
	if (!tableInfo.some((item) => item.name === "zh_name") || !tableInfo.some((item) => item.name === "en_name")) {
		// 发送所有原表数据
		const oldConfigs = await db.query("SELECT * FROM serverConfig");
		let content = `服务器配置数据库更新，清空所有数据更新\n`;
		for (const oldConfig of oldConfigs) {
			const { tag, group_id, name, id, level, warm_level, kd, kpm, nokill, kill, warm_player, tv } = oldConfig;
			content += `create=${tag} "${name}" ${id} ${level} ${warm_level} ${kd} ${kpm} ${nokill} ${kill} ${warm_player} ${tv}\n`;
			sendMsgToQQGroup(group_id, content, null);
		}

		await db.execute("DROP TABLE serverConfig");
		await db.execute(createTableSql);
	}

	// 查看数据
	const configs = await db.query("SELECT * FROM serverConfig");
	if (is_text) {
		let result = `所有服务器配置\n`;
		for (const config of configs) {
			result += `序号: ${config.tag}\n中文服名: ${config.zh_name}\n原英文服名: ${config.en_name}\n群聊: ${config.group_id}\n服务器ID: ${config.id}\n限制等级 < ${config.level}\n限制暖服等级 < ${
				config.warm_level
			}\n限制KD < ${config.kd}\n限制KPM < ${config.kpm}\n未加群击杀 < ${config.nokill}\n加群击杀 < ${config.kill}\n暖服人数 < ${config.warm_player} 人时\n 是否为小电视服: ${
				config.tv ? "[是]" : "[否]"
			}\n\n`;
		}
		await db.close();
		return result;
	} else {
		return configs as ServerConfig[];
	}
}

/** 获取所有在线服务器配置 */
export async function getOnlineServerConfig(): Promise<ServerConfig[]> {
	const db = new SQLiteDB(url, createTableSql);
	await db.open();
	// 查看数据
	const configs = await db.query("SELECT * FROM serverConfig WHERE is_onlined = 1");
	await db.close();
	return configs;
}

/** 设置服务器在线状态 */
export async function setServerOnline(tag: string, is_onlined: boolean): Promise<void> {
	const db = new SQLiteDB(url, createTableSql);
	await db.open();
	// 是否存在
	const exist = await db.query("SELECT * FROM serverConfig WHERE tag = ?", [tag]);
	if (exist.length === 0) {
		return;
	}
	// 更新数据
	const sql = `UPDATE serverConfig SET is_onlined = ? WHERE tag = ?`;
	const params = [is_onlined ? 1 : 0, tag];
	await db.execute(sql, params);
	await db.close();
}
