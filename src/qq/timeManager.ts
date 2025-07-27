import { ServerConfig } from "../interface/ServerInfo";
import { getAllServerConfig } from "../robot/serverConfigManager";
import { bfvAxios, qqAxios } from "../utils/axios";
import logger from "../utils/logger";
import { translateMapModeName } from "../utils/translation";
import { sendClockToQQGroup, setGroupWholeBan } from "./groupService";
import { sendMsgToQQGroup } from "./sendMessage";

let timeManager: NodeJS.Timeout | null = null;
/** 初始化 */
export function initTimeManager(): void {
	if (timeManager) {
		return;
	}
	timeManager = setInterval(timeManagerCore, 60 * 1000);
}

// 是否开启宵禁模式
let isCurfew = false;
let isStopSpeaking = false;
let isStartSpeaking = false;

let stopSpeakHour = 23;
let stopSpeakMinute = 30;
let startSpeakHourTime = 8;
let startSpeakMinuteTime = 0;

/** 时间模块核心 */
async function timeManagerCore(): Promise<void> {
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth() + 1;
	const day = now.getDate();
	const hour = now.getHours();
	const minute = now.getMinutes();
	// 早上运势
	if (hour == 9 && minute == 1) {
		checkBFVServerStatus();
	}
	// 中午运势
	if (hour == 13 && minute == 1) {
		checkBFVServerStatus();
	}
	// 晚上运势
	if (hour == 20 && minute == 1) {
		checkBFVServerStatus();
	}

	// 早上8点到晚上11点，每隔一小时发送一次明日地图池投票
	// if (hour >= 8 && hour <= 23) {
	//     if (minute == 1) {
	//         remindMapPoolVoting();
	//     }
	// }

	let serverConfig = await getAllServerConfig(false);
	serverConfig = serverConfig as ServerConfig[];
	let group_id = 0;
	if (serverConfig.length > 0) {
		group_id = serverConfig[0].group_id;

		// 打卡
		if (hour == 23 && minute == 59) {
			// 每0.3秒发送一次打卡请求
			const intervalId = setInterval(() => {
				const nowHour = new Date().getHours();
				if (nowHour == 0) {
					sendClockToQQGroup(group_id);
					clearInterval(intervalId);
				}
			}, 300);
		}

		// 是否使用宵禁
		if (isCurfew && hour == stopSpeakHour && minute == stopSpeakMinute && isStopSpeaking == false) {
			isStopSpeaking = true;
			isStartSpeaking = false;
			// 全体禁言
			setGroupWholeBan(group_id, true);
			sendMsgToQQGroup(
				group_id,
				`出于安全考虑，本群已进入宵禁状态\n开启宵禁时间: ${stopSpeakHour}: ${stopSpeakMinute}\n解除宵禁时间: ${startSpeakHourTime}: ${startSpeakMinuteTime}\n请各位群友注意遵守群规`,
				null
			);
		}
		if (isCurfew && hour == startSpeakHourTime && minute == startSpeakMinuteTime && isStartSpeaking == false) {
			isStartSpeaking = true;
			isStopSpeaking = false;
			// 解除全体禁言
			setGroupWholeBan(group_id, false);
			sendMsgToQQGroup(group_id, `当前时间为${hour}:${minute}点\n本群已解除宵禁状态`, null);
		}
	}
}

/** 查看当时BFV服务器情况 */
async function checkBFVServerStatus(): Promise<void> {
	let serverMessage = "";
	const res = await bfvAxios().get("bfv/statistics");
	if (res.status !== 200) {
		return;
	}
	const serverAll = res.data.data.ALL;
	const serverAllCurrent = serverAll.allServerSoldierCurrent;
	const serverAllServerCount = serverAll.serverCount;
	serverMessage += `【全球】共${serverAllServerCount}个服 / ${serverAllCurrent}人\n`;

	const serverAsiaJP = res.data.data.Asia.JP;
	const serverCount = serverAsiaJP.serverCount;
	const diceServerSoldierCurrent = serverAsiaJP.diceServerSoldierCurrent;
	const robotServerSoldierCurrent = serverAsiaJP.robotServerSoldierCurrent;
	const allServerSoldierCurrent = serverAsiaJP.allServerSoldierCurrent;
	const BadServerSoldierCurrent = allServerSoldierCurrent - robotServerSoldierCurrent - diceServerSoldierCurrent;
	serverMessage += `【亚洲JP】 共${serverCount}个服\n官服: ${diceServerSoldierCurrent}人\n社区服: ${robotServerSoldierCurrent}人\n全服共: ${allServerSoldierCurrent}人  野服: ${BadServerSoldierCurrent}人`;
	const serverAsiaJPMaps = serverAsiaJP.maps;
	const serverAsiaJPMapPlayers = serverAsiaJP.mapPlayers;
	let serverAsiaJPMapsKeys = Object.keys(serverAsiaJPMaps);
	// 根据人数进行降序排序
	serverAsiaJPMapsKeys = serverAsiaJPMapsKeys.sort((a, b) => serverAsiaJPMapPlayers[b] - serverAsiaJPMapPlayers[a]);
	for (let i = 0; i < serverAsiaJPMapsKeys.length; i++) {
		const mapName = translateMapModeName(serverAsiaJPMapsKeys[i]);
		const mapCount = serverAsiaJPMaps[serverAsiaJPMapsKeys[i]];
		const mapPlayerCount = serverAsiaJPMapPlayers[serverAsiaJPMapsKeys[i]];
		serverMessage += `\n[${mapCount}个 | ${mapPlayerCount}人] 【${mapName}】`;
	}
	let serverConfig = await getAllServerConfig(false);
	serverConfig = serverConfig as ServerConfig[];
	let group_id = 0;
	if (serverConfig.length > 0) {
		group_id = serverConfig[0].group_id;
		sendMsgToQQGroup(group_id, `${serverMessage}`, null);
	}
}

/** 设置宵禁模式 */
export function setOnWarmMode(isWarm: boolean): void {
	isCurfew = isWarm;
}
/** 设置宵禁时间 */
export function setWarmTime(stopHour: number, stopMinute: number, startHour: number, startMinute: number): void {
	stopSpeakHour = stopHour;
	stopSpeakMinute = stopMinute;
	startSpeakHourTime = startHour;
	startSpeakMinuteTime = startMinute;
}
/** 获取宵禁时间 */
export function getWarmTime(): string {
	return `${stopSpeakHour}:${stopSpeakMinute} 到 ${startSpeakHourTime}:${startSpeakMinuteTime}`;
}
