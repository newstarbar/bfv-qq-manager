import { Command } from "../../interface/command";
import { sendMsgToQQGroup } from "../../qq/sendMessage";
import { isPlayerNameExist } from "../../robot/cx/basePlayerQuery";
import { queryPlatoonInfo, queryPlatoonMembers } from "../../robot/cx/cxPlatoon";
import { padString } from "../../utils/stringTool";

export class CXPlatoonCommand implements Command {
	regexContent = "pl=ID";
	description = "查询玩家战排信息";
	regex = /^pl(=|＝)(\S+)$/;

	regexContent2 = "pm=战排名";
	description2 = "查询战排成员";
	regex2 = /^pm(=|＝)(\S+)$/;

	adminLevel = 0;

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
			const result = await isPlayerNameExist(playerName);
			// 判断result的类型
			if (typeof result !== "string") {
				const name = result.name;
				const personaId = result.personaId;
				const message = await queryPlatoonInfo(name, personaId);
				sendMsgToQQGroup(group_id, `=======战排查询========\n${message}\n======================`, message_id);
			} else {
				// 玩家不存在或网络错误
				sendMsgToQQGroup(group_id, `=======战排查询========\n${result}\n======================`, message_id);
			}
		} else if (this.regex2.test(command)) {
			const platoonName = command.match(this.regex2)![2];
			const message = await queryPlatoonMembers(platoonName);
			sendMsgToQQGroup(group_id, `=======战排查询========\n${message}\n======================`, message_id);
		}
	}
}
