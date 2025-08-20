import { Command } from "../../interface/command";
import { adminLevelName, getAdminMemberInfo, setAdmin } from "../../qq/memberManager";
import { sendMsgToQQGroup } from "../../qq/sendMessage";
import { padString } from "../../utils/stringTool";

export class SetAdminCommand implements Command {
	regexContent = "admin=qq号 级别";
	description = "设置管理身份";
	regex = /^admin(=|＝)(\d+) (\d{1})$/;

	regex2Content = "admin";
	description2 = "查看管理列表";
	regex2 = /^admin$/;

	adminLevel = 3;

	isMatch(command: string): boolean {
		// 正则匹配
		return this.regex.test(command) || this.regex2.test(command);
	}

	getInfo(): string {
		const content1 = padString(this.regexContent, this.description, 28);
		const content2 = padString(this.regex2Content, this.description2, 28);
		const content = content1 + "\n" + content2;
		return content;
	}

	async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
		if (this.regex.test(command)) {
			const qq_id = parseInt(command.match(this.regex)![2]);
			const admin_level = parseInt(command.match(this.regex)![3]);
			const result = await setAdmin(group_id, qq_id, admin_level);
			const isNeedQQ = result[0] ? qq_id : null;
			sendMsgToQQGroup(group_id, `=======设置管理员=======\nQQ: ${qq_id}\n${result[1]}`, message_id, isNeedQQ);
		} else if (this.regex2.test(command)) {
			const adminList = await getAdminMemberInfo(group_id, 1);
			let message = "=======管理员列表=======\n";
			for (const admin of adminList) {
				message += `${admin.player_name} [${adminLevelName[admin.admin_level]}]\n`;
			}
			sendMsgToQQGroup(group_id, message, message_id);
		}
	}
}
