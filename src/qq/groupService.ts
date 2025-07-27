import { qqAxios } from "../utils/axios";
import logger from "../utils/logger";
import { AxiosError } from "axios";

// /** 撤回消息 */
// function recallMsgToQQGroup(message_id: number) {
//     qqAxios().post('delete_msg', {
//         "message_id": message_id
//     })
// }

/** 获取QQ群成员列表 */
export async function getQQGroupMemberList(groupId: number): Promise<any> {
	try {
		const result = await qqAxios().post("get_group_member_list", {
			group_id: groupId,
			no_cache: true
		});
		const data = result.data.data;
		return data;
	} catch (err) {
		const error = err as AxiosError;
		logger.error(`[${error.code}] 响应数据：${JSON.stringify(error.message)}`);
		return null;
	}
}

/** 设置群成员名片 */
export function setGroupMemberCard(groupId: number, userId: number, card: string) {
	try {
		qqAxios()
			.post("set_group_card", {
				group_id: groupId,
				user_id: userId,
				card: card
			})
			.then((res) => {
				const data = res.data;
				if (data.status === "failed") {
					logger.error(`发送消息到QQ群失败: ${data.message}`);
				}
			});
	} catch (err) {
		const error = err as AxiosError;
		logger.error(`[${error.code}] 响应数据：${JSON.stringify(error.message)}`);
	}
}

/** 同意或拒绝加群请求 */
export async function groupRequest(flag: any, approve: boolean, reason: string = ""): Promise<void> {
	try {
		if (approve) {
			qqAxios()
				.post("set_group_add_request", {
					flag: flag,
					approve: approve
				})
				.then((res) => {
					const data = res.data;
					if (data.status === "failed") {
						logger.error(`发送消息到QQ群失败: ${data.message}`);
					}
				});
		} else {
			qqAxios()
				.post("set_group_add_request", {
					flag: flag,
					approve: approve,
					reason: reason
				})
				.then((res) => {
					const data = res.data;
					if (data.status === "failed") {
						logger.error(`处理加群请求失败: ${data.message}`);
					}
				});
		}
	} catch (err) {
		const error = err as AxiosError;
		logger.error(`[${error.code}] 响应数据：${JSON.stringify(error.message)}`);
	}
}

/** 发送群文件(文字形式.txt) */
export async function sendGroupTxtFile(groupId: number, folderName: string, fileContent: string, fileName: string): Promise<void> {
	try {
		const base64Content = Buffer.from(fileContent).toString("base64");
		const queryFolderResult = await qqAxios().post("get_group_root_files", {
			group_id: groupId
		});
		const folders = queryFolderResult.data.data.folders;
		// 查看群文件夹是否存在
		const targetFolder = folders.find((item: any) => item.folder_name === folderName);
		let folder_id = 0;
		if (targetFolder) {
			// 存在文件夹，发送文件
			folder_id = targetFolder.folder_id;
		} else {
			// 不存在文件夹，创建文件夹
			const createFolderResult = await qqAxios().post("create_group_file_folder", {
				group_id: groupId,
				folder_name: folderName
			});
			folder_id = createFolderResult.data.data.groupItem.folderInfo.folderId;
		}
		// 发送文件
		await qqAxios()
			.post("upload_group_file", {
				group_id: groupId,
				file: "base64://" + base64Content,
				name: fileName,
				folder_id: folder_id
			})
			.then((res) => {
				const data = res.data;
				if (data.status === "failed") {
					logger.error(`发送.txt文件到QQ群失败: ${data.message}`);
				}
			});
	} catch (err) {
		const error = err as AxiosError;
		logger.error(`[${error.code}] 响应数据：${JSON.stringify(error.message)}`);
	}
}

/** 发送本地文件到QQ群 */
export async function sendLocalFileToQQGroup(groupId: number, folderName: string, filePath: string, fileName: string): Promise<void> {
	try {
		const queryFolderResult = await qqAxios().post("get_group_root_files", {
			group_id: groupId
		});
		const folders = queryFolderResult.data.data.folders;
		// 查看群文件夹是否存在
		const targetFolder = folders.find((item: any) => item.folder_name === folderName);
		let folder_id = 0;
		if (targetFolder) {
			// 存在文件夹，发送文件
			folder_id = targetFolder.folder_id;
		} else {
			// 不存在文件夹，创建文件夹
			const createFolderResult = await qqAxios().post("create_group_file_folder", {
				group_id: groupId,
				folder_name: folderName
			});
			folder_id = createFolderResult.data.data.groupItem.folderInfo.folderId;
		}
		// 发送文件
		await qqAxios()
			.post("upload_group_file", {
				group_id: groupId,
				file: "file://" + filePath,
				name: fileName,
				folder_id: folder_id
			})
			.then((res) => {
				const data = res.data;
				if (data.status === "failed") {
					logger.error(`发送本地文件到QQ群失败: ${data.message}`);
				}
			});
	} catch (err) {
		const error = err as AxiosError;
		logger.error(`[${error.code}] 响应数据：${JSON.stringify(error.message)}`);
	}
}

/** 打卡 */
export async function sendClockToQQGroup(groupId: number): Promise<void> {
	try {
		qqAxios()
			.post("send_group_sign", { group_id: groupId })
			.then((res) => {
				const data = res.data;
				if (data.status === "failed") {
					logger.error(`发送打卡失败: ${data.message}`);
				}
			});
	} catch (err) {
		const error = err as AxiosError;
		logger.error(`[${error.code}] 响应数据：${JSON.stringify(error.message)}`);
	}
}

/** 全体禁言 */
export async function setGroupWholeBan(groupId: number, isBan: boolean): Promise<void> {
	try {
		await qqAxios()
			.post("set_group_whole_ban", {
				group_id: groupId,
				enable: isBan
			})
			.then((res) => {
				const data = res.data;
				if (data.status === "failed") {
					logger.error(`设置全体禁言失败: ${data.message}`);
				}
			});
	} catch (err) {
		const error = err as AxiosError;
		logger.error(`[${error.code}] 响应数据：${JSON.stringify(error.message)}`);
	}
}
