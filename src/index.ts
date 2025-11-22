import { readConfigFile } from "./utils/localFile";
import logger from "./utils/logger";
import express from "express";
import { WebSocket } from "ws";
import { sendMsgToQQGroup, sendMsgToQQGroupWithAI } from "./qq/sendMessage";
import { commandManager, getAllInitGroup, isGroupInit } from "./command/commandManger";
import { initEaManger } from "./robot/eaApiManger";
import { initServerRestart, startServerLoop } from "./robot/serverManager";
import { initCmdManager } from "./qq/sendToRunRun";
import { handleGroupRequest } from "./qq/groupRequest";
import { deleteMemberInfo, getMemberInfo } from "./qq/memberManager";
import { initSayTimer } from "./robot/serverSayManager";
import { aiManagers, initAiManager } from "./qq/aiSay/aiManager";
import { initTimeManager } from "./qq/timeManager";
import { initSettlementTimer } from "./robot/player/settlement";
import { getVersion } from "./utils/version";
import { banPlayerCommand, kickPlayerCommand } from "./command/admin1/banPlayer";

getVersion();

// 连接ws和http状态
const { ws_ip, ws_token, bot_qq, bot_name, status_token } = readConfigFile();
const ws: WebSocket = new WebSocket(`ws://${ws_ip}/`, {
	headers: {
		Authorization: `Bearer ${ws_token}`
	}
});

ws.on("open", () => {
	logger.info("WS 已连接");
});

ws.on("message", async (data) => {
	const e: any = JSON.parse(data.toString());
	if (e.message === "token验证失败") {
		logger.error("WS 验证失败, 请检查token是否正确\n请确认config.json中的ws_token是否正确");
	} else {
		switch (e.post_type) {
			case "meta_event":
				if (e.meta_event_type === "lifecycle") {
					setTimeout(async () => {
						// 初始EA查服Session
						await initEaManger();
						// 初始化服管主循环
						await initServerRestart();
						// 启动服管主循环
						startServerLoop();
						// 初始化QQ命令管理器
						initCmdManager();
						// 注册服务器播报定时器
						initSayTimer();
						// 注册玩家结算定时器
						initSettlementTimer();
						// 注册ai聊天
						const allGroups = await getAllInitGroup();
						for (const group of allGroups) {
							await initAiManager(group, bot_name, bot_qq);
						}
						// 注册时间模块
						initTimeManager();
					}, 500);
				} else if (e.meta_event_type === "heartbeat") {
					// logger.info(`WebSocket 心跳包:online:${e.status.online},good:${e.status.good}`);
				}
				break;
			case "message":
				// logger.info(`${JSON.stringify(e)}`)
				commandManager(e);
				break;
			case "notice":
				// 主动退群
				if (e.notice_type == "group_decrease" && e.sub_type == "leave") {
					// 查看是否是注册过的群
					const isInit = await isGroupInit(e.group_id);
					if (isInit) {
						// 处理退群
						const playerData = await getMemberInfo(e.group_id, e.user_id, null);
						sendMsgToQQGroup(e.group_id, `用户: ${e.user_id}\nEAID: ${playerData[0].player_name}\n[${playerData[0].persona_id}]\n已离开群聊[主动退群]`, null);
						deleteMemberInfo(e.group_id, e.user_id);
					}
				} else if (e.notice_type == "notify" && e.sub_type == "poke" && e.target_id == bot_qq) {
					// 今天日期
					const today = new Date().toLocaleDateString();
					// 处理戳一戳
					if (aiManagers[e.group_id]) {
						const res = await aiManagers[e.group_id].aiSay(`今天是${today}，${e.nickname}戳了你一下，想要你讲一个战地冷笑话，不要讲废话，直接说笑话，字数50字以内`);
						sendMsgToQQGroupWithAI(e.group_id, res);
					}
				}
				break;
			case "request":
				// 处理加群请求
				if (e.post_type == "request" && e.request_type == "group" && e.sub_type == "add") {
					// 查看是否是注册过的群
					const isInit = await isGroupInit(e.group_id);
					if (isInit) {
						// 从"答案："后截取字符串，获取comment内容
						const comment = e.comment.split("答案：")[1];
						// 处理加群请求，例如自动同意或拒绝
						handleGroupRequest(e.group_id, e.user_id, e.flag, comment);
					}
				}
				break;
		}
	}
});

ws.on("close", (code) => {
	logger.info(`WS 已关闭: ${code}`);
});

ws.on("error", (err) => {
	if (err.message.startsWith("connect ETIMEDOUT") || err.message.startsWith("connect ECONNREFUSED")) {
		logger.error(`WA 连接超时: ${ws_ip}\n请检查网络连接 或 服务器地址是否正确\n请再次确认config.json中的ws_ip是否正确\n请确保NapCat的WebSocket服务已启动`);
	} else {
		logger.error(`WS 发生错误: ${err.message}`);
	}
	while (true) {}
});

// 接收所有未处理的错误消息防止程序崩溃
process.on("uncaughtException", (err) => {
	const date = new Date();
	logger.error(`未处理的错误: ${err}\n${err.stack}\n${date.toLocaleString()}`);
});

const app = express();
// 开放post接口,端口默认为7639
app.listen(7640, () => {
	logger.info("屏蔽模块API服务器已启动 监听端口: 7640");
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 屏蔽模块API
app.post("/ban/player", async (req, res) => {
	const { playerName, resaon, group_id, token } = req.body;
	if (token != status_token) {
		res.status(401).json({ message: "无效的token" });
		return;
	}
	if (!playerName || !resaon || !group_id) {
		res.status(400).json({ message: "缺少必要参数" });
		return;
	}
	const sendMsg = await banPlayerCommand(playerName, resaon, group_id, 0, 0, false);
	logger.info(`API调用[屏蔽玩家]：${playerName} ${resaon} ${group_id}`);
	if (sendMsg) {
		res.json({ message: sendMsg });
	} else {
		// 返回null
		res.json(null);
	}
});
// 踢出成员API
app.post("/kick/player", async (req, res) => {
	const { playerName, resaon, group_id, token } = req.body;
	if (token != status_token) {
		res.status(401).json({ message: "无效的token" });
		return;
	}
	if (!playerName || !resaon || !group_id) {
		res.status(400).json({ message: "缺少必要参数" });
		return;
	}
	logger.info(`API调用[屏蔽玩家]：${playerName} ${resaon} ${group_id}`);
	const sendMsg = await kickPlayerCommand(playerName, resaon, group_id, 0, 0, false);
	if (sendMsg) {
		res.json({ message: sendMsg });
	} else {
		// 返回null
		res.json(null);
	}
});
