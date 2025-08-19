import { Command } from "../../interface/command";
import { sendMsgToQQGroup } from "../../qq/sendMessage";
import { getPlayerDetailRecord, getPlayerRecord } from "../../robot/player/playerRecord";
import { padString } from "../../utils/stringTool";

export class RecordCommand implements Command {
	regexContent = "record=昵称";
	description = "查看战绩";
	regex = /^record(=|＝)(\S+)( (\d+))?$/;

	adminLevel = 0;

	isMatch(command: string): boolean {
		// 正则匹配
		return this.regex.test(command);
	}

	getInfo(): string {
		// 总共20个字符，中间用空格补齐
		const content = padString(this.regexContent, this.description, 33);
		return content;
	}

	async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {}
}
