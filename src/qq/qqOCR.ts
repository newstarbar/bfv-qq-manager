import path from "path";
import { qqAxios } from "../utils/axios";
import logger from "../utils/logger";
import { SQLiteDB } from "../utils/sqlite";

/** 不需要的关键词 */
const unWantList = ["T34", "LVT"];

// 无需识别的user_id
const unNeedUserId = [2854211804, 3889013937];

const url = path.join(process.cwd(), "data", "groupReceiver.db");
const createIsOCRTableSql = `CREATE TABLE IF NOT EXISTS groupIsOCR (
	group_id INTEGER PRIMARY KEY,
	isEnable INTEGER NOT NULL DEFAULT 0
)`;

/** OCR提取游戏id */
export async function ocrBfvName(group_id: number, user_id: number, imgUrl: string): Promise<string | null> {
	const db = new SQLiteDB(url, createIsOCRTableSql);
	await db.open();
	const sql = "SELECT isEnable FROM groupIsOCR WHERE group_id = ?";
	const row = await db.query(sql, [group_id]);
	if (row.length > 0 && row[0].isEnable === 0) {
		return null;
	}

	if (unNeedUserId.includes(user_id)) {
		return null;
	}
	const res = await qqAxios().post("ocr_image", {
		image: imgUrl + ".png"
	});
	if (res.status === 200) {
		const result = res.data.data;
		let textList = "";
		let count = 0;
		for (let i = 0; i < result.length; i++) {
			let text = result[i].text;

			// 去除空格
			text = text.replace(/\s/g, "");
			// 去除中文
			text = text.replace(/[\u4e00-\u9fa5]/g, "");
			// []中间的包括括号的不加入
			text = text.replace(/\[.*?\]/g, "");
			// 去除符号,但保留-_
			text = text.replace(/[^\w\d\s-_]/g, "");
			// 去除不需要的关键词
			if (unWantList.includes(text)) {
				continue;
			}
			// 只有数字的不加入
			if (/^\d+$/.test(text)) {
				continue;
			}
			// 如果字符大于3个，加入
			if (text.length > 4) {
				textList += text + "\n";
				count++;
			}
		}
		if (textList.length > 0 && count <= 20) {
			return textList;
		}
	}
	return null;
}

/** OCR提取所有文字 */
export async function ocrWarmCount(imgUrl: string): Promise<{ text: string; warmCount: number } | null> {
	const res = await qqAxios().post("ocr_image", {
		image: imgUrl
	});
	if (res.status === 200) {
		const result = res.data.data;
		let text = "";
		let warmCount = 0;
		for (let i = 0; i < result.length; i++) {
			let tempText = result[i].text;
			// 过滤中文
			// 如果包含“暖服中”则不过滤中文
			if (tempText.includes("暖服中")) {
				// 只保留数字
				warmCount = Number(tempText.replace(/[^\d]/g, ""));
				continue;
			} else {
				tempText = tempText.replace(/[\u4e00-\u9fa5]/g, "");

				// 过滤符号
				tempText = tempText.replace(/[^\w\d\s]/g, "");
				// 去掉空格
				tempText = tempText.replace(/\s/g, "");
				// 十位以下的短数字过滤
				if (/^\d+$/.test(tempText) && tempText.length <= 10) {
					continue;
				}
				// 如果字符小于3个，过滤
				if (tempText.length < 3) {
					continue;
				}
				// 字母全变成小写
				tempText = tempText.toLowerCase();
			}

			text += tempText + " ";
		}
		if (text.length > 0) {
			return { text, warmCount };
		}
	}
	return null;
}

export async function setOcrFlag(group_id: number, flag: boolean) {
	const db = new SQLiteDB(url, createIsOCRTableSql);
	await db.open();
	await db.execute("INSERT OR REPLACE INTO groupIsOCR (group_id, isEnable) VALUES (?,?)", [group_id, flag ? 1 : 0]);
	await db.close();
}
