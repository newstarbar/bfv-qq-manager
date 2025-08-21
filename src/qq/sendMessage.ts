import { qqAxios } from "../utils/axios";
import { readConfigFile } from "../utils/localFile";
import logger from "../utils/logger";
import { AxiosError } from "axios";

/** http 状态检测（发送测试消息） */
export async function checkHttpStatus(): Promise<boolean> {
	const { bot_qq, http_ip } = readConfigFile();
	try {
		const res = await qqAxios().post("send_private_msg", {
			user_id: bot_qq,
			message: [
				{
					type: "text",
					data: {
						text: `<http 状态检测>\n当前QQ号:${bot_qq}`
					}
				}
			]
		});
		const data = res.data;
		if (data.status === "ok") {
			const loginInfo = await getLoginInfo();
			if (loginInfo.user_id == bot_qq) {
				logger.info(`服管机器人bot_qq号验证通过\n机器人账号:${bot_qq}\n登入账号:${loginInfo.user_id}\n登入昵称:${loginInfo.nickname}`);
				return true;
			} else {
				logger.error(`登入账号与机器人bot_qq号不匹配\n机器人账号:${bot_qq}\n登入账号:${loginInfo.user_id}\n登入昵称:${loginInfo.nickname}\n请检查config.json中的bot_qq是否正确`);
				return false;
			}
		} else {
			if (data.message === "无法获取用户信息") {
				logger.error(`无法获取用户信息, 请检查config.json中的bot_qq是否正确`);
			} else {
				logger.error(`发送测试消息失败: ${data.message}`);
			}
			return false;
		}
	} catch (err) {
		const error = err as AxiosError;
		if (error.code === "ETIMEDOUT") {
			logger.error(`Http 请求超时: ${http_ip}\n请检查网络连接 或 服务器地址是否正确\n请再次确认config.json中的http_ip是否正确\n请确保NapCat的Http服务已启动`);
		} else if (error.code === "ERR_BAD_REQUEST") {
			logger.error(`Http 请求错误, 请检查token是否正确\n请确认config.json中的http_token是否正确`);
		} else {
			logger.error(`[${error.code}] 响应数据：${JSON.stringify(error.message)}`);
		}
		return false;
	}
}

/** 获取登入号信息 */
async function getLoginInfo(): Promise<any> {
	try {
		const res = await qqAxios().get("get_login_info");
		const data = res.data;
		if (data.status === "ok") {
			return data.data;
		} else {
			logger.error(`获取登入号信息失败: ${data.message}`);
			return null;
		}
	} catch (err) {
		const error = err as AxiosError;
		logger.error(`[${error.code}] 响应数据：${JSON.stringify(error.message)}`);
		return null;
	}
}

/** 发送消息到QQ群 */
export async function sendMsgToQQGroup(group_id: number, message: string, message_id: number | null, user_id: number | null = null): Promise<void> {
	try {
		const messageArr = [];
		if (message_id) {
			messageArr.push({
				type: "reply",
				data: {
					id: message_id
				}
			});
		}
		if (user_id) {
			messageArr.push({
				type: "at",
				data: {
					qq: user_id
				}
			});
		}
		messageArr.push({
			type: "text",
			data: {
				text: user_id == null ? message : "\n" + message
			}
		});

		qqAxios()
			.post("send_group_msg", {
				group_id: group_id,
				message: messageArr
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

/** ai发言单独模块 */
export async function sendMsgToQQGroupWithAI(group_id: number, message: string): Promise<void> {
	try {
		qqAxios()
			.post("send_group_msg", {
				group_id: group_id,
				message: [
					{
						type: "text",
						data: {
							text: message
						}
					}
				]
			})
			.then((res) => {
				const data = res.data;
				if (data.status === "failed") {
					logger.error(`发送ai发言失败: ${data.message}`);
				}
			});
	} catch (err) {
		const error = err as AxiosError;
		logger.error(`[${error.code}] 响应数据：${JSON.stringify(error.message)}`);
	}
}

/** 发送私聊消息 */
export async function sendMsgToQQFriend(message: string, user_id: number): Promise<void> {
	try {
		qqAxios()
			.post("send_private_msg", {
				user_id: user_id,
				message: [
					{
						type: "text",
						data: {
							text: message
						}
					}
				]
			})
			.then((res) => {
				const data = res.data;
				if (data.status === "failed") {
					logger.error(`发送私聊消息失败: ${data.message}`);
				}
			});
	} catch (err) {
		const error = err as AxiosError;
		logger.error(`[${error.code}] 响应数据：${JSON.stringify(error.message)}`);
	}
}

/** 发送Base64图片 */
export async function sendBase64ImgToQQGroup(group_id: number, imgBase64: string, message_id: number | null, user_id: number | null = null): Promise<void> {
	try {
		const messageArr = [];
		if (message_id) {
			messageArr.push({
				type: "reply",
				data: {
					id: message_id
				}
			});
		}
		if (user_id) {
			messageArr.push({
				type: "at",
				data: {
					qq: user_id
				}
			});
		}
		messageArr.push({
			type: "image",
			data: {
				// base64图片
				file: "base64://" + imgBase64
			}
		});
		qqAxios()
			.post("send_group_msg", {
				group_id: group_id,
				message: messageArr
			})
			.then((res) => {
				const data = res.data;
				if (data.status === "failed") {
					logger.error(`发送Base64图片失败: ${data.message}`);
				}
			});
	} catch (err) {
		const error = err as AxiosError;
		logger.error(`[${error.code}] 响应数据：${JSON.stringify(error.message)}`);
	}
}

/** 发送http图片 */
export async function sendHttpImgToQQGroup(group_id: number, imgUrl: string, message_id: number | null, user_id: number | null = null): Promise<void> {
	try {
		const messageArr = [];
		if (message_id) {
			messageArr.push({
				type: "reply",
				data: {
					id: message_id
				}
			});
		}
		if (user_id) {
			messageArr.push({
				type: "at",
				data: {
					qq: user_id
				}
			});
		}
		messageArr.push({
			type: "image",
			data: {
				// 网络图片
				file: imgUrl
			}
		});
		qqAxios()
			.post("send_group_msg", {
				group_id: group_id,
				message: messageArr
			})
			.then((res) => {
				const data = res.data;
				if (data.status === "failed") {
					// logger.error(`发送http图片失败: ${data.message}`);
				}
			});
	} catch (err) {
		const error = err as AxiosError;
		logger.error(`[${error.code}] 响应数据：${JSON.stringify(error.message)}`);
	}
}
