import path from "path";
import logger from "../utils/logger";
import { SQLiteDB } from "../utils/sqlite";
import { Player, ServerConfig, ServerPlayers } from "../interface/ServerInfo";
import { getAdminMemberInfo } from "../qq/memberManager";
import { expireCookie, getAllCookie } from "../qq/cookieManager";
import { bfvAxios, proxyAxios } from "../utils/axios";
import { getServerConfig } from "./serverConfigManager";
import { AxiosError } from "axios";
import { readConfigFile } from "../utils/localFile";

const url = path.join(process.cwd(), "data", "serverSayConfig.db");
const createTableSql = `CREATE TABLE IF NOT EXISTS serverSayConfig (
    tag TEXT PRIMARY KEY,
    group_id INTEGER,
    server_name TEXT,
    auto_say_json TEXT,
    warm_say_text TEXT,
    auto_say_index INTEGER DEFAULT 0,
    auto_say_interval INTEGER,
    last_say_time INTEGER,
    auto_say_enable INTEGER DEFAULT 0
)`;

interface SayQueue {
	type: "notice" | "speech" | "warn";
	playerName: string;
	sid: string;
	content: string;
}

const botqq = readConfigFile().bot_qq;

// 播报的待执行队列
let sayQueue: SayQueue[] = [];

let timer: NodeJS.Timeout | null = null;
/** 播报定时器 */
export function initSayTimer(): void {
	if (timer) {
		clearTimeout(timer);
	}
	timer = setInterval(serverSayManager, 1000 * 7); // 每7秒处理一次消息队列
}

/** 服务器播报管理模块 */
export async function serverSayManager(): Promise<void> {
	if (sayQueue.length === 0) {
		return;
	}
	const { type, playerName, sid, content } = sayQueue.shift()!;
	if (content === "") {
		return;
	}
	let message: string = "";
	switch (type) {
		case "notice":
			message = `【自动播报】${content}`;
			break;
		case "speech":
			message = `【管理发言】${content}`;
			break;
		case "warn":
			message = `【屏蔽消息】${content}`;
			break;
	}
	await bfvAxios()
		.post("player/sendMessage", {
			remid: "remid",
			sid: sid,
			content: message
		})
		.then((res) => {
			// logger.info(`播报信息 ${playerName} ${res.data}`)
		})
		.catch((e) => {
			const err = e as AxiosError;
			const message = (err.response?.data as any).message;
			logger.error(`播报消息失败：${playerName} ${message}`);
			if (message === "无效的Cookie") {
				// 移除无效的cookie
				expireCookie(playerName);
			}
		});
}

let onlineAdminList: any[] = [];
/** 当前满足条件的管理员列表 */
let validSayAdminList: { user_id: number; player_name: string; sid: string; is_valid: boolean; tag: string }[] = [];

