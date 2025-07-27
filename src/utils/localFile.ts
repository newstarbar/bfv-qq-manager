import fs from "fs";
import path from "path";

/** 读取配置文件 */
export function readConfigFile(): { ws_ip: string; ws_token: string; http_ip: string; http_token: string; bot_name: string; bot_qq: number; admin_qq: number; group_name: string; ai_tooken: string } {
	try {
		return JSON.parse(fs.readFileSync(path.join(process.cwd(), "config.json"), "utf8"));
	} catch (e) {
		console.error("读取配置文件失败：", e);
		return { ws_ip: "", ws_token: "", http_ip: "", http_token: "", bot_name: "", bot_qq: 0, admin_qq: 0, group_name: "", ai_tooken: "" };
	}
}
