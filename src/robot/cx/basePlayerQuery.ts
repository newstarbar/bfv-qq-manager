import { AxiosError } from "axios";
import { bfbanAxios, bfvAxios } from "../../utils/axios";
import { PlayerBaseInfo } from "../../interface/player";
import { readConfigFile } from "../../utils/localFile";

const botqq = readConfigFile().bot_qq;
/** 查询playerName是否存在 */
export async function isPlayerNameExist(playerName: string, count = 0): Promise<PlayerBaseInfo | string> {
	try {
		const result = await bfvAxios().get("bfv/player", {
			params: {
				name: playerName
			}
		});
		const data = result.data.data;
		const playerInfo: PlayerBaseInfo = {
			name: data.name,
			personaId: data.personaId,
			lastLogin: data.lastLogin,
			registerDate: data.registerDate
		};
		return playerInfo;
	} catch (e) {
		const err = e as AxiosError;
		const code = (err.response?.data as any)?.code;
		if (code === "player.not_found") {
			return "此玩家不存在";
		} else {
			if (count < 2) {
				return isPlayerNameExist(playerName, count + 1);
			} else {
				return "网络异常, 查询玩家名称失败";
			}
		}
	}
}

/** 查询玩家在社区的状态[是否是黑名单] */
export async function playerStatusInCommunity(personaId: number): Promise<{ isNormal: boolean; content: string }> {
	try {
		const communityResult = await bfvAxios().get("player/getCommunityStatus", {
			params: {
				personaId: personaId
			}
		});
		const data = communityResult.data.data;
		// 游戏状态编号
		const operationStatus = data.operationStatus;
		const reasonStatus = data.reasonStatus;
		// 状态名称
		const reasonStatusName = data.reasonStatusName;
		// 黑名单
		if ((operationStatus == 3 || (reasonStatus >= 7 && reasonStatus <= 14) || reasonStatus == 3 || reasonStatus == 2) && reasonStatusName != "武器数据异常") {
			// 拒绝
			return { isNormal: false, content: reasonStatusName };
		}
		// 正常
		return { isNormal: true, content: reasonStatusName };
	} catch (e) {
		const err = e as AxiosError;
		const code = (err.response?.data as any)?.code;
		return { isNormal: false, content: "网络异常, 查询玩家社区状态失败" };
	}
}

/** 查询玩家在BFBAN的状态 */
export async function playerStatusInBfban(personaId: number): Promise<{ isNormal: boolean; content: string }> {
	try {
		// BFBAN查询
		const bfbanResult = await bfbanAxios().get("player", {
			params: {
				personaId: personaId,
				history: true
			}
		});
		const bfbanData = bfbanResult.data;
		const status = bfbanData.status;
		switch (status) {
			case 0:
				return { isNormal: true, content: "正在处理" };
			case 1:
				return { isNormal: false, content: "实锤" };
			case 2:
				return { isNormal: false, content: "等待自证" };
			case 3:
				return { isNormal: true, content: "MOSS自证" };
			case 4:
				return { isNormal: true, content: "无效举报" };
			case 5:
				return { isNormal: true, content: "讨论中" };
			case 6:
				return { isNormal: true, content: "需要更多管理投票" };
			case 8:
				return { isNormal: true, content: "刷枪" };
			default:
				return { isNormal: true, content: "状态正常" };
		}
	} catch (e) {
		const err = e as AxiosError;
		const code = (err.response?.data as any)?.code;
		if (code === "player.notFound") {
			return { isNormal: true, content: "无案件" };
		}
		return { isNormal: false, content: "网络异常, 查询玩家BFBAN态失败" };
	}
}

/** 查询社区屏蔽记录 */
export async function getCommunityBlockRecord(personaId: number): Promise<string[]> {
	try {
		const blockResult = await bfvAxios().get("player/getBannedLogsByPersonaId", {
			params: {
				personaId: personaId
			}
		});
		const blockRecord = blockResult.data.data;
		return blockRecord;
	} catch (e) {
		const err = e as AxiosError;
		const code = (err.response?.data as any)?.code;
		return ["网络异常, 查询社区屏蔽记录失败"];
	}
}
