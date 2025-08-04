import axios from "axios";

export async function cxPlayerSay(playerName: string, groupName: string): Promise<string> {
	try {
		const result = await axios.get(`https://tracker.2788.pro/api/bfv/chat/${playerName}`);
		const data = result.data;
		if (!data) {
			return "没有该玩家的任何发言记录";
		}
		// 过滤出服务器名称带有groupName的记录，忽略大小写
		const groupNameLower = groupName.toLowerCase();
		const filteredData = data.filter((item: any) => item.serverName.toLowerCase().includes(groupNameLower));
		if (filteredData.length === 0) {
			return "没有该玩家在本服的发言记录";
		}
		// 按时间排序，取最新的一条记录
		const sortedData = filteredData.sort((a: any, b: any) => b.timestamp - a.timestamp);
		let curServerName = "";
		let message = `玩家 ${playerName} 的(小电视服)发言记录:\n`;
		// 根据服务器名称
		for (const item of sortedData) {
			if (item.serverName !== curServerName) {
				message += `【${item.serverName}】\n`;
				curServerName = item.serverName;
			}
			// 时间只hh:mm显示
			const timeStr = new Date(item.timestamp).toLocaleTimeString().slice(0, 5);
			message += `${timeStr} ${item.content}\n`;
		}
		return message;
	} catch (e) {
		return "此玩家不存在";
	}
}
