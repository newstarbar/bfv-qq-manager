import path from "path";
import { bfvAxios } from "../../utils/axios";
import { SQLiteDB } from "../../utils/sqlite";

const url = path.join(process.cwd(), "data", "cxPlatoon.db");
const createTableSql = `CREATE TABLE IF NOT EXISTS platoons (
    tag TEXT PRIMARY KEY,
    guid TEXT NOT NULL
)`;

/** 查询玩家当前的战排信息 */
export async function queryPlatoonInfo(name: string, personaId: number): Promise<string> {
	try {
		const res = await bfvAxios().get("worker/platoon/getPlayerJoins", {
			params: {
				personaId: personaId
			}
		});
		const data = res.data.data;
		if (data.length > 0) {
			// 保存战排信息到本地数据库
			await savePlatoonGuid(data);

			let platoonInfo = `玩家${name}加入的战排:\n`;
			for (let i = 0; i < data.length; i++) {
				const platoon = data[i];
				// 战排创建时间 YYYY-MM-DD
				const dateStr = new Date(platoon.dateCreated * 1000).toLocaleDateString();
				platoonInfo += `${platoon.name}[${platoon.tag}]\n人数: ${platoon.size}\n描述: ${platoon.description}\n允许申请: [${
					platoon.joinConfig.canApplyMembership ? "是" : "否"
				}]\n创建时间: ${dateStr}\n\n`;
			}
			return platoonInfo;
		} else {
			return `玩家${name}尚未加入任何战排`;
		}
	} catch (error) {
		return "查询玩家代表战排信息失败，请稍后再试";
	}
}

/** 将战排guid保存到本地数据库 */
export async function savePlatoonGuid(platoon: { tag: string; guid: string }[]): Promise<void> {
	try {
		const db = await new SQLiteDB(url, createTableSql);
		await db.open();

		for (let i = 0; i < platoon.length; i++) {
			const platoonInfo = platoon[i];
			const tag = platoonInfo.tag;
			const guid = platoonInfo.guid;
			// 是否已存在该战排
			const exist = await db.query("SELECT * FROM platoons WHERE tag = ?", [tag]);
			if (exist.length > 0) {
				// 更新战排guid
				await db.execute("UPDATE platoons SET guid = ? WHERE tag = ?", [guid, tag]);
			} else {
				// 插入战排信息
				await db.execute("INSERT INTO platoons (tag, guid) VALUES (?, ?)", [tag, guid]);
			}
		}
	} catch (error) {
		console.error(error);
	}
}

/** 查询战排内玩家信息 */
export async function queryPlatoonMembers(platoonName: string): Promise<string> {
	// 查询本地数据库
	try {
		const db = await new SQLiteDB(url, createTableSql);
		await db.open();
		const exist = await db.query("SELECT * FROM platoons WHERE tag = ?", [platoonName]);
		if (exist.length > 0) {
			const guid = exist[0].guid;
			const res = await bfvAxios().get("worker/platoon/getMember", {
				params: {
					guid: guid
				}
			});
			const data = res.data.data;
			if (data.length > 0) {
				let memberInfo = "";
				let currentRole = "";
				for (let i = 0; i < data.length; i++) {
					const member = data[i];
					// 取最后一个字符
					const role = member.role.slice(-1);
					let roleStr = "";
					switch (role) {
						case "9":
							roleStr = "将军";
							break;
						case "6":
							roleStr = "上校";
							break;
						case "3":
							roleStr = "中尉";
							break;
						case "0":
							roleStr = "列兵";
					}
					if (currentRole !== roleStr) {
						memberInfo += `\n【${roleStr}】:\n`;
					}
					currentRole = roleStr;
					memberInfo += `${member.displayName}\n`;
				}
				return memberInfo;
			} else {
				return "该战排尚无成员";
			}
		} else {
			return "未查询到该战排的guid\n请先pl=ID查询一名加入该战排的玩家";
		}
	} catch (error) {
		console.error(error);
		return "查询战排成员信息失败，请稍后再试";
	}
}
