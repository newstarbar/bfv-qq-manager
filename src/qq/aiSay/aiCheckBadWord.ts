import path from "path";
import { aiAxios } from "../../utils/axios";
import logger from "../../utils/logger";
import { SQLiteDB } from "../../utils/sqlite";
import { recallMsgToQQGroup } from "../groupService";
import { sendMsgToQQGroup } from "../sendMessage";

const options = {
	model: "Qwen/Qwen2.5-7B-Instruct",
	messages: [
		{
			role: "system",
			content: [
				{
					type: "text",
					text: "以下内容是否有关中国、美国等国家形式的内容，是否有关中国历史人物，是否有关中国政治人物，是否有关中国的历史事件，分析下面内容是否涉及政治或色情等敏感词，或者辱骂等不当言论，含有辱骂情形，判断是否有关国家、政治的内容。你只需要给出是或者否的答案即可。"
				}
			]
		},
		{
			role: "user",
			content: [
				{
					type: "text",
					text: ""
				}
			]
		}
	],
	stream: false,
	max_tokens: 1,
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

/** 是否有不当言论 */
export async function aiCheckBadWord(group_id: number, user_id: number, message_id: number, content: string): Promise<boolean> {
	try {
		options.messages[1].content[0].text = "内容：" + content;
		const response = await aiAxios().post("", options);
		const data = response.data;
		const message = data.choices[0].message.content;

		if (message == "是") {
			// 如果有不当言论，撤回消息并发送警告
			await recallMsgToQQGroup(message_id);
			await sendMsgToQQGroup(group_id, "【不当言论已撤回】", null, user_id);
			return true;
		}
		return false;
	} catch (error) {
		logger.error(`AI请求失败: ${error}`);
		return false;
	}
}
