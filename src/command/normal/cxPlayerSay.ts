import { Command } from "../../interface/command";
import { sendMsgToQQGroup } from "../../qq/sendMessage";
import { cxPlayerSay } from "../../robot/cx/cxPlayerSay";
import { readConfigFile } from "../../utils/localFile";
import { padString } from "../../utils/stringTool";

export class CXPlayerSayCommand implements Command {
	regexContent = "say=ID";
	description = "查询发言记录(仅小电视)";
	regex = /^say(=|＝)(\S+)$/;
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
		const groupName = await readConfigFile().group_name;
		const result = await cxPlayerSay(playerName, groupName);
		sendMsgToQQGroup(group_id, result, message_id);
	}
}
