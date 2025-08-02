import { Command } from "../../interface/command";
import { getAdminMemberInfo } from "../../qq/memberManager";
import { sendMsgToQQGroup } from "../../qq/sendMessage";
import { addLocalBlackList, deleteLocalBlackList } from "../../robot/ban/backListManager";
import { padString } from "../../utils/stringTool";
import { banPlayerCommand } from "../admin1/banPlayer";

export class BlackPlayerCommand implements Command {
	regexContent = "badd=ID 原因";
	description = "添加黑名单";
	regex = /^badd(=|＝)(\S+) (.+)$/;

	regexContent2 = "bdel=ID";
	description2 = "删除黑名单";
	regex2 = /^bdel(=|＝)(\S+)$/;

	adminLevel = 2;

	isMatch(command: string): boolean {
		// 正则匹配
		return this.regex.test(command) || this.regex2.test(command);
	}

	getInfo(): string {
		// 总共20个字符，中间用空格补齐
		const content1 = padString(this.regexContent, this.description, 34);
		const content2 = padString(this.regexContent2, this.description2, 34);
		const content = content1 + "\n" + content2;
		return content;
	}

	async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
		if (this.regex.test(command)) {
			const playerName = command.match(this.regex)![2];
			const reason = command.match(this.regex)![3];
			const allAdmin = await getAdminMemberInfo(group_id, 2);
			const admin_name = allAdmin.find((item) => item.user_id === user_id)?.player_name || "管理员";

			const { isSuccess, content } = await addLocalBlackList(playerName, reason, admin_name, user_id, group_id, message_id);
			if (isSuccess) {
				sendMsgToQQGroup(group_id, `=======本地黑名单=======\n本地黑名单添加成功\n${content}\n======================`, message_id);
			} else {
				sendMsgToQQGroup(group_id, `=======本地黑名单=======\n本地黑名单添加失败\n${content}\n======================`, message_id);
			}
		} else if (this.regex2.test(command)) {
			const playerName = command.match(this.regex2)![2];
			const result = await deleteLocalBlackList(playerName);
			sendMsgToQQGroup(group_id, result, message_id);
		}
	}
}
