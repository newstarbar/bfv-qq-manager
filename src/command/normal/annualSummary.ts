import { Command } from "../../interface/command";
import { generatePlayerAnnualSummaryImage, generateServerAnnualSummaryImage } from "../../qq/generateBase64Image";
import { getGroupMemberName, isGroupMember } from "../../qq/memberManager";
import { sendBase64ImgToQQGroup, sendMsgToQQGroup } from "../../qq/sendMessage";
import { readConfigFile } from "../../utils/localFile";
import { padString } from "../../utils/stringTool";

export class AnnualSummaryCommand implements Command {
	regexContent = "我的年度报告";
	description = "_";

	regexContent2 = "群组年度报告";
	description2 = "_";
	adminLevel = 0;

	isMatch(command: string): boolean {
		// 正则匹配
		return this.regexContent === command || this.regexContent2 === command;
	}

	getInfo(): string {
		// 总共20个字符，中间用空格补齐
		const content1 = padString(this.regexContent, this.description, 34);
		const content2 = padString(this.regexContent2, this.description2, 34);
		const content = `${content1}\n${content2}`;
		return content;
	}

	async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
		const groupName = await readConfigFile().group_name;
		if (this.regexContent === command) {
			// 获取bind的玩家id
			const playerId = await getGroupMemberName(group_id, user_id);
			if (!playerId) {
				await sendMsgToQQGroup(group_id, "您未绑定玩家ID\n请先bind绑定玩家ID", message_id);
				return;
			}
			await sendMsgToQQGroup(group_id, `正在生成玩家[${playerId}]的年度报告，请稍后...`, message_id);

			const base64 = await generatePlayerAnnualSummaryImage(playerId, groupName);
			await sendBase64ImgToQQGroup(group_id, base64, message_id);
		} else if (this.regexContent2 === command) {
			await sendMsgToQQGroup(group_id, `正在生成群组[${groupName}]的年度报告，请稍后...`, message_id);

			const base64 = await generateServerAnnualSummaryImage(groupName);
			await sendBase64ImgToQQGroup(group_id, base64, message_id);
		}
	}
}
