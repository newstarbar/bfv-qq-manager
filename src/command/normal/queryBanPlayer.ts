import { Command } from "../../interface/command";
import { sendMsgToQQGroup } from "../../qq/sendMessage";
import { isLocalBlackList, isTempBlackList } from "../../robot/ban/backListManager";
import { getPlayerBanRecord } from "../../robot/ban/banRecord";
import { getCommunityBlockRecord, isPlayerNameExist } from "../../robot/cx/basePlayerQuery";
import { readConfigFile } from "../../utils/localFile";
import { padString } from "../../utils/stringTool";

export class QueryBanPlayerCommand implements Command {
	regexContent = "pb=昵称";
	description = "查询屏蔽记录";
	regex = /^pb(=|＝)(\S+)$/;
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
		let message = "========屏蔽查询========\n";
		const result = await isPlayerNameExist(playerName);
		// 判断result的类型
		if (typeof result !== "string") {
			const isBlack = await isLocalBlackList(result.personaId);
			if (isBlack.length > 0) {
				message += "【黑名单】: 本地黑名单\n";
				message += `【原因】: ${isBlack[0].reason}\n`;
				message += `【处理人】: ${isBlack[0].admin_name}\n`;
				message += `【时间】: ${isBlack[0].time}\n\n`;
			}
			// 获取临时黑名单
			const isTempBlack = await isTempBlackList(result.personaId);
			if (isTempBlack.length > 0) {
				message += "【黑名单】: 临时黑名单\n";
				message += `【${isTempBlack[0].reason_type}】: ${isTempBlack[0].reason_text}\n`;
				message += `【时间】: ${isTempBlack[0].time}\n\n`;
			}

			let banRecord = await getPlayerBanRecord(playerName);
			//  过滤掉server_name一样，reason一样的记录, 因为可能是因为多次封禁导致的以内的记录
			banRecord = banRecord.filter((item, index, arr) => {
				return index === arr.findIndex((item2) => item2.server_name === item.server_name && item2.reason === item.reason);
			});

			if (banRecord.length > 0) {
				const newBanRecord = banRecord.slice(0, 3);
				message += `======${readConfigFile().group_name}屏蔽记录=======\n`;
				for (const record of newBanRecord) {
					message += `【服名】: ${record.server_name}\n`;
					message += `【原因】: ${record.reason}\n`;
					message += `【处理人】: ${record.admin_name}\n`;
					message += `【时间】: ${record.time}\n`;
					message += `--------------------------------\n`;
				}
			} else {
				message += `【${readConfigFile().group_name}屏蔽记录】: 无\n\n`;
			}

			let reasonList = await getCommunityBlockRecord(result.personaId);
			// 过滤掉serverName一样，reason一样的记录, 因为可能是因为多次封禁导致的以内的记录
			reasonList.filter((item, index, arr) => {
				return index === arr.findIndex((item2) => item2.serverName == item.serverName && item2.reason == item.reason);
			});

			if (reasonList.length > 0) {
				message += "=======全社区记录=======\n";
				reasonList.slice(0, 3);
				reasonList.forEach((item: any) => {
					message += `${item.serverName}\n【原因】: ${item.reason}\n【时间】: ${item.createTime.split("T")[0]}\n\n`;
				});
			} else {
				message += "【全社区记录】: 无";
			}
		} else {
			message += result;
		}
		sendMsgToQQGroup(group_id, message, message_id);
	}
}
