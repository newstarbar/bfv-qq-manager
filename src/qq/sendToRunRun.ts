import { PlayerLife } from "../interface/player";
import { ServerAdmin, ServerConfig } from "../interface/ServerInfo";
import { addServerToMainLoop } from "../robot/serverManager";
import { readConfigFile } from "../utils/localFile";
import logger from "../utils/logger";
import { sendMsgToQQFriend, sendMsgToQQGroup } from "./sendMessage";

const runrun_qq: number = 2854211804;
const tvbot_qq: number = 3889013937;

let cmdList: string[][] = [];

// 当前是否在运行中
let isRunning = false;
// 上一次执行时间
let lastExecuteTime = 0;
// 超过2分钟强制取消运行中
const forceCancelTime = 2 * 60 * 1000;

// 开服相关的临时变量
let startServerTemp = {
	config: null as any | null,
	group_id: null as number | null,
	message_id: null as number | null,
	count: 0
};
// 最大开服次数
const maxStartServerCount = 5;

// 踢人屏蔽玩家相关的临时变量
let banPlayerTemp = {
	gameId: null as number | null,
	playerLife: null as PlayerLife | null,
	joinTime: null as number | null,
	reason: null as string | null,
	config: null as ServerConfig | null,
	admin: null as ServerAdmin | null,
	isReport: null as boolean | null,
	isRobotKick: null as boolean | null
};
let isUnbanPlayer = false;

// 踢人失败次数
let kickFailCount = 0;

/** 初始化启动命令定时器 */
export const initCmdManager = () => {
	logger.info("初始化启动命令定时器");
	setInterval(sendToRunRun, 1000);
};

/** 发送命令到 RunRun管理器类 */
export async function sendToRunRun(): Promise<void> {
	if (isRunning && new Date().getTime() - lastExecuteTime > forceCancelTime) {
		isRunning = false;
		logger.info("命令模块长时间未执行，已强制取消运行中");
	}

	if (!isRunning && cmdList.length > 0) {
		isRunning = true;
		lastExecuteTime = new Date().getTime();
		const cmd = cmdList[0][0];
		const target = cmdList[0][1];
		const type = cmdList[0][2];

		if (target === "runrun") {
			sendMsgToQQFriend(cmd, runrun_qq);
		} else if (target === "tvbot") {
			sendMsgToQQFriend(cmd, tvbot_qq);
		}
	}
}

/** 发送开服指令 */
export async function sendStartServerCmd(config: any, group_id: number, message_id: number): Promise<void> {
	startServerTemp.config = config;
	startServerTemp.group_id = group_id;
	startServerTemp.message_id = message_id;

	const cmd = `/createServer ${config.id}`;
	cmdList.push([cmd, "runrun", "startServer"]);
}

/** 重置开服配置 */
function resetConfig(): void {
	startServerTemp.config = null;
	startServerTemp.group_id = null;
	startServerTemp.message_id = null;
	startServerTemp.count = 0;
}

/** 重置踢人配置 */
function resetBanPlayerConfig(): void {
	banPlayerTemp.gameId = null;
	banPlayerTemp.playerLife = null;
	banPlayerTemp.joinTime = null;
	banPlayerTemp.reason = null;
	banPlayerTemp.config = null;
	banPlayerTemp.admin = null;
	banPlayerTemp.isReport = null;
	banPlayerTemp.isRobotKick = null;
}

/** 发送屏蔽玩家指令 */
export async function sendBanPlayerCmd(gameId: number, playerLifeData: PlayerLife, joinTime: number, reason: string, config: ServerConfig, admin: ServerAdmin, isReport: boolean): Promise<void> {
	// 数据保存
	banPlayerTemp.gameId = gameId;
	banPlayerTemp.playerLife = playerLifeData;
	banPlayerTemp.joinTime = joinTime;
	banPlayerTemp.reason = reason;
	banPlayerTemp.config = config;
	banPlayerTemp.admin = admin;
	banPlayerTemp.isReport = isReport;
	banPlayerTemp.isRobotKick = false;

	const isTV = config.tv;
	let cmd: string;
	if (isTV) {
		const { group_name: groupName } = await readConfigFile();
		cmd = `/tb ${groupName} ${playerLifeData.name} ${reason}`;
		cmdList.push([cmd, "tvbot", "tvban"]);
	} else {
		cmd = `/ban ${playerLifeData.name} ${reason}`;
		cmdList.push([cmd, "runrun", "robotban"]);
	}
}

