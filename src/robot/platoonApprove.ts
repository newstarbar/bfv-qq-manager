import path from "path";
import { SQLiteDB } from "../utils/sqlite";
import { getTag, setTag } from "../qq/cookieManager";
import { eaAxios } from "../utils/axios";
import axios, { AxiosError } from "axios";
import { isPlayerNameExist } from "./cx/basePlayerQuery";
import { queryTag } from "./eaApiManger";
import logger from "../utils/logger";

const url = path.join(process.cwd(), "data", "platoon.db");
const createTableSql = `CREATE TABLE IF NOT EXISTS platoon (
    tag TEXT NOT NULL,
    guid TEXT NOT NULL
)`;

const sessionUrl = path.join(process.cwd(), "data", "cookies.db");
const createSessionTableSql = `CREATE TABLE IF NOT EXISTS sessions (
    tag TEXT NOT NULL,
    session TEXT NOT NULL
)`;

/** 注册战排 */
export async function registerPlatoon(playerName: string, tag: string): Promise<string> {
	const result = await isPlayerNameExist(playerName);
	if (typeof result !== "string") {
		const personaId = result.personaId;
		const db = new SQLiteDB(sessionUrl, createSessionTableSql);
		await db.open();
		const sql = `SELECT * FROM sessions WHERE tag = ?`;
		const sessionResult = await db.query(sql, [queryTag]);
		if (sessionResult.length === 0) {
			return `EA查询的cookie未设置\n请先设置EA查询的cookie`;
		}
		const session = sessionResult[0].session;
		try {
			const res = await eaAxios().post("", {
				jsonrpc: "2.0",
				method: "Platoons.getPlatoons",
				params: {
					game: "casablanca",
					personaId: personaId
				},
				Headers: {
					"Content-Type": "application/json",
					"X-Gatewaysession": session
				}
			});
			const data = res.data;
			let message = `没有在${playerName}中查询到${tag}战排\n请检查战排名称、玩家名是否正确`;
			for (let i = 0; i < data.result.length; i++) {
				const platoon = data.result[i];
				if (platoon.tag === tag) {
					const db = new SQLiteDB(url, createTableSql);
					await db.open();

					const insertSql = `INSERT INTO platoon (tag, guid) VALUES (?,?)`;
					const insertParams = [tag, platoon.guid];
					await db.execute(insertSql, insertParams);
					message = `注册成功\n战排名称: ${platoon.name}\n简称: ${platoon.tag}\n战排ID: ${platoon.guid}`;
					setTag(result.name, tag);
					break;
				}
			}
			return message;
		} catch (e) {
			const error = (e as any).response;
			const errMsg = error.data.error.message;
			if (errMsg === "Invalid Params: no valid session") {
				return `EA查询的session已过期\n请重新设置`;
			}
			return `未知错误\n${errMsg}`;
		}
	} else {
		return result;
	}
}

/** 查看所有成员 */
export async function getAllMember(name: string): Promise<string> {
	const db = new SQLiteDB(url, createTableSql);
	await db.open();
	const result = await db.query(`SELECT * FROM platoon WHERE tag = ?`, [name]);
	if (result.length === 0) {
		return `战排:${name}未注册\n请先使用platoon注册战排`;
	}
	const guid = result[0].guid;
	const tag = result[0].tag;

	const cookie = await getTag(tag);
	if (cookie.length === 0) {
		return `战排:${name}的将军\n未绑定cookie\n请先绑定战排持有人的sid`;
	}

	if (cookie[0].is_valid === 0) {
		return `战排:${name}的将军\ncookie已过期\n请重新绑定`;
	}
	const session = await getAndUpdateSession(tag, cookie[0].sid);
	try {
		const res = await eaAxios().post(
			"",
			{
				jsonrpc: "2.0",
				method: "Platoons.getMembers",
				params: {
					game: "casablanca",
					guid: guid,
					pageIndex: 0,
					pageSize: 100
				}
			},
			{
				headers: {
					"Content-Type": "application/json",
					"X-Gatewaysession": session
				}
			}
		);
		const data = res.data;
		let message = "";
		data.result.forEach((member: any) => {
			message += `${member.displayName}{${member.role.slice(4)}}\n[${member.personaId}]\n`;
		});
		return message;
	} catch (e) {
		const error = e as AxiosError;
		const errData = error.response?.data as any;
		logger.error(errData);
		const errCode = errData.error.code;
		if (errCode === -32501) {
			const sessionRes = await updateSession(tag, cookie[0].sid);
			return `战排:${name}的将军\n的session已过期\n${sessionRes}`;
		}
		return `未知错误\n${errData.error.message}`;
	}
}

