import { Command } from "../../interface/command";
import { getMemberInfo } from "../../qq/memberManager";
import { sendMsgToQQGroup } from "../../qq/sendMessage";
import { adminSay } from "../../robot/serverSayManager";
import { padString } from "../../utils/stringTool";

export class AdminSayCommand implements Command {
	regexContent = "，逗号开头";
	description = "发送管理消息";
	regex = /^(，|,)(.+)$/;
	adminLevel = 1;

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
		const content = command.match(this.regex)![2];
		if (content.length > 90) {
			sendMsgToQQGroup(group_id, `消息过长, 大于90个字符\n请重新发送`, message_id);
		} else {
			const playerName = await getMemberInfo(group_id, user_id, null);
			const result = await adminSay(0, playerName[0].player_name, content);
			sendMsgToQQGroup(group_id, result, message_id);
		}
	}
}
