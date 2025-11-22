import { Command } from "../../interface/command";
import { setPlayerNameAndPersonaId } from "../../qq/memberManager";
import { sendMsgToQQGroup } from "../../qq/sendMessage";
import { handleGroupJoinTempBlack } from "../../robot/ban/backListManager";
import { isPlayerNameExist, playerStatusInBfban, playerStatusInCommunity } from "../../robot/cx/basePlayerQuery";
import logger from "../../utils/logger";
import { padString } from "../../utils/stringTool";

export class BindCommand implements Command {
	regexContent = "bind=昵称";
	description = "绑定新ID";
	regex = /^bind(=|＝)(\S+)$/;
	adminLevel = 0;

	isMatch(command: string): boolean {
		// 正则匹配
		return this.regex.test(command);
	}

	getInfo(): string {
		// 总共20个字符，中间用空格补齐
		const content = padString(this.regexContent, this.description, 34);
		return content;
	}

	async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
		const playerName = command.match(this.regex)![2];
		const result = await isPlayerNameExist(playerName);
		// 判断result的类型
		if (typeof result !== "string") {
			const name = result.name;
			const personaId = result.personaId;
			const { isNormal: isCommunity, content: communityContent } = await playerStatusInCommunity(personaId);
			if (!isCommunity) {
				sendMsgToQQGroup(group_id, `=======绑定模块========\n\n【绑定新ID失败】\n【原因】: ${communityContent}\n======================`, message_id);
				return;
			}
			const { isNormal: isBfban, content: bfbanContent } = await playerStatusInBfban(personaId);
			if (!isBfban) {
				sendMsgToQQGroup(group_id, `=======绑定模块========\n\n【绑定新ID失败】\n【原因】: ${bfbanContent}\n======================`, message_id);
				return;
			}
			// 绑定成功
			const oldName = await setPlayerNameAndPersonaId(group_id, user_id, name, personaId);
			const registerDateStr = result.registerDate ? result.registerDate.split("T")[0] : "未知";
			const lastLoginStr = result.lastLogin ? result.lastLogin.split("T")[0] : "未知";
			sendMsgToQQGroup(
				group_id,
				`=======绑定模块========\n前ID: ${oldName}\n新ID: ${name}\n[${personaId}]\n【社区】: ${communityContent}\n【BFBAN】: ${bfbanContent}\n【注册时间】: ${registerDateStr}\n【最后登录】: ${lastLoginStr}\n\n【绑定新ID成功】\n======================`,
				message_id
			);

			// 检查临时黑名单
			handleGroupJoinTempBlack(group_id, user_id, personaId);
		} else {
			// 玩家不存在或网络错误
			sendMsgToQQGroup(group_id, `=======绑定模块========\n\n【绑定新ID失败】\n【原因】: ${result}\n======================`, message_id);
		}
	}
}