/** 获取申请列表 */
export async function getPlatoon(name: string): Promise<string> {
	const db = new SQLiteDB(url, createTableSql);
	await db.open();
	const result = await db.query(`SELECT * FROM platoon WHERE tag = ?`, [name]);
	if (result.length === 0) {
		return `战排:${name}未注册\n请先使用platoon注册战排`;
	}
	const guid = result[0].guid;
	const tag = result[0].tag;

	const cookie = await getTag(tag);
	if (cookie.length === 0) {
		return `战排:${name}的将军\n未绑定cookie\n请先绑定战排持有人的sid`;
	}

	if (cookie[0].is_valid === 0) {
		return `战排:${name}的将军\ncookie已过期\n请重新绑定`;
	}
	const session = await getAndUpdateSession(tag, cookie[0].sid);
	try {
		const res = await eaAxios().post(
			"",
			{
				jsonrpc: "2.0",
				method: "Platoons.listApplicants",
				params: {
					game: "casablanca",
					guid: guid,
					pageIndex: 0,
					pageSize: 100
				}
			},
			{
				headers: {
					"Content-Type": "application/json",
					"X-Gatewaysession": session
				}
			}
		);
		const data = res.data;

		let message = "";
		data.result.forEach((application: any) => {
			message += `申请人：${application.displayName}\n[${application.personaId}]\n`;
		});
		if (message == "") {
			message = "暂无申请";
		}
		return message;
	} catch (e) {
		const error = e as AxiosError;
		const errData = error.response?.data as any;
		logger.error(errData);
		const errCode = errData.error.code;
		if (errCode === -32501) {
			const sessionRes = await updateSession(tag, cookie[0].sid);
			return `战排:${name}的将军\n的session已过期\n${sessionRes}`;
		}
		return `未知错误\n${errData.error.message}`;
	}
}

/** 同意申请 */
export async function agreeApplication(tag: string, personaId: number): Promise<string> {
	const db = new SQLiteDB(url, createTableSql);
	await db.open();
	const result = await db.query(`SELECT * FROM platoon WHERE tag = ?`, [tag]);
	if (result.length === 0) {
		return `战排${tag}的将军\n未注册\n请先使用platoon注册战排`;
	}
	const guid = result[0].guid;
	const cookie = await getTag(tag);
	if (cookie.length === 0) {
		return `战排${tag}的将军\n未绑定cookie\n请先绑定战排持有人的sid`;
	}
	if (cookie[0].is_valid === 0) {
		return `战排${tag}的将军\ncookie已过期\n请重新绑定`;
	}
	const session = await getAndUpdateSession(tag, cookie[0].sid);
	logger.debug(`${tag} ${guid} ${personaId} ${cookie[0].sid} ${session}`);
	try {
		const res = await eaAxios().post(
			"",
			{
				jsonrpc: "2.0",
				method: "Platoons.acceptApplicant",
				params: {
					game: "casablanca",
					guid: guid,
					personaId: personaId
				}
			},
			{
				headers: {
					"Content-Type": "application/json",
					"X-Gatewaysession": session
				}
			}
		);
		const data = res.data;
		if (data.result.length === 0) {
			return `未查询到该申请人\n请检查personaId是否正确`;
		} else {
			return `操作成功\n已同意该玩家加入战排`;
		}
	} catch (e) {
		const error = e as AxiosError;
		const errData = error.response?.data as any;
		logger.error(errData);
		const errCode = errData.error.code;
		if (errCode === -32501) {
			const sessionRes = await updateSession(tag, cookie[0].sid);
			return `战排:${tag}的将军\n的session已过期\n${sessionRes}`;
		}
		return `未知错误\n${errData.error.message}`;
	}
}

