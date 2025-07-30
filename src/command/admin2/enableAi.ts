import e from "express";
import { Command } from "../../interface/command";
import { setEnable } from "../../qq/aiSay/aiManager";
import { sendMsgToQQGroup } from "../../qq/sendMessage";
import { padString } from "../../utils/stringTool";
import { setOcrFlag } from "../../qq/qqOCR";

export class EnableAiCommand implements Command {
	regexContent = "ai=1/0";
	description = "开启/关闭ai";
	regex = /^ai(=|＝)(1|0)$/;

	regexContent2 = "ocr=1/0";
	description2 = "开启/关闭OCR识别";
	regex2 = /^ocr(=|＝)(1|0)$/;

	adminLevel = 2;

	isMatch(command: string): boolean {
		return this.regex.test(command) || this.regex2.test(command);
	}

	getInfo(): string {
		// 总共20个字符，中间用空格补齐
		const content1 = padString(this.regexContent, this.description, 32);
		const content2 = padString(this.regexContent2, this.description2, 32);
		const content = content1 + "\n" + content2;
		return content;
	}

	async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
		if (this.regex.test(command)) {
			const enable = command.match(this.regex)![2];
			setEnable(enable === "1");
			const content = `已${enable === "1" ? "开启" : "关闭"}ai`;
			await sendMsgToQQGroup(group_id, content, message_id);
		} else if (this.regex2.test(command)) {
			const enable = command.match(this.regex2)![2];
			setOcrFlag(enable === "1");
			const content = `已${enable === "1" ? "开启" : "关闭"}OCR识别`;
			await sendMsgToQQGroup(group_id, content, message_id);
		}
	}
}