/** 发送踢出玩家指令 */
export async function sendKickPlayerCmd(gameId: number, playerLifeData: PlayerLife, joinTime: number, reason: string, config: ServerConfig, admin: ServerAdmin, isReport: boolean): Promise<void> {
	// 数据保存
	banPlayerTemp.gameId = gameId;
	banPlayerTemp.playerLife = playerLifeData;
	banPlayerTemp.joinTime = joinTime;
	banPlayerTemp.reason = reason;
	banPlayerTemp.config = config;
	banPlayerTemp.admin = admin;
	banPlayerTemp.isReport = isReport;

	const isTV = config.tv;
	let cmd: string;
	if (isTV) {
		cmd = `/kick ${playerLifeData.name} ${reason}`;
		cmdList.push([cmd, "tvbot", "tvkick"]);
		banPlayerTemp.isRobotKick = false;
	} else {
		cmd = `/ban ${playerLifeData.name} ${reason}`;
		const unbanCmd = `/unban ${playerLifeData.name} ${gameId}`;
		banPlayerTemp.isRobotKick = true;
		cmdList.push([cmd, "runrun", "robotkick"]);
		cmdList.push([unbanCmd, "runrun", "robotunban"]);
	}
}

/** 发送解除屏蔽指令 */
export async function sendUnBanPlayerCmd(gameId: number, playerName: string, config: ServerConfig, admin: ServerAdmin, isReport: boolean = true): Promise<void> {
	// 数据保存
	banPlayerTemp.playerLife = { name: playerName } as any;
	banPlayerTemp.gameId = gameId;
	banPlayerTemp.config = config;
	banPlayerTemp.admin = admin;
	banPlayerTemp.isReport = isReport;
	isUnbanPlayer = true;

	const isTV = config.tv;
	let cmd: string;
	if (isTV) {
		const { group_name: groupName } = await readConfigFile();
		cmd = `/unban ${groupName} ${playerName}`;
		cmdList.push([cmd, "tvbot", "tvunban"]);
	} else {
		cmd = `/unban ${playerName} ${gameId}`;
		cmdList.push([cmd, "runrun", "robotunban"]);
	}
}

/** 接收反馈消息 */
export function onRunRunMsg(msg: string) {
	if (isRunning) {
		if (msg.includes("服务器创建成功")) {
			onServerCreateEvent();
		} else if (msg.includes("在处理过程中出现显式错误")) {
			onServerCreateFailedEvent();
		} else if (msg.includes("解除屏蔽玩家")) {
			onUnBanPlayerSuccessEvent();
		} else if (msg.includes("屏蔽玩家") || msg.includes("封禁玩家")) {
			onBanPlayerSuccessEvent();
		} else if (msg.includes("未找到玩家所在的服务器")) {
			onBanPlayerNotFoundEvent();
		} else if (msg.includes("未找到玩家信息")) {
			onBanPlayerNotFoundInfoEvent();
		} else if (msg.includes("你没有对应服务器的操作权限")) {
			onBanPlayerNoPermissionEvent();
		} else if (msg.includes("发生未知错误")) {
		}
	}
}

/** 接收反馈信息 */
export function onTvBotMsg(msg: string) {
	if (isRunning) {
		if (msg.includes("封禁玩家") || msg.includes("已踢出玩家")) {
			onBanPlayerSuccessEvent();
		} else if (msg.includes("玩家不在游戏中")) {
			onBanPlayerNotFoundEvent();
		} else if (msg.includes("未知错误")) {
			cmdList.shift();
			isRunning = false;
		} else {
			cmdList.shift();
			isRunning = false;
		}
	}
}

/** 服务器创建成功 消息接收事件 */
function onServerCreateEvent() {
	if (startServerTemp.group_id && startServerTemp.message_id) {
		sendMsgToQQGroup(
			startServerTemp.group_id,
			`========开服模块========\n序号: ${startServerTemp.config.tag}\n服名: ${startServerTemp.config.zh_name}\n计划开服次数: ${maxStartServerCount}次\n失败次数: ${startServerTemp.count}次\n\n【开启服务器成功】\n======================`,
			startServerTemp.message_id
		);
	}
	isRunning = false;
	cmdList.shift();
	const configCopy = JSON.parse(JSON.stringify(startServerTemp.config));
	resetConfig();
	// 加入主循环
	setTimeout(() => {
		addServerToMainLoop(configCopy);
	}, 10000);
}

