import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { AllWeaponDate, PlayerLoadout } from "../interface/player";
import { getServerAnnualData, getPlayerAnnualData, getPlayerOnlineHistory } from "../robot/cx/annualSummary";
import ejs from "ejs";
import logger from "../utils/logger";

export async function htmlToBase64Image(htmlContent: string): Promise<string> {
	let chromePath = path.join(process.cwd(), "chrome/win/chrome.exe");
	// 检测操作系统
	const platform = process.platform;
	if (platform === "linux") {
		// linux 系统
		chromePath = path.join(process.cwd(), "chrome/linux/chrome");
	}
	// 指定 Chromium 的路径
	const browser = await puppeteer.launch({
		headless: true,
		executablePath: chromePath
	});
	const page = await browser.newPage();
	await page.setContent(htmlContent);
	const base64Image = await page.screenshot({ encoding: "base64", fullPage: true });
	await browser.close();
	return base64Image;
}

/** 生成玩家年度总结图片 */
export async function generatePlayerAnnualSummaryImage(playerName: string, group: string): Promise<string> {
	logger.debug(`开始生成玩家${playerName}年度总结图片`);
	const htmlFilePath = path.join(process.cwd(), `html/playerAnnualSummary.html`);
	// 读取html模板
	const htmlContent = await fs.promises.readFile(htmlFilePath, "utf-8");
	logger.debug(`html模板读取完成`);

	const playerData = await getPlayerAnnualData(playerName, new Date().getFullYear());
	// 获取玩家在线历史数据
	const playerOnlineHistory = await getPlayerOnlineHistory(playerName, new Date().getFullYear());

	logger.debug(`sqlite数据获取完成`);

	const variables = {
		PLAYER_NAME: playerName,
		YEAR: new Date().getFullYear(),
		GROUP: group,
		...playerData,
		...playerOnlineHistory
	};

	// 使用 ejs 渲染模板
	const renderedHtml = ejs.render(htmlContent, variables);

	const base64Image = await htmlToBase64Image(renderedHtml);
	logger.debug(`Base64图片生成完成`);
	return base64Image;
}

/** 生成服务器年度总结图片 */
export async function generateServerAnnualSummaryImage(group: string): Promise<string> {
	logger.debug(`开始生成服务器${group}年度总结图片`);
	const htmlFilePath = path.join(process.cwd(), `html/serverAnnualSummary.html`);
	// 读取html模板
	const htmlContent = await fs.promises.readFile(htmlFilePath, "utf-8");
	logger.debug(`html模板读取完成`);

	const serverData = await getServerAnnualData(group, new Date().getFullYear());
	logger.debug(`sqlite数据获取完成`);

	const variables = {
		YEAR: new Date().getFullYear(),
		GROUP: group,
		...serverData
	};

	// 使用 ejs 渲染模板
	const renderedHtml = ejs.render(htmlContent, variables);

	const base64Image = await htmlToBase64Image(renderedHtml);
	logger.debug(`Base64图片生成完成`);
	return base64Image;
}

/** 生成历史上线指定玩家玩家base64图片 */
export async function generateHistoryOnlinePlayerImage(playerName: string, year: number, month: number, historyData: any[]): Promise<string> {
	const htmlFilePath = path.join(process.cwd(), `html/history.html`);
	// 读取html模板
	const htmlContent = await fs.promises.readFile(htmlFilePath, "utf-8");

	// 生成日历 HTML
	const calendarHtml = generatePlayerDays(historyData, year, month);

	// 替换模板中的变量
	const replacedHtmlContent = htmlContent.replace("{{name}}", playerName).replace("{{year}}", year.toString()).replace("{{month}}", month.toString()).replace("{{calendar}}", calendarHtml);

	const base64Image = await htmlToBase64Image(replacedHtmlContent);
	return base64Image;
}

