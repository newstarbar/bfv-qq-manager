import { bfvAxios } from "../../utils/axios";
import { translateMapModeName } from "../../utils/translation";

/** 查看当时BFV服务器情况 */
export async function checkBFVServerStatus(): Promise<string> {
	let serverMessage = "";
	const res = await bfvAxios().get("bfv/statistics");
	if (res.status !== 200) {
		return "服务器状态获取失败";
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
	return serverMessage;
}
