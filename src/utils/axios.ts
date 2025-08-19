import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";
import https from "https";
import { readConfigFile } from "./localFile";

let qqInstance: AxiosInstance;
/** 获取HttpQQ机器人API实例 */
export function qqAxios(): AxiosInstance {
	if (!qqInstance) {
		qqInstance = createQQInstance();
	}
	return qqInstance;
}

let bfvInstance: AxiosInstance;
/** 获取HttpBFV社区API实例 */
export function bfvAxios(): AxiosInstance {
	if (!bfvInstance) {
		bfvInstance = createBFVInstance();
	}
	return bfvInstance;
}

let bfbanInstance: AxiosInstance;
/** 获取HttpBFBan社区API实例 */
export function bfbanAxios(): AxiosInstance {
	if (!bfbanInstance) {
		bfbanInstance = createBFBanInstance();
	}
	return bfbanInstance;
}

let gtInstance: AxiosInstance;
/** 获取HttpGameTools社区API实例 */
export function gtAxios(): AxiosInstance {
	if (!gtInstance) {
		gtInstance = createGTInstance();
	}
	return gtInstance;
}

let eaInstance: AxiosInstance;
/** 获取HttpEA社区API实例 */
export function eaAxios(): AxiosInstance {
	if (!eaInstance) {
		eaInstance = createEAInstance();
	}
	return eaInstance;
}

let statusInstance: AxiosInstance;
/** 获取玩家战绩查询API实例 */
export function statusAxios(): AxiosInstance {
	if (!statusInstance) {
		statusInstance = createStatusInstance();
	}
	return statusInstance;
}

// 创建HttpNapcat实例
function createQQInstance(): AxiosInstance {
	const config = readConfigFile();
	const instance = axios.create({
		baseURL: "http://" + config.http_ip + "/",
		headers: {
			"Content-Type": "application/json",
			Authorization: "Bearer " + config.http_token
		}
	});
	return instance;
}

// 玩家战绩查询服务端API
function createStatusInstance(): AxiosInstance {
	const { status_ip } = readConfigFile();
	const instance = axios.create({
		baseURL: `http://${status_ip}/`,
		headers: {
			"Content-Type": "application/json"
		},
		timeout: 10000
	});
	return instance;
}

// 创建HttpBFV实例
let bfvBaseURL: string = "https://api.bfvrobot.net/api/";
function createBFVInstance(): AxiosInstance {
	const instance = axios.create({
		baseURL: bfvBaseURL,
		headers: {
			"Content-Type": "application/json"
		},
		timeout: 10000
	});
	return instance;
}

// 创建HttpEA实例
let eaBaseURL: string = "https://sparta-gw-bfv.battlelog.com/jsonrpc/pc/api";
function createEAInstance(): AxiosInstance {
	const instance = axios.create({
		baseURL: eaBaseURL,
		headers: {
			"Content-Type": "application/json",
			"X-Gatewaysession": ""
		},
		timeout: 6000
	});
	return instance;
}

// 创建HttpBFBan实例
let bfbanBaseURL: string = "https://api.bfban.com/api/";
function createBFBanInstance(): AxiosInstance {
	const instance = axios.create({
		baseURL: bfbanBaseURL,
		headers: {
			"Content-Type": "application/json"
		},
		timeout: 10000
	});
	return instance;
}

// 创建HttpGameTools实例
let gtBaseURL: string = "https://api.gametools.network/";
function createGTInstance(): AxiosInstance {
	// 创建自定义的 https.Agent，设置 maxSockets 来控制连接池的大小
	const agent = new https.Agent({
		keepAlive: true,
		maxSockets: 10 // 设置连接池中最大 socket 数量
	});

	const instance = axios.create({
		baseURL: gtBaseURL,
		headers: {
			"Content-Type": "application/json"
		},
		timeout: 10000,
		httpsAgent: agent // 使用自定义的 https.Agent
	});
	return instance;
}

/** 更新HttpEA实例 */
export function updateEAInstance(session: string) {
	eaInstance = axios.create({
		baseURL: eaBaseURL,
		headers: {
			"Content-Type": "application/json",
			"X-Gatewaysession": session
		},
		timeout: 6000
	});
}

/** aihttp请求 */
let aiInstance: AxiosInstance;
export function aiAxios(): AxiosInstance {
	if (!aiInstance) {
		aiInstance = createAIInstance();
	}
	return aiInstance;
}
function createAIInstance(): AxiosInstance {
	const config = readConfigFile();
	const instance = axios.create({
		baseURL: "https://api.siliconflow.cn/v1/chat/completions",
		headers: {
			"Content-Type": "application/json",
			Authorization: "Bearer " + config.ai_tooken
		},
		timeout: 10000
	});
	return instance;
}
