import path from "path";
import { aiAxios } from "../../utils/axios";
import { sendHttpImgToQQGroup, sendMsgToQQGroupWithAI } from "../sendMessage";
import { SQLiteDB } from "../../utils/sqlite";
import { sendVoiceToQQGroup } from "../groupService";
import { readConfigFile } from "../../utils/localFile";
import { initAICheckBadWord } from "./aiCheckBadWord";

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

const url = path.join(process.cwd(), "data", "groupReceiver.db");
const createIsAITableSql = `CREATE TABLE IF NOT EXISTS groupIsAI (
	group_id INTEGER PRIMARY KEY,
	isEnable INTEGER NOT NULL DEFAULT 0
)`;

/** ai管理器 */
class AiManager {
	// 是否开启AI功能
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

	constructor(name: string, qq: number, isEnable: boolean) {
		this.name = name;
		this.qq = qq;
		this.isEnable = isEnable;
	}

	/** 群聊概率回复消息 */
	async sendGroupMessage(group_id: number) {
		if (!this.isEnable) {
			return;
		}
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

		// 10%发送语音
		if (random < 0.5) {
			await sendVoiceToQQGroup(group_id, message);
			return;
		}
		sendMsgToQQGroupWithAI(group_id, message);
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
			// 概率10%回复消息
			const random = Math.random();
			if (random < 0.1) {
				this.sendGroupMessage(group_id);
			}
		}

		if (message.includes(this.qq.toString()) || message.includes(this.name)) {
			const message = await this.reply(group_id);
			sendMsgToQQGroupWithAI(group_id, message);
		}
	}

	/** 更新表情包 */
	async updateFaceUrls(faceUrl: string, group_id: number) {
		if (this.faceUrls.length >= this.maxFaceCount) {
			this.faceUrls.shift();
		}
		this.faceUrls.push(faceUrl);
		// 20%发送图片
		const random = Math.random();
		if (random < 0.2) {
			this.sendImg(group_id);
		}
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
		if (!this.isEnable) {
			return "AI功能未开启\nai=1 开启AI功能";
		}
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
		if (!this.isEnable) {
			return;
		}
		// 随机选择表情包
		const random = Math.floor(Math.random() * this.faceUrls.length);
		const imgUrl = this.faceUrls[random];

		sendHttpImgToQQGroup(group_id, imgUrl, null);
	}
}

export let aiManagers: { [group_id: number]: AiManager } = {};

/** 初始化ai管理器 */
export async function initAiManager(group_id: number, name: string, qq: number) {
	// 读取数据库
	let isEnable = false;
	const db = new SQLiteDB(url, createIsAITableSql);
	await db.open();
	const sql = `SELECT isEnable FROM groupIsAI WHERE group_id = ?`;
	const res = await db.query(sql, [group_id]);
	if (res.length > 0) {
		isEnable = res[0].isEnable;
	} else {
		isEnable = false;
	}
	await db.close();
	// 创建ai管理器
	const aiManager = new AiManager(name, qq, isEnable);
	aiManagers[group_id] = aiManager;
}

/** 更新ai管理器 */
export function updateAiManager(group_id: number, message: string, name: string) {
	if (aiManagers[group_id]) {
		aiManagers[group_id].receiveGroupMessage(group_id, message, name);
	}
}

/** 更新表情包 */
export function updateFaceUrls(faceUrl: string, group_id: number) {
	if (aiManagers[group_id]) {
		aiManagers[group_id].updateFaceUrls(faceUrl, group_id);
	}
}

/** 设置是否开启ai功能 */
export async function setEnable(group_id: number, isEnable: boolean) {
	const db = new SQLiteDB(url, createIsAITableSql);
	await db.open();
	await db.execute(`INSERT OR REPLACE INTO groupIsAI (group_id, isEnable) VALUES (?,?)`, [group_id, isEnable ? 1 : 0]);
	await db.close();
	// 更新ai管理器
	if (aiManagers[group_id]) {
		aiManagers[group_id].isEnable = isEnable;
	}
	// 更新AI检查不当言论功能
	initAICheckBadWord(group_id);
}

// 画图模型名称
const drawModel: string = "black-forest-labs/FLUX.1-schnell";

/** 合成消息option */
function generateOption(content: gptChatMessages[] | string, model: "say" | "draw"): any {
	let option: any = {};
	if (model === "say") {
		option = {
			model: readConfigFile().ai_model,
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