/** 服务器创建失败 消息接收事件 */
function onServerCreateFailedEvent() {
	if (startServerTemp.count > maxStartServerCount) {
		cmdList.shift();
		if (startServerTemp.group_id && startServerTemp.message_id) {
			sendMsgToQQGroup(
				startServerTemp.group_id,
				`========开服模块========\n序号: ${startServerTemp.config.tag}\n服名: ${startServerTemp.config.zh_name}\n计划开服次数: ${maxStartServerCount}次\n失败次数: ${startServerTemp.count}次\n\n【开启服务器失败,请重试】\n======================`,
				startServerTemp.message_id
			);
		}
		resetConfig();
		isRunning = false;
		return;
	}
	startServerTemp.count++;
	isRunning = false;
}

/** 屏蔽玩家成功 消息接收事件 */
function onBanPlayerSuccessEvent() {
	cmdList.shift();
	if (banPlayerTemp.isRobotKick) {
		isRunning = false;
		return;
	}
	if (banPlayerTemp.isReport) {
		const group_id = banPlayerTemp.config?.group_id;
		let serverName = banPlayerTemp.config?.zh_name;
		serverName = serverName?.replace("[MINI ROBOT]", "").replace("[mini robot]", "");

		const playerName = banPlayerTemp.playerLife?.name;
		const playerLevel = banPlayerTemp.playerLife?.level;
		const playerKD = banPlayerTemp.playerLife?.kd;
		const playerKPM = banPlayerTemp.playerLife?.kpm;
		const joinTime = banPlayerTemp.joinTime;
		const reason = banPlayerTemp.reason;
		const adminName = banPlayerTemp.admin?.name;

		logger.debug(`[${serverName}] ${playerName} 被 ${adminName} 屏蔽, 原因: ${reason}`);
		// 游玩时长
		let playTimeStr = "";
		if (joinTime && joinTime > 0) {
			const nowTimeStamp = new Date().getTime();
			const joinTimeStamp = joinTime / 1000;
			const playedTime = (nowTimeStamp - joinTimeStamp) / 1000 / 60;
			if (playedTime > 1000) {
				playTimeStr = "0";
			} else {
				playTimeStr = playedTime.toFixed(1);
			}
		} else {
			playTimeStr = "未知";
		}
		const playerLevelStr = playerLevel == -1 ? "未知" : playerLevel;
		const playerKDStr = playerKD == -1 ? "未知" : playerKD;
		const playerKPMStr = playerKPM == -1 ? "未知" : playerKPM;

		sendMsgToQQGroup(
			group_id as number,
			`========屏蔽模块========\n【服名】: ${serverName}\n--------------------------------\n等级: ${playerLevelStr}     时长: ${playTimeStr} 分钟\nK/D:    ${playerKDStr}  KPM:  ${playerKPMStr}\n--------------------------------\n【玩家】: ${playerName}\n【原因】: ${reason}\n【处理人】: ${adminName}\n\n屏蔽玩家成功\n======================`,
			null
		);
	}
	kickFailCount = 0;
	resetBanPlayerConfig();
	isRunning = false;
}

/** 屏蔽玩家失败-> 未找到玩家所在的服务器 消息接收事件 */
function onBanPlayerNotFoundEvent() {
	kickFailCount++;
	if (kickFailCount > 1) {
		if (banPlayerTemp.isReport) {
			const group_id = banPlayerTemp.config?.group_id;
			let serverName = banPlayerTemp.config?.zh_name;
			serverName = serverName?.replace("[MINI ROBOT]", "").replace("[mini robot]", "");

			const playerName = banPlayerTemp.playerLife?.name;
			const reason = banPlayerTemp.reason;

			sendMsgToQQGroup(group_id as number, `【玩家】: ${playerName}\n【原因】: ${reason}\n\n【屏蔽玩家失败】\n原因: 未找到玩家所在的服务器\n多次屏蔽失败, 已取消屏蔽`, null);
		}
		kickFailCount = 0;
		cmdList.shift();
		// 是否是踢人失败
		if (banPlayerTemp.isRobotKick) {
			cmdList.shift();
		}

		resetBanPlayerConfig();
		isRunning = false;
		return;
	}
	isRunning = false;
}

