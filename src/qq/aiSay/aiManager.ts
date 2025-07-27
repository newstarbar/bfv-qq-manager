import { aiAxios } from "../../utils/axios";
import { sendHttpImgToQQGroup, sendMsgToQQGroup, sendMsgToQQGroupWithAI } from "../sendMessage";

interface groupMsg {
	name: string;
	text: string;
	time: number;
}
interface chatRecord {
	type: "text";
	text: string;
}
interface gptChatMessages {
	role: "user" | "system";
	content: chatRecord[];
}

/** ai管理器 */
class AiManager {
	// 是否开启ai
	isEnable: boolean = false;

	// 机器人名称
	name: string;
	// 机器人qq号
	qq: number;

	// 最大聊天记录条数
	maxChatRecord: number = 50;
	// 最大表情包数量
	maxFaceCount: number = 30;

	// 聊天记录
	groupChatRecord: { [group_id: number]: groupMsg[] } = {};
	// 表情包记录
	faceUrls: string[] = [];

	constructor(name: string, qq: number) {
		this.name = name;
		this.qq = qq;
	}

	/** 定时器 */
	timer: NodeJS.Timeout | null = null;
	timerManger() {
		if (this.timer) {
			clearInterval(this.timer);
		}
		this.timer = setInterval(() => {
			if (this.isEnable) {
				this.sendGroupMessage();
			}
		}, 1000 * 60);
	}

	/** 群聊冷清时发送消息 */
	async sendGroupMessage() {
		// 是否应该发送消息
		const groups = Object.keys(this.groupChatRecord);
		for (const group of groups) {
			const group_id = parseInt(group);
			if (!this.groupChatRecord[group_id]) {
				continue;
			}
			if (this.groupChatRecord[group_id].length === 0) {
				continue;
			}
			// 如果在晚上12点到早上10点之间，不发送消息
			const hour = new Date().getHours();
			if (hour < 10) {
				continue;
			}
			// 最后一条消息时间
			const lastMessage = this.groupChatRecord[group_id][this.groupChatRecord[group_id].length - 1];
			const now = new Date().getTime();
			const timeDiff = now - lastMessage.time;
			// 如果距离上一条消息时间超过1小时, 100%发送消息, 超过30分钟, 60%发送消息
			// 超过20分钟, 40%发送消息, 超过10分钟, 20%发送消息, 超过5分钟, 5%发送消息
			let isSay = false;
			if (timeDiff > 1000 * 60 * 60) {
				isSay = true;
			} else if (timeDiff > 1000 * 60 * 45) {
				const random = Math.random();
				if (random < 0.8) {
					isSay = true;
				}
			} else if (timeDiff > 1000 * 60 * 30) {
				const random = Math.random();
				if (random < 0.6) {
					isSay = true;
				}
			} else if (timeDiff > 1000 * 60 * 20) {
				const random = Math.random();
				if (random < 0.5) {
					isSay = true;
				}
			} else if (timeDiff > 1000 * 60 * 15) {
				const random = Math.random();
				if (random < 0.4) {
					isSay = true;
				}
			} else if (timeDiff > 1000 * 60 * 10) {
				const random = Math.random();
				if (random < 0.3) {
					isSay = true;
				}
			} else if (timeDiff > 1000 * 60 * 5) {
				const random = Math.random();
				if (random < 0.2) {
					isSay = true;
				}
			}
			if (isSay) {
				// 40%发送图片
				const random = Math.random();
				if (random < 0.4) {
					await this.sendImg(group_id);
					return;
				}

				let content: gptChatMessages[] = [
					{
						role: "system",
						content: [
							{
								type: "text",
								text: `任何有关政治内容,统一回复:不知道。任何有关政治内容,统一回复:不知道。你是${this.name},你的性格是非常幽默的，请多用网络用语言，因为是多人聊天，要回应群友的消息,直接回复即可,融入其中,不要让人看出你是机器人。不允许复制粘贴我的消息。如果群友问了无厘头的问题,你就从异想天开的方向回答问题;如果没有逻辑,就针对一个点进行分析,不要一味的套用别人的观点。不要出现麦克阿瑟说:这样的第三人称,直接回复。必须确保是完整的句子。15个字以内的回复,不要超过15个字。`
							}
						]
					}
				];
				for (let i = 0; i < this.groupChatRecord[group_id].length; i++) {
					const message = this.groupChatRecord[group_id][i];
					content.push({
						role: "user",
						content: [
							{
								type: "text",
								text: `群友: ${message.name}的发言:` + message.text
							}
						]
					});
				}
				const message = await this.aiGroupReply(content);
				sendMsgToQQGroupWithAI(group_id, message);
			}
		}
	}