/** 服务器自动播报刷新模块 */
export async function serverAutoSayUpdate(serverConfig: ServerConfig, serverPlayers: ServerPlayers, isWarm: boolean): Promise<void> {
	const soldierPlayers = serverPlayers.soldier.filter((player) => !player.isBot);
	const queuePlayers = serverPlayers.queue.filter((player) => !player.isBot);
	const spectatorPlayers = serverPlayers.spectator.filter((player) => !player.isBot);
	const allPlayers = soldierPlayers.concat(queuePlayers, spectatorPlayers);
	// 获取所有管理员
	const adminList = await getAdminMemberInfo(serverConfig.group_id, 1);
	if (adminList.length === 0) {
		return;
	}
	// 获取在线管理员
	const onlineAdmin = adminList.filter((admin) => allPlayers.some((player) => player.name === admin.player_name));
	if (onlineAdmin.length === 0) {
		return;
	}
	// 刷新在线管理员列表
	onlineAdminList = onlineAdmin;
	// 获取所有cookie有效的管理列表
	const validAdminList = await getAllCookie(true);
	const validAdmin = validAdminList.filter((admin) => onlineAdmin.some((online) => online.player_name === admin.player_name));
	if (validAdmin.length === 0) {
		return;
	}
	// 刷新管理员列表
	validSayAdminList = validAdmin;

	// 获取该服的自动播报配置
	const db = new SQLiteDB(url, createTableSql);
	await db.open();
	const sql = `SELECT * FROM serverSayConfig WHERE tag = ?`;
	const result = await db.query(sql, [serverConfig.tag]);
	if (result.length === 0) {
		return;
	}
	const autoSayJson = result[0].auto_say_json;
	const autoSayTextList = JSON.parse(autoSayJson);

	const autoSayIndex = result[0].auto_say_index;
	const autoSayInterval = result[0].auto_say_interval;
	const lastSayTime = result[0].last_say_time;
	const autoSayEnable = result[0].auto_say_enable;
	if (autoSayEnable === 0) {
		return;
	}
	// 是否达到自动播报的间隔
	const now = new Date().getTime();
	if (now - lastSayTime < autoSayInterval * 1000 * 60) {
		return;
	}
	let sayText: string = "";
	if (!isWarm) {
		// 获取暖服播报文本
		sayText = result[0].warm_say_text;
		if (sayText === "") {
			// 获取当前播报的文本
			sayText = autoSayTextList[autoSayIndex % autoSayTextList.length];
			// 播报index自增
			const newIndex = (autoSayIndex + 1) % autoSayTextList.length;
			// 更新数据库
			const updateSql = `UPDATE serverSayConfig SET auto_say_index = ?, last_say_time = ? WHERE tag = ?`;
			await db.execute(updateSql, [newIndex, now, serverConfig.tag]);
		} else {
			// 更新数据库
			const updateSql = `UPDATE serverSayConfig SET last_say_time = ? WHERE tag = ?`;
			await db.execute(updateSql, [now, serverConfig.tag]);
		}
	} else {
		// 获取当前播报的文本
		sayText = autoSayTextList[autoSayIndex % autoSayTextList.length];
		// 播报index自增
		const newIndex = (autoSayIndex + 1) % autoSayTextList.length;
		// 更新数据库
		const updateSql = `UPDATE serverSayConfig SET auto_say_index = ?, last_say_time = ? WHERE tag = ?`;
		await db.execute(updateSql, [newIndex, now, serverConfig.tag]);
	}
	// 随机选择一个管理员发送播报消息
	const randomAdmin = validAdmin[Math.floor(Math.random() * validAdmin.length)];
	// 发送播报消息
	sayQueue.push({
		type: "notice",
		playerName: randomAdmin.player_name,
		sid: randomAdmin.sid,
		content: sayText
	});
}

/** 管理员发送消息 */
export async function adminSay(playerName: string, content: string): Promise<string> {
	// 是否在游戏中
	if (!onlineAdminList.some((admin) => admin.player_name === playerName)) {
		return "你当前不在游戏中, 无法发送消息";
	}
	// 是否有效cookie
	const validAdmin = validSayAdminList.find((admin) => admin.player_name === playerName);
	if (!validAdmin) {
		return "你当前没有有效的Cookie, 无法发送消息";
	}
	// 发送消息
	const { sid } = validAdmin;
	sayQueue.push({
		type: "speech",
		playerName: playerName,
		sid: sid,
		content: content
	});
	return "消息已加入播报队列, 等待发送中";
}

/** 屏蔽消息 */
export async function adminBanKick(content: string, playerName: string | null = null): Promise<void> {
	// 是否有在线管理员在游戏中
	if (validSayAdminList.length === 0) {
		return;
	}
	// 是否存在对应管理员
	let admin: any | null = null;
	if (playerName) {
		admin = validSayAdminList.find((admin) => admin.player_name === playerName);
	} else {
		admin = validSayAdminList[Math.floor(Math.random() * validSayAdminList.length)];
	}
	if (!admin) {
		return;
	}
	// 发送消息
	const { sid } = admin;
	sayQueue.push({
		type: "warn",
		playerName: admin.player_name,
		sid: sid,
		content: content
	});
}

/** 添加配置 */
export async function addServerSayConfig(tag: string, group_id: number, texts: string[]): Promise<string> {
	// 查询服务器名称
	const result = await getServerConfig(tag);
	if (result.length === 0) {
		return `服务器tag: ${tag}不存在`;
	}
	const serverName = result[0].zh_name;
	// 查看是否已存在该配置
	const db = new SQLiteDB(url, createTableSql);
	await db.open();
	const sql = `SELECT * FROM serverSayConfig WHERE tag = ? AND group_id = ? AND server_name = ?`;
	const config = await db.query(sql, [tag, group_id, serverName]);
	if (config.length > 0) {
		return `服务器${tag}播报配置已存在\n请使用sayupdate命令更新配置`;
	}
	// 保存配置
	const autoSayJson = JSON.stringify(texts);
	const insertSql = `INSERT INTO serverSayConfig (tag, group_id, server_name, auto_say_json, warm_say_text, auto_say_index, auto_say_interval, last_say_time, auto_say_enable) VALUES (?,?,?,?,?,?,?,?,?)`;
	await db.execute(insertSql, [tag, group_id, serverName, autoSayJson, "", 0, 5, 0, 1]);
	await db.close();
	return `服务器${tag}播报配置添加成功\n播报内容: [${texts.join("\n")}]\n自动播报间隔: 5分钟\n自动播报启用: 开启\n暖服播报内容: 空\n请使用sayupdate命令更新配置`;
}

