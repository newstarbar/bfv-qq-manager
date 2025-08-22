import { handleGroupJoinTempBlack, isTempBlackList, removeTempBlackList } from "../robot/ban/backListManager";
import { isPlayerNameExist, playerStatusInBfban, playerStatusInCommunity } from "../robot/cx/basePlayerQuery";
import { handleAddGroupPlayerIsOnline } from "../robot/player/serverPlayerManager";
import { groupRequest, setGroupMemberCard } from "./groupService";
import { addOrUpdateMemberInfo } from "./memberManager";
import { sendMsgToQQGroup } from "./sendMessage";

/** 管理群邀请处理加群请求 */
export async function handleGroupRequest(group_id: number, user_id: number, flag: any, content: string, tryCount: number = 0): Promise<void> {
	const result = await isPlayerNameExist(content);
	// 判断result的类型
	if (typeof result !== "string") {
		const name = result.name;
		const personaId = result.personaId;
		const { isNormal: isCommunity, content: communityContent } = await playerStatusInCommunity(personaId);
		if (!isCommunity) {
			if (communityContent === "网络异常, 查询玩家社区状态失败") {
				if (tryCount < 3) {
					// 重试
					setTimeout(() => {
						handleGroupRequest(group_id, user_id, flag, content, tryCount + 1);
					}, 1000);
				} else {
					// groupRequest(flag, false, `[${communityContent}],请重试!`);
					// sendMsgToQQGroup(group_id, `=======加群模块========\n用户: ${user_id}\n申请ID: ${content}\n${communityContent}\n【已自动拒绝】\n======================`, null);
					sendMsgToQQGroup(
						group_id,
						`=======加群模块========\n用户: ${user_id}\n申请ID: ${content}\n${communityContent}\n【需管理员手动处理】\n群管理手动处理加群请求\n======================`,
						null
					);
				}
			} else {
				groupRequest(flag, false, `[${communityContent}],拒绝申请加入,请移步联Ban[QQ群]747413170 进行申诉`);
				sendMsgToQQGroup(group_id, `=======加群模块========\n用户: ${user_id}\n申请ID: ${content}\n${communityContent}\n【已自动拒绝】\n======================`, null);
			}
			return;
		}
		const { isNormal: isBfban, content: bfbanContent } = await playerStatusInBfban(personaId);
		if (!isBfban) {
			if (bfbanContent === "网络异常, 查询玩家BFBAN态失败") {
				// groupRequest(flag, false, `[${bfbanContent}],请重试!`);
				sendMsgToQQGroup(
					group_id,
					`=======加群模块========\n用户: ${user_id}\n申请ID: ${content}\n${bfbanContent}\n【需管理员手动处理】\n群管理手动处理加群请求\n======================`,
					null
				);
			} else {
				groupRequest(flag, false, `[${bfbanContent}],拒绝申请加入,请移步联Ban[QQ群]747413170 进行申诉`);
				sendMsgToQQGroup(group_id, `=======加群模块========\n用户: ${user_id}\n申请ID: ${content}\n${bfbanContent}\n【已自动拒绝】\n======================`, null);
			}
			return;
		}
		// 成功通过所有检查, 处理加群请求
		await groupRequest(flag, true);
		await sendMsgToQQGroup(
			group_id,
			`=======加群模块========\n用户: ${user_id}\n游戏ID: ${name}\n[${personaId}]\n【社区状态】: ${communityContent}\n【BFBAN】: ${bfbanContent}\n【注册时间】: ${
				result.registerDate.split("T")[0]
			}\n【最后登录】: ${result.lastLogin.split("T")[0]}\n【已自动修改群昵称】\n======================`,
			null
		);
		setTimeout(() => {
			// 添加群成员到数据库
			const joinTime = Math.floor(new Date().getTime() / 1000);
			addOrUpdateMemberInfo(group_id, user_id, name, 0, personaId, joinTime);

			setGroupMemberCard(group_id, user_id, name);
			sendMsgToQQGroup(
				group_id,
				`pb=[昵称] 查被踢原因\n例: pb=ID\n\n=====================\n游玩时请确认群昵称自动修改\n例: "游戏中-ID"\n\n注意大小写, 不正确的ID, 导致系统无法识别\n而被踢出游戏的\n【未按要求备注被踢需自担责任】\n【修改ID使用指令bind=ID】`,
				null,
				user_id
			);
			// 更新玩家在线状态
			handleAddGroupPlayerIsOnline(group_id, name);

			// 检查临时黑名单
			handleGroupJoinTempBlack(group_id, user_id, personaId);
		}, 1000);
	} else {
		if (result === "网络异常, 查询玩家名称失败") {
			if (tryCount < 3) {
				// 重试
				setTimeout(() => {
					handleGroupRequest(group_id, user_id, flag, content, tryCount + 1);
				}, 1000);
			} else {
				// groupRequest(flag, false, `[${result}],请重试!`);
				sendMsgToQQGroup(group_id, `=======加群模块========\n用户: ${user_id}\n申请ID: ${content}\n${result}\n【需管理员手动处理】\n群管理手动处理加群请求\n==========`, null);
			}
		} else {
			// 玩家不存在或网络错误
			groupRequest(flag, false, "不存在此玩家,请确认ID正确,请勿填入任何无关内容,该加群请求有机器人自动处理");
			sendMsgToQQGroup(group_id, `=======加群模块========\n用户: ${user_id}\n申请ID: ${content}\n${result}\n【已自动拒绝】\n======================`, null);
		}
	}
}