	/** 接收群聊消息 */
	async receiveGroupMessage(group_id: number, message: string, name: string) {
		// 是否存在该群聊记录
		if (!this.groupChatRecord[group_id]) {
			this.groupChatRecord[group_id] = [{ name: name, text: message, time: new Date().getTime() }];
		} else {
			// 是否超过最大聊天记录条数
			if (this.groupChatRecord[group_id].length >= this.maxChatRecord) {
				this.groupChatRecord[group_id].shift();
			}
			// 添加聊天记录
			this.groupChatRecord[group_id].push({
				name: name,
				text: message,
				time: new Date().getTime()
			});
		}
		if (message.includes(this.qq.toString()) || message.includes(this.name)) {
			const message = await this.reply(group_id);
			sendMsgToQQGroupWithAI(group_id, message);
		}
	}

	/** 更新表情包 */
	async updateFaceUrls(faceUrl: string) {
		if (this.faceUrls.length >= this.maxFaceCount) {
			this.faceUrls.shift();
		}
		this.faceUrls.push(faceUrl);
	}

	/** ai回复消息 */
	async aiSay(text: string): Promise<string> {
		if (!this.isEnable) {
			return "AI功能未开启\nai=1 开启AI功能";
		}

		const chatContent: gptChatMessages[] = [
			{
				role: "user",
				content: [
					{
						type: "text",
						text: text
					}
				]
			}
		];
		// 调用api接口获取回复消息
		const option = generateOption(chatContent, "say");
		const response = await aiAxios().post("", option);
		const data = response.data;
		const message = data.choices[0].message.content;
		return message;
	}

	/** 群聊回复消息 */
	async aiGroupReply(content: gptChatMessages[]): Promise<string> {
		// 调用api接口获取回复消息
		const option = generateOption(content, "say");
		const response = await aiAxios().post("", option);
		const data = response.data;
		const message = data.choices[0].message.content;
		return message;
	}

	/** 主动回复 */
	async reply(group_id: number): Promise<string> {
		const messages = this.groupChatRecord[group_id];
		let content: gptChatMessages[] = [
			{
				role: "system",
				content: [
					{
						type: "text",
						text: `任何有关政治内容,统一回复:不知道。任何有关政治内容,统一回复:不知道。你是${this.name},你的性格是非常幽默的，请多用网络用语言，因为是多人聊天，要回应群友的消息,直接回复即可,融入其中,不要让人看出你是机器人。不允许复制粘贴我的消息。如果群友问了无厘头的问题,你就从异想天开的方向回答问题;如果没有逻辑,就针对一个点进行分析,不要一味的套用别人的观点。不要出现麦克阿瑟说:这样的第三人称,直接回复。必须确保是完整的句子。15个字以内的回复,不要超过15个字。`
					}
				]
			}
		];
		for (let i = 0; i < messages.length; i++) {
			const message = messages[i];
			content.push({
				role: "user",
				content: [
					{
						type: "text",
						text: `群友: ${message.name}的发言:` + message.text
					}
				]
			});
		}
		const message = await this.aiGroupReply(content);
		return message;
	}

	/** 发送图片 */
	async sendImg(group_id: number): Promise<void> {
		// 随机选择表情包
		const random = Math.floor(Math.random() * this.faceUrls.length);
		const imgUrl = this.faceUrls[random];

		sendHttpImgToQQGroup(group_id, imgUrl, null);
	}
}

export let aiManager: AiManager | null = null;
/** 初始化ai管理器 */
export function initAiManager(name: string, qq: number) {
	aiManager = new AiManager(name, qq);
}
/** 更新ai管理器 */
export function updateAiManager(group_id: number, message: string, name: string) {
	if (aiManager) {
		aiManager.receiveGroupMessage(group_id, message, name);
	}
}
/** 更新表情包 */
export function updateFaceUrls(faceUrl: string) {
	if (aiManager) {
		aiManager.updateFaceUrls(faceUrl);
	}
}
export function setEnable(isEnable: boolean) {
	if (aiManager) {
		aiManager.isEnable = isEnable;
	}
}

// 对话模型名称
const sayModel: string = "Qwen/Qwen2.5-7B-Instruct";
// 画图模型名称
const drawModel: string = "black-forest-labs/FLUX.1-schnell";

/** 合成消息option */
function generateOption(content: gptChatMessages[] | string, model: "say" | "draw"): any {
	let option: any = {};
	if (model === "say") {
		option = {
			model: sayModel,
			messages: content as gptChatMessages[],
			stream: false,
			max_tokens: 100,
			stop: ["null"],
			temperature: 0.7,
			top_p: 0.7,
			top_k: 50,
			frequency_penalty: 0.5,
			n: 1,
			response_format: {
				type: "text"
			}
		};
	} else if (model === "draw") {
		option = {
			model: drawModel,
			prompt: content as string, // 最后一个消息作为prompt
			negative_prompt: "<string>",
			image_size: "512x512",
			batch_size: 1,
			seed: 0,
			num_inference_steps: 20,
			guidance_scale: 7.5,
			prompt_enhancement: false
		};
	}
	return option;
}