export function generatePlayerDays(historyData: any[], year: number, month: number): string {
	const endDate = new Date(year, month, 0);
	const daysInMonth = endDate.getDate();
	let html = "";

	for (let day = 1; day <= daysInMonth; day++) {
		const dateString = `${year}-${month < 10 ? "0" + month : month}-${day < 10 ? "0" + day : day}`;

		const player = historyData.find((p) => p.time.slice(0, 10) === dateString);
		const statusClass = player ? (player.is_warmed == 1 ? "warming" : "online") : "offline";

		html += `<div class="day ${statusClass}">${day}</div>`;
	}

	return html;
}

/** 生成历史上线指定玩家玩家base64图片 */
export async function generateHistoryOnlineImage(year: number, month: number, historyData: any[]): Promise<string> {
	const htmlFilePath = path.join(process.cwd(), `html/allHistory.html`);
	// 读取html模板
	const htmlContent = await fs.promises.readFile(htmlFilePath, "utf-8");

	// 生成日历 HTML
	const calendarHtml = generateDays(historyData, year, month);

	// 替换模板中的变量
	const replacedHtmlContent = htmlContent.replace("{{year}}", year.toString()).replace("{{month}}", month.toString()).replace("{{history}}", calendarHtml);

	const base64Image = await htmlToBase64Image(replacedHtmlContent);
	return base64Image;
}

export function generateDays(historyData: any[], year: number, month: number): string {
	const endDate = new Date(year, month, 0);
	const daysInMonth = endDate.getDate();
	let html = "";
	for (let day = 1; day <= daysInMonth; day++) {
		const dateString = `${year}-${month < 10 ? "0" + month : month}-${day < 10 ? "0" + day : day}`; // 确保月份和日期是两位数
		const playerList = historyData.filter((p) => p.time.slice(0, 10) == dateString);
		const loginCount = playerList.filter((p) => p.is_warmed == 0).length;
		const warmingCount = playerList.filter((p) => p.is_warmed == 1).length;

		// 根据玩家数确定 CSS 类
		const onlineClass = loginCount > 0 ? "online" : "offline";
		const warmingClass = warmingCount > 0 ? "warming" : "offline";
		const dateCircleClass = loginCount === 0 && warmingCount === 0 ? "date-circle-offline" : "date-circle-organ";

		// 生成日期圆圈和玩家数显示
		html += `
            <div class="day">
                <div class="${dateCircleClass}">${day}</div>
                <div class="player-count">
                    <span class="${onlineClass}">${loginCount}</span>
                    <span class="${warmingClass}">${warmingCount}</span>
                </div>
            </div>`;
	}
	return html;
}

/** 生成玩家生涯武器数据base64图片 */
export async function generatePlayerLifeWeaponImage(playerData: PlayerLoadout): Promise<string> {
	const htmlFilePath = path.join(process.cwd(), `html/queryPlayer.html`);
	// 读取html模板
	const htmlContent = await fs.promises.readFile(htmlFilePath, "utf-8");

	const variables = {
		...playerData,
		currentTime: new Date().toLocaleString()
	};

	// 使用 ejs 渲染模板
	let replacedHtmlContent = ejs.render(htmlContent, variables);
	const weaponHtml = generateWeaponHtml(playerData.weapons);
	// 替换模板中的变量
	replacedHtmlContent = replacedHtmlContent.replace("{{AllWeaponDate}}", weaponHtml);

	const base64Image = await htmlToBase64Image(replacedHtmlContent);
	return base64Image;
}

/** 补全武器html */
export function generateWeaponHtml(weaponData: AllWeaponDate[]): string {
	const weapons = weaponData
		.map((category) => category.weapons)
		.flat()
		.sort((a, b) => b.kills - a.kills)
		.filter((weapon) => weapon.kills > 0);

	let html = "";
	weapons.forEach((weapon) => {
		html += `
          <tr>
              <td>${weapon.name || "无"}</td>
              <td>${weapon.kills || "无"}</td>
              <td>${weapon.kpm || "无"}</td>
              <td>${(weapon.seconds / 60 / 60).toFixed(1) || "无"}</td>
              <td>${((weapon.headshots / weapon.kills) * 100).toFixed(1) || "无"}%</td>
          </tr>
        `;
	});
	return html;
}