/** 屏蔽玩家失败-> 未找到玩家信息 消息接收事件 */
function onBanPlayerNotFoundInfoEvent() {
	if (banPlayerTemp.isReport) {
		const group_id = banPlayerTemp.config?.group_id;
		let serverName = banPlayerTemp.config?.zh_name;
		serverName = serverName?.replace("[MINI ROBOT]", "").replace("[mini robot]", "");

		const playerName = banPlayerTemp.playerLife?.name;
		const reason = banPlayerTemp.reason;

		sendMsgToQQGroup(
			group_id as number,
			`========屏蔽模块========\n【服名】: ${serverName}\n\n【玩家】: ${playerName}\n【原因】: ${reason}\n\n【屏蔽玩家失败】\n\n原因: 未找到玩家信息\n ======================`,
			null
		);
	}
	cmdList.shift();
	resetBanPlayerConfig();
	isRunning = false;
}

/** 屏蔽玩家失败-> 你没有对应服务器的操作权限 消息接收事件 */
function onBanPlayerNoPermissionEvent() {
	if (banPlayerTemp.isReport) {
		const group_id = banPlayerTemp.config?.group_id;
		let serverName = banPlayerTemp.config?.zh_name;
		serverName = serverName?.replace("[MINI ROBOT]", "").replace("[mini robot]", "");

		const playerName = banPlayerTemp.playerLife?.name;
		const reason = banPlayerTemp.reason;

		sendMsgToQQGroup(
			group_id as number,
			`========屏蔽模块========\n【服名】: ${serverName}\n\n【玩家】: ${playerName}\n【原因】: ${reason}\n\n【屏蔽玩家失败】\n\n原因: 没有对应服务器的操作权限\n ======================`,
			null
		);
	}
	cmdList.shift();
	resetBanPlayerConfig();
	isRunning = false;
}

/** 解除屏蔽玩家成功 消息接收事件 */
function onUnBanPlayerSuccessEvent() {
	if (!isUnbanPlayer) {
		// 社区服务器踢出玩家，只能先屏蔽后解除屏蔽
		if (banPlayerTemp.isReport) {
			const group_id = banPlayerTemp.config?.group_id;
			let serverName = banPlayerTemp.config?.zh_name;
			serverName = serverName?.replace("[MINI ROBOT]", "").replace("[mini robot]", "");

			const playerName = banPlayerTemp.playerLife?.name;
			const playerLevel = banPlayerTemp.playerLife?.level;
			const playerKD = banPlayerTemp.playerLife?.kd;
			const playerKPM = banPlayerTemp.playerLife?.kpm;
			const joinTime = banPlayerTemp.playerLife?.timePlayed;
			const reason = banPlayerTemp.reason;
			const adminName = banPlayerTemp.admin?.name;

			// 游玩时长
			let playTimeStr = "";
			if (joinTime && joinTime > 0) {
				const nowTimeStamp = new Date().getTime();
				const joinTimeStamp = joinTime / 1000;
				const playedTime = (nowTimeStamp - joinTimeStamp) / 1000 / 60;
				if (playedTime > 1000) {
					playTimeStr = "0";
				} else {
					playTimeStr = playedTime.toFixed(1);
				}
			} else {
				playTimeStr = "未知";
			}
			const playerLevelStr = playerLevel == -1 ? "未知" : playerLevel;
			const playerKDStr = playerKD == -1 ? "未知" : playerKD;
			const playerKPMStr = playerKPM == -1 ? "未知" : playerKPM;

			sendMsgToQQGroup(
				group_id as number,
				`========踢人模块========\n【服名】: ${serverName}\n--------------------------------\n等级: ${playerLevelStr}     时长: ${playTimeStr} 分钟\nK / D: ${playerKDStr}   KPM: ${playerKPMStr}\n--------------------------------\n【玩家】: ${playerName}\n【原因】: ${reason}\n【处理人】: ${adminName}\n\n【踢出玩家成功】======================`,
				null
			);
		}
		cmdList.shift();
		resetBanPlayerConfig();
		isRunning = false;
	} else {
		// 管理员手动解除屏蔽
		cmdList.shift();
		if (banPlayerTemp.isReport) {
			const group_id = banPlayerTemp.config?.group_id;
			let serverName = banPlayerTemp.config?.zh_name;
			serverName = serverName?.replace("[MINI ROBOT]", "").replace("[mini robot]", "");

			const playerName = banPlayerTemp.playerLife?.name;
			const adminName = banPlayerTemp.admin?.name;

			sendMsgToQQGroup(
				group_id as number,
				`========屏蔽模块========\n【服名】: ${serverName}\n\n【玩家】: ${playerName}\n【处理人】: ${adminName}\n\n【解除屏蔽玩家成功】\n======================`,
				null
			);
		}
		resetBanPlayerConfig();
		isUnbanPlayer = false;
		isRunning = false;
	}
}
