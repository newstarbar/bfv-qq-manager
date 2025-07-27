import { Command } from "../../interface/command";
import path from "path";
import { sendLocalFileToQQGroup } from "../../qq/groupService";
import { sendMsgToQQGroup } from "../../qq/sendMessage";
import { createServerConfig, deleteServerConfig, getAllServerConfig, updateServerConfig } from "../../robot/serverConfigManager";
import { decodeHTML, padString } from "../../utils/stringTool";

export class ServerConfigCommand implements Command {
	regexContent = "create=???";
	description = "详见config";
	regex = /^create(=|＝)(\S+) "(.*)" "(.*)" (\S+) (\d+) (\d+) (\S+) (\S+) (\d+) (\d+) (\d+) (\S+)$/;

	regexContent2 = "update=???";
	description2 = "详见config";
	regex2 = /^update(=|＝)(\S+) (\S+) (.*)$/;

	regexContent3 = "delete=[序号]";
	description3 = "删除服务器";
	regex3 = /^delete(=|＝)(\S+)$/;

	regexContent4 = "list";
	description4 = "查看服务器列表";
	regex4 = /^list$/;

	regexContent5 = "config";
	description5 = "查看配置解释";
	regex5 = /^config$/;

	adminLevel = 3;

	isMatch(command: string): boolean {
		return this.regex.test(command) || this.regex2.test(command) || this.regex3.test(command) || this.regex4.test(command) || this.regex5.test(command);
	}

	getInfo(): string {
		const content1 = padString(this.regexContent, this.description, 30);
		const content2 = padString(this.regexContent2, this.description2, 30);
		const content3 = padString(this.regexContent3, this.description3, 30);
		const content4 = padString(this.regexContent4, this.description4, 35);
		const content5 = padString(this.regexContent5, this.description5, 32);
		const content = content1 + "\n" + content2 + "\n" + content3 + "\n" + content4 + "\n" + content5;
		return content;
	}

	async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
		if (this.regex.test(command)) {
			const tag = command.match(this.regex)![2];
			let zh_name = command.match(this.regex)![3];
			zh_name = decodeHTML(zh_name);
			let en_name = command.match(this.regex)![4];
			en_name = decodeHTML(en_name);
			const id = command.match(this.regex)![5];
			const level = parseInt(command.match(this.regex)![6]);
			const warm_level = parseInt(command.match(this.regex)![7]);
			const kd = parseInt(command.match(this.regex)![8]);
			const kpm = parseInt(command.match(this.regex)![9]);
			const nokill = parseInt(command.match(this.regex)![10]);
			const kill = parseInt(command.match(this.regex)![11]);
			const warm_player = parseInt(command.match(this.regex)![12]);
			const tv = command.match(this.regex)![13] == "true" ? true : false;
			const serverConfig = { tag, zh_name, en_name, group_id, id, level, warm_level, kd, kpm, nokill, kill, warm_player, tv };
			const result = await createServerConfig(serverConfig, group_id);
			sendMsgToQQGroup(group_id, result, user_id);
		} else if (this.regex2.test(command)) {
			const tag = command.match(this.regex2)![2];
			const config = command.match(this.regex2)![3];
			const value = command.match(this.regex2)![4];
			const result = await updateServerConfig(tag, config, value);
			sendMsgToQQGroup(group_id, result, user_id);
		} else if (this.regex3.test(command)) {
			const tag = command.match(this.regex3)![2];
			const result = await deleteServerConfig(tag);
			sendMsgToQQGroup(group_id, result, user_id);
		} else if (this.regex4.test(command)) {
			const result = (await getAllServerConfig()) as string;
			sendMsgToQQGroup(group_id, result, user_id);
		} else if (this.regex5.test(command)) {
			const url = path.join(process.cwd(), "configHelp.txt");
			sendLocalFileToQQGroup(group_id, "[Zygo]BOT使用指南", url, "config配置说明.txt");
		}
	}
}
