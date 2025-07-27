import axios, { AxiosError } from "axios";
import { SQLiteDB } from "../utils/sqlite";
import path from "path";
import { getTag } from "../qq/cookieManager";
import logger from "../utils/logger";
import { eaAxios, updateEAInstance } from "../utils/axios";
import { sendMsgToQQFriend } from "../qq/sendMessage";

const url = path.join(process.cwd(), "data", "cookies.db");
const createTableSql = `CREATE TABLE IF NOT EXISTS sessions (
    tag TEXT NOT NULL,
    session TEXT NOT NULL
)`;

export const queryTag = "EA查询";

// 当前模块是否可用
let isAvailable = true;
// 是否在更新session
let isUpdatingSession = false;

// session更新次数
let sessionUpdateCount = 0;
// 最大更新次数
const maxSessionUpdateCount = 3;

// 请求队列
const requestQueue: eaTask[] = [];
// 请求间隔
const requestInterval = 1; // 1秒

interface eaTask {
	method: string;
	params: any;
	resolve: (value: any) => void;
	reject: (reason: any) => void;
}

// 统一控制所有请求
export function initEeAxiosManager() {
	if (isUpdatingSession) {
		return;
	}
	const handleRequest = async () => {
		if (sessionUpdateCount >= maxSessionUpdateCount && isAvailable) {
			isAvailable = false;
			sessionExpireReminder();
			return;
		}
		let waitTime = requestInterval;
		if (isAvailable && requestQueue.length > 0) {
			const task = requestQueue[0];
			try {
				const res = await eaAxios().post("", {
					jsonrpc: "2.0",
					method: task.method,
					params: task.params
				});
				sessionUpdateCount = 0;
				requestQueue.shift();
				task.resolve(res.data.result);
			} catch (err) {
				const error = (err as any).response;
				if (error === undefined) {
					logger.error(`请求EA失败: ${task.method}, ${err}`);
					task.reject(err);
				} else {
					const errMsg = error.data.error.message;
					logger.error(`请求EA失败: ${task.method}, ${errMsg}`);
					// task.reject(errMsg);
					if (errMsg === "Invalid Params: no valid session") {
						logger.info("EA查服的Session失效, 正在更新...");
						sessionUpdateCount++;
						isUpdatingSession = true;
						waitTime = 20;
						await updateSession(); // 确保等待updateSession完成
					}
				}
			}
		}
		setTimeout(() => {
			initEeAxiosManager();
		}, waitTime * 1000);
	};
	handleRequest();
}

/** 添加查询服务器到队列 */
export function addQueryServer(name: string): Promise<any> {
	return new Promise((resolve, reject) => {
		requestQueue.push({
			method: "GameServer.searchServers",
			params: {
				game: "casablanca",
				filterJson: JSON.stringify({
					name: name
				})
			},
			resolve,
			reject
		});
	});
}

/** 添加查询服务器详细信息到队列 */
export function addQueryServerDetail(gameId: number): Promise<any> {
	return new Promise((resolve, reject) => {
		requestQueue.push({
			method: "GameServer.getServerDetails",
			params: {
				game: "casablanca",
				gameId: gameId
			},
			resolve,
			reject
		});
	});
}

/** 添加查询玩家生涯信息到队列 */
export function addQueryPlayerLife(personaId: number): Promise<any> {
	return new Promise((resolve, reject) => {
		requestQueue.push({
			method: "Stats.detailedStatsByPersonaId",
			params: {
				game: "casablanca",
				personaId: personaId
			},
			resolve,
			reject
		});
	});
}

/** 添加查询玩家详细武器数据到队列 */
export function addPlayerWeaponDetail(personaId: number): Promise<any> {
	return new Promise((resolve, reject) => {
		requestQueue.push({
			method: "Progression.getWeaponsByPersonaId",
			params: {
				game: "casablanca",
				personaId: personaId
			},
			resolve,
			reject
		});
	});
}

/** 添加查询玩家详细载具数据到队列 */
export function addPlayerVehicleDetail(personaId: number): Promise<any> {
	return new Promise((resolve, reject) => {
		requestQueue.push({
			method: "Progression.getVehiclesByPersonaId",
			params: {
				game: "casablanca",
				personaId: personaId
			},
			resolve,
			reject
		});
	});
}

/** 更新Session */
export async function updateSession(): Promise<void> {
	const result = await getTag(queryTag);
	if (result.length === 0) {
		logger.error("未找到EA查服的Cookie, 请先对一个账号进行main操作");
		return;
	}
	const newSession = await createSession(result[0].sid);
	if (!newSession) {
		logger.error("Session合成失败, 请检查网络连接或Cookie是否失效");
		return;
	}
	const db = new SQLiteDB(url, createTableSql);
	await db.open();
	await db.execute("UPDATE sessions SET session = ? WHERE tag = ?", [newSession, queryTag]);
	await db.close();
	sessionUpdateCount++;
	updateEAInstance(newSession);
	// 故障修复重启循环
	if (!isAvailable) {
		isAvailable = true;
		sessionUpdateCount = 0;
		initEeAxiosManager();
	}
	logger.info("EA查服的Session更新成功");
	isUpdatingSession = false;
}

/** 初始化Session */
export async function initEaManger(): Promise<void> {
	const db = new SQLiteDB(url, createTableSql);
	await db.open();
	// 是否有session缓存
	const sessionResult = await db.query("SELECT session FROM sessions WHERE tag = ?", [queryTag]);
	let session = "";
	logger.info("正在初始化EA查服的Session...");
	if (sessionResult.length === 0) {
		const result = await getTag(queryTag);
		if (result.length === 0) {
			logger.error("未找到EA查服的Cookie, 请先对一个账号进行main操作");
			return;
		}
		logger.info("未找到EA查服的Session, 正在创建...");
		const newSession = await createSession(result[0].sid);
		await db.execute("INSERT INTO sessions (tag, session) VALUES (?, ?)", [queryTag, newSession]);
		session = newSession;
		logger.info("创建EA查服的Session成功");
	} else {
		logger.info("正在读取缓存...");
		session = sessionResult[0].session;
	}
	await db.close();
	updateEAInstance(session);
	logger.info("EA查服的Session初始化完成");
	// 启动请求队列
	initEeAxiosManager();
}

/** 合成Session */
async function createSession(sid: string): Promise<string> {
	const res = await axios.get(`https://ea-account.bfvrobot.net/api/worker/tools/getAccountInfo?remid=remid&sid=${sid}`);
	return res.data["X-GatewaySession"];
}

/** Session过期提醒 */
async function sessionExpireReminder(): Promise<void> {
	const result = await getTag(queryTag);
	if (result.length === 0) {
		logger.error("未找到EA查服的Cookie, 请先对一个账号进行main操作");
		return;
	}
	logger.error("EA查服的Session更新次数过多, 请检查网络连接或Cookie是否失效");
	sendMsgToQQFriend("EA查服的Session失效, 请更新[EA查服]账号的Cookie-sid", result[0].user_id);
}