/** 更新配置 */
export async function updateServerSayConfig(tag: string, group_id: number, config: string, value: string | string[]): Promise<string> {
	// 查询服务器名称
	const result = await getServerConfig(tag);
	if (result.length === 0) {
		return `服务器tag: ${tag}不存在`;
	}
	const serverName = result[0].zh_name;
	// 查看是否已存在该配置
	const db = new SQLiteDB(url, createTableSql);
	await db.open();
	const sql = `SELECT * FROM serverSayConfig WHERE tag = ?`;
	const configList = await db.query(sql, [tag]);
	if (configList.length === 0) {
		return `服务器${tag}播报配置不存在\n请使用saytext=???添加配置`;
	}
	let updateSql = "";
	let message = "";
	switch (config) {
		case "name":
			const serverName = value as string;
			updateSql = `UPDATE serverSayConfig SET server_name = ? WHERE tag = ?`;
			message = `服务器名称: ${serverName}`;
			await db.execute(updateSql, [serverName, tag]);
			break;
		case "texts":
			const textJson = JSON.stringify(value as string[]);
			updateSql = `UPDATE serverSayConfig SET auto_say_json = ? WHERE tag = ?`;
			message = `播报内容: [${(value as string[]).join("\n")}]`;
			await db.execute(updateSql, [textJson, tag]);
			break;
		case "warm_text":
			const warmText = value as string;
			updateSql = `UPDATE serverSayConfig SET warm_say_text = ? WHERE tag = ?`;
			message = `暖服播报内容: ${warmText}`;
			await db.execute(updateSql, [warmText, tag]);
			break;
		case "interval":
			const interval = parseInt(value as string);
			updateSql = `UPDATE serverSayConfig SET auto_say_interval = ? WHERE tag = ?`;
			message = `自动播报间隔: ${interval}分钟`;
			await db.execute(updateSql, [interval, tag]);
			break;
		case "enable":
			const enable = parseInt(value as string);
			updateSql = `UPDATE serverSayConfig SET auto_say_enable = ? WHERE tag = ?`;
			message = `自动播报启用: ${enable === 1 ? "开启" : "关闭"}`;
			await db.execute(updateSql, [enable, tag]);
			break;
		default:
			message = `未知配置: ${config}\ntexts = [文本1][文本2][文本3]\nwarm_text = 暖服播报\ninterval = 播报间隔(分钟)\nenable = 播报启用(0:关闭, 1:开启)\nname = 服务器名称\nconfig命令查看详细配置`;
	}
	await db.close();
	return `服务器${tag}播报配置更新\n${message}`;
}

/** 删除配置 */
export async function deleteServerSayConfig(tag: string, group_id: number): Promise<string> {
	// 查看是否已存在该配置
	const db = new SQLiteDB(url, createTableSql);
	await db.open();
	const sql = `SELECT * FROM serverSayConfig WHERE tag = ?`;
	const configList = await db.query(sql, [tag]);
	if (configList.length === 0) {
		return `服务器${tag}播报配置不存在`;
	}
	const deleteSql = `DELETE FROM serverSayConfig WHERE tag = ?`;
	await db.execute(deleteSql, [tag]);
	await db.close();
	return `服务器${tag}播报配置删除成功`;
}

/** 获取所有配置 */
export async function getServerSayConfig(): Promise<string> {
	const db = new SQLiteDB(url, createTableSql);
	await db.open();
	const sql = `SELECT * FROM serverSayConfig`;
	const result = await db.query(sql);
	await db.close();
	if (result.length === 0) {
		return "没有播报配置";
	}
	const message = result
		.map((config) => {
			const { tag, server_name, auto_say_json, warm_say_text, auto_say_interval, last_say_time, auto_say_enable } = config;
			const textList = JSON.parse(auto_say_json);
			return `服务器tag: ${tag}\n服务器名称: ${server_name}\n自动播报内容: [${textList.join("\n")}]\n暖服播报内容: ${warm_say_text}\n自动播报间隔: ${auto_say_interval}分钟\n自动播报启用: ${
				auto_say_enable === 1 ? "开启" : "关闭"
			}\n最后播报时间: ${new Date(last_say_time).toLocaleString()}\n`;
		})
		.join("\n");
	return message;
}
