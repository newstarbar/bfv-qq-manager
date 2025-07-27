import path from "path";
import { PrivateCommand } from "../../interface/command";
import { sendMsgToQQFriend } from "../../qq/sendMessage";
import { createServerConfig, deleteServerConfig, getAllServerConfig, updateServerConfig } from "../../robot/serverConfigManager";
import { decodeHTML, padString } from "../../utils/stringTool";
import { sendLocalFileToPrivate } from "../../qq/privateService";

export class ServerConfigPrivateCommand implements PrivateCommand {
	regexContent = "create=???";
	description = "详见config";
	regex = /^create(=|＝)(\S+) "(.*)" "(.*)" (\d+) (\S+) (\d+) (\d+) (\S+) (\S+) (\d+) (\d+) (\d+) (\S+)$/;

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

	async execute(command: string, message_id: number, user_id: number): Promise<any> {
		if (this.regex.test(command)) {
			const tag = command.match(this.regex)![2];
			let zh_name = command.match(this.regex)![3];
			zh_name = decodeHTML(zh_name);
			let en_name = command.match(this.regex)![4];
			en_name = decodeHTML(en_name);
			const group_id = parseInt(command.match(this.regex)![5]);
			const id = command.match(this.regex)![6];
			const level = parseInt(command.match(this.regex)![7]);
			const warm_level = parseInt(command.match(this.regex)![8]);
			const kd = parseInt(command.match(this.regex)![9]);
			const kpm = parseInt(command.match(this.regex)![10]);
			const nokill = parseInt(command.match(this.regex)![11]);
			const kill = parseInt(command.match(this.regex)![12]);
			const warm_player = parseInt(command.match(this.regex)![13]);
			const tv = command.match(this.regex)![14] == "true" ? true : false;
			const serverConfig = { tag, zh_name, en_name, group_id, id, level, warm_level, kd, kpm, nokill, kill, warm_player, tv };
			const result = await createServerConfig(serverConfig, group_id);
			sendMsgToQQFriend(result, user_id);
		} else if (this.regex2.test(command)) {
			const tag = command.match(this.regex2)![2];
			const config = command.match(this.regex2)![3];
			const value = command.match(this.regex2)![4];
			const result = await updateServerConfig(tag, config, value);
			sendMsgToQQFriend(result, user_id);
		} else if (this.regex3.test(command)) {
			const tag = command.match(this.regex3)![2];
			const result = await deleteServerConfig(tag);
			sendMsgToQQFriend(result, user_id);
		} else if (this.regex4.test(command)) {
			const result = (await getAllServerConfig()) as string;
			sendMsgToQQFriend(result, user_id);
		} else if (this.regex5.test(command)) {
			const url = path.join(process.cwd(), "configHelp.txt");
			sendLocalFileToPrivate(user_id, url, "config配置说明.txt");
		}
	}
}