/** 拒绝申请 */
export async function refuseApplication(tag: string, personaId: number): Promise<string> {
	const db = new SQLiteDB(url, createTableSql);
	await db.open();
	const result = await db.query(`SELECT * FROM platoon WHERE tag = ?`, [tag]);
	if (result.length === 0) {
		return `战排${tag}的将军\n未注册\n请先使用platoon注册战排`;
	}
	const guid = result[0].guid;
	const cookie = await getTag(tag);
	if (cookie.length === 0) {
		return `战排${tag}的将军\n未绑定cookie\n请先绑定战排持有人的sid`;
	}
	if (cookie[0].is_valid === 0) {
		return `战排${tag}的将军\ncookie已过期\n请重新绑定`;
	}
	const session = await getAndUpdateSession(tag, cookie[0].sid);
	try {
		const res = await eaAxios().post(
			"",
			{
				jsonrpc: "2.0",
				method: "Platoons.rejectApplicant",
				params: {
					game: "casablanca",
					guid: guid,
					personaId: personaId
				}
			},
			{
				headers: {
					"Content-Type": "application/json",
					"X-Gatewaysession": session
				}
			}
		);
		const data = res.data;
		if (data.result.length === 0) {
			return `未查询到该申请人\n请检查personaId是否正确`;
		} else {
			return `操作成功\n已拒绝该玩家的申请`;
		}
	} catch (e) {
		const error = e as AxiosError;
		const errData = error.response?.data as any;
		logger.error(errData);
		const errCode = errData.error.code;
		if (errCode === -32501) {
			const sessionRes = await updateSession(tag, cookie[0].sid);
			return `战排:${tag}的将军\n的session已过期\n${sessionRes}`;
		}
		return `未知错误\n${errData.error.message}`;
	}
}

/** 踢出成员 */
export async function kickMember(tag: string, personaId: number): Promise<string> {
	const db = new SQLiteDB(url, createTableSql);
	await db.open();
	const result = await db.query(`SELECT * FROM platoon WHERE tag = ?`, [tag]);
	if (result.length === 0) {
		return `战排${tag}的将军\n未注册\n请先使用platoon注册战排`;
	}
	const guid = result[0].guid;
	const cookie = await getTag(tag);
	if (cookie.length === 0) {
		return `战排${tag}的将军\n未绑定cookie\n请先绑定战排持有人的sid`;
	}
	if (cookie[0].is_valid === 0) {
		return `战排${tag}的将军\ncookie已过期\n请重新绑定`;
	}
	const session = await getAndUpdateSession(tag, cookie[0].sid);
	try {
		await eaAxios().post(
			"",
			{
				jsonrpc: "2.0",
				method: "Platoons.kickMember",
				params: {
					game: "casablanca",
					guid: guid,
					personaId: personaId
				}
			},
			{
				headers: {
					"Content-Type": "application/json",
					"X-Gatewaysession": session
				}
			}
		);
		return `操作成功\n已踢出成员`;
	} catch (e) {
		const error = e as AxiosError;
		const errData = error.response?.data as any;
		logger.error(errData);
		const errCode = errData.error.code;
		if (errCode === -32501) {
			const sessionRes = await updateSession(tag, cookie[0].sid);
			return `战排:${tag}的将军\n的session已过期\n${sessionRes}`;
		}
		return `未知错误\n${errData.error.message}`;
	}
}

/** 获取session */
async function getAndUpdateSession(tag: string, sid: string): Promise<string> {
	const db = new SQLiteDB(sessionUrl, createSessionTableSql);
	await db.open();
	const result = await db.query(`SELECT * FROM sessions WHERE tag = ?`, [tag]);
	let session = "";
	if (result.length === 0) {
		try {
			const res = await axios.get(`https://ea-account.bfvrobot.net/api/worker/tools/getAccountInfo?remid=remid&sid=${sid}`);
			session = res.data["X-GatewaySession"];
		} catch (e) {
			const error = (e as any).response;
			return `获取session失败\n${error.message}`;
		}
		await db.execute(`INSERT INTO sessions (tag, session) VALUES (?, ?)`, [tag, session]);
	} else {
		session = result[0].session;
	}
	await db.close();
	return session;
}

/** 更新session */
async function updateSession(tag: string, sid: string): Promise<string> {
	const db = new SQLiteDB(sessionUrl, createSessionTableSql);
	await db.open();
	const result = await db.query(`SELECT * FROM sessions WHERE tag = ?`, [tag]);
	if (result.length !== 0) {
		try {
			const res = await axios.get(`https://ea-account.bfvrobot.net/api/worker/tools/getAccountInfo?remid=remid&sid=${sid}`);
			const session = res.data["X-GatewaySession"];
			await db.execute(`UPDATE sessions SET session = ? WHERE tag = ?`, [session, tag]);
			return "更新session成功\n请重试";
		} catch (e) {
			logger.error(`更新session失败`);
			return `更新session失败\n${e}`;
		}
	}
	return "未查询到对应的cookie";
	await db.close();
}
