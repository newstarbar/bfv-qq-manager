import { Command } from "../../interface/command";
import { sendMsgToQQGroup } from "../../qq/sendMessage";
import { checkBFVServerStatus } from "../../robot/cx/cxAllServer";
import { padString } from "../../utils/stringTool";

export class AllCommunityServer implements Command {
	regexContent = "server";
	description = "查看全服信息";
	adminLevel = 0;

	isMatch(command: string): boolean {
		// 正则匹配
		return command.toLowerCase() === this.regexContent;
	}

	getInfo(): string {
		// 总共20个字符，中间用空格补齐
		const content = padString(this.regexContent, this.description, 34);
		return content;
	}

	async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
		const serverMessage = await checkBFVServerStatus();
		sendMsgToQQGroup(group_id, serverMessage, message_id);
	}
}
