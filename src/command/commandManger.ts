import { sendMsgToQQGroup, sendMsgToQQFriend } from "../qq/sendMessage";
import { readConfigFile } from "../utils/localFile";
import path from "path";
import logger from "../utils/logger";
import { SQLiteDB } from "../utils/sqlite";
import { Command, PrivateCommand } from "../interface/command";
import { ServerStatusCommand } from "./normal/serverStatus";
import { HelpCommand } from "./normal/help";
import { adminLevelName, getMemberInfo, isAdmin } from "../qq/memberManager";
import { QueryPlayerCommand } from "./normal/queryPlayer";
import { QueryBanPlayerCommand } from "./normal/queryBanPlayer";
import { GroupListCommand } from "./normal/groupList";
import { AiQueryPlayerCommand } from "./normal/aiQueryPlayer";
import { BindCommand } from "./normal/bind";
import { BlackListCommand } from "./normal/blackList";
import { BotListCommand } from "./normal/botList";
import { HistoryCommand } from "./normal/history";
import { LogCommand } from "./normal/log";
import { RankCommand } from "./normal/rank";
import { RecordCommand } from "./normal/record";
import { RootCommand } from "./normal/root";
import { AdminSayCommand } from "./admin1/adminSay";
import { BanPlayerCommand } from "./admin1/banPlayer";
import { CookieCommand } from "./admin1/cookie";
import { StartServerCommand } from "./admin1/startServer";
import { ServerSystemCommand } from "./admin2/serverSystem";
import { ClearMemberCommand } from "./admin3/clearMember";
import { PlatoonCommand } from "./admin2/platoon";
import { TrackPlayerCommand } from "./pay/trackPlayer";
import { SetAdminCommand } from "./admin3/setAdmin";
import { UpdateCommand } from "./admin1/update";
import { HelpPrivateCommand } from "./private/help";
import { CookiePrivateCommand } from "./private/cookie";
import { SetCookiePrivateCommand } from "./private/setCookieTag";
import { ServerConfigPrivateCommand } from "./private/serverConfig";
import { onRunRunMsg, onTvBotMsg } from "../qq/sendToRunRun";
import { CheckCommand } from "./admin1/check";
import { ServerConfigCommand } from "./admin3/serverConfig";
import { WarmCommand } from "./normal/warm";
import { BlackPlayerCommand } from "./admin2/blackPlayer";
import { ServerSayConfigCommand } from "./admin3/serverSayConfig";
import { ServerSayConfigPrivateCommand } from "./private/serverSayConfig";
import { SetWarmCommand } from "./admin2/setWarm";
import { UpdateBotCommand } from "./admin2/updateBot";
import { receiveGroupAllianceEvent } from "../qq/groupSystem/groupBan";
import { updateAiManager, updateFaceUrls } from "../qq/aiSay/aiManager";
import { EnableAiCommand } from "./admin2/enableAi";
import { ocrBfvName } from "../qq/qqOCR";
import { CurfewCommand } from "./admin2/curfew";
import { SuperCommand } from "./admin2/superCommand";
import { AllCommunityServer } from "./normal/allCommunityServer";
import { CXPlayerSayCommand } from "./normal/cxPlayerSay";

let commandManagers: CommandManager | null = null;
let privateCommandManagers: PrivateCommandManager | null = null;

const url = path.join(process.cwd(), "data", "groupReceiver.db");
const createTableSql = `CREATE TABLE IF NOT EXISTS groupReceiver (
    group_id INTEGER PRIMARY KEY,
    receiver_level INTEGER NOT NULL DEFAULT 0
)`;

const runrun_qq: number = 2854211804;
const tv_qq: number = 3889013937;

export async function commandManager(e: any): Promise<void> {
	// 读取配置文件
	const { admin_qq } = readConfigFile();
	const { message_type, group_id, user_id, message_id } = e;
	const message: string = e.raw_message.trim();

	// 实例化命令管理器
	if (!commandManagers) {
		commandManagers = new CommandManager();
	}
	// 处理私聊消息
	if (!privateCommandManagers) {
		privateCommandManagers = new PrivateCommandManager();
	}
	// 处理群聊消息
	if (message_type == "group") {
		const isInited = await isGroupInit(group_id);
		if (isInited) {
			if (user_id == admin_qq) {
				// 超管直接
				await commandManagers.processCommand(e, 4);
				return;
			}

			// 查看权限等级
			const adminLevel = await getMemberAdminLevel(e, admin_qq);
			// 处理命令
			await commandManagers.processCommand(e, adminLevel);
		} else {
			// 是否是超级管理员，且发送初始化命令
			if (user_id == admin_qq && message.trim().toLowerCase() == "init") {
				await initGroupDB(group_id, message_id);
			}
		}
	} else if (message_type == "private") {
		if (user_id == runrun_qq) {
			onRunRunMsg(e.raw_message);
			return;
		}
		if (user_id == tv_qq) {
			onTvBotMsg(e.raw_message);
			return;
		}

		if (user_id == admin_qq) {
			// 超管直接
			await privateCommandManagers.processCommand(e, 4);
			return;
		}

		// 处理私聊消息
		const result = await isAdmin(1, null, e.user_id);
		if (result.length > 0) {
			await privateCommandManagers.processCommand(e, result[0].admin_level);
		} else {
			sendMsgToQQFriend("你没有权限使用该功能", user_id);
		}
	}
}

/** 初始化群聊数据库 */
async function initGroupDB(group_id: number, message_id: number): Promise<void> {
	const db = new SQLiteDB(url, createTableSql);
	try {
		await db.open();
		const isExists = await isGroupInit(group_id);
		if (!isExists) {
			await db.execute(`INSERT INTO groupReceiver (group_id, receiver_level) VALUES (?, ?)`, [group_id, 0]);
			await sendMsgToQQGroup(group_id, `群聊: ${group_id} \n初始化成功!\n该群聊可以使用命令了~\n发送“help”查看命令列表`, message_id);
		} else {
			await sendMsgToQQGroup(group_id, `当前群聊已经初始化过了~`, message_id);
		}
		await db.close();
	} catch (error) {
		await sendMsgToQQGroup(group_id, `初始化群聊数据库失败：${error}`, message_id);
		logger.error(`初始化群聊数据库失败：${error}`);
		await db.close();
	}
}

/** 查询当前群聊是否已经初始化 */
export async function isGroupInit(group_id: number): Promise<boolean> {
	const db = new SQLiteDB(url, createTableSql);
	try {
		await db.open();
		const result = await db.query(`SELECT * FROM groupReceiver WHERE group_id = ?`, [group_id]);
		await db.close();
		if (result.length > 0) {
			return true;
		} else {
			return false;
		}
	} catch (error) {
		logger.error(`查询当前群聊是否已经初始化失败：${error}`);
		await db.close();
		return false;
	}
}

/** 查询所有初始化过的群聊 */
export async function getAllInitGroup(): Promise<number[]> {
	const db = new SQLiteDB(url, createTableSql);
	try {
		await db.open();
		const result = await db.query(`SELECT group_id FROM groupReceiver`);
		await db.close();
		return result.map((item) => item.group_id);
	} catch (error) {
		logger.error(`查询所有初始化过的群聊失败：${error}`);
		await db.close();
		return [];
	}
}

/** 获取权限等级 */
async function getMemberAdminLevel(e: any, admin_qq: number | null = null): Promise<number> {
	// 超级管理员
	if (admin_qq && e.user_id == admin_qq) {
		return 4;
	}
	// 群管理
	const receiverLevel = await getMemberInfo(e.group_id, e.user_id, null);
	if (receiverLevel.length > 0) {
		return receiverLevel[0].admin_level;
	} else {
		return 0;
	}
}

/** 命令管理器类 */
class CommandManager {
	private commands: Command[] = [];

	constructor() {
		this.loadCommands();
	}

	// 加载命令
	private async loadCommands(): Promise<void> {
		// normal commands
		this.commands.push(new HelpCommand());
		const { group_name: groupName } = await readConfigFile();
		this.commands.push(new ServerStatusCommand(groupName));
		this.commands.push(new QueryPlayerCommand());
		this.commands.push(new QueryBanPlayerCommand());
		this.commands.push(new GroupListCommand());
		this.commands.push(new AiQueryPlayerCommand());
		this.commands.push(new BindCommand());
		this.commands.push(new BlackListCommand());
		this.commands.push(new BotListCommand());
		this.commands.push(new HistoryCommand());
		this.commands.push(new LogCommand());
		this.commands.push(new RankCommand());
		this.commands.push(new RecordCommand());
		this.commands.push(new RootCommand());
		this.commands.push(new WarmCommand());
		this.commands.push(new AllCommunityServer());
		this.commands.push(new CXPlayerSayCommand());

		// admin1 commands
		this.commands.push(new AdminSayCommand());
		this.commands.push(new BanPlayerCommand());
		this.commands.push(new CookieCommand());
		this.commands.push(new StartServerCommand());
		this.commands.push(new UpdateCommand());
		this.commands.push(new CheckCommand());

		// admin2 commands
		this.commands.push(new BlackPlayerCommand());
		this.commands.push(new ServerSystemCommand());
		this.commands.push(new UpdateBotCommand());
		this.commands.push(new EnableAiCommand());
		this.commands.push(new CurfewCommand());
		this.commands.push(new SuperCommand());
		this.commands.push(new PlatoonCommand());

		// admin3 commands
		this.commands.push(new ClearMemberCommand());
		this.commands.push(new SetAdminCommand());
		this.commands.push(new ServerConfigCommand());
		this.commands.push(new ServerSayConfigCommand());
		this.commands.push(new SetWarmCommand());

		// pay commands
		this.commands.push(new TrackPlayerCommand());
	}

	/** 获取帮助信息 */
	private getHelpMessage(admin_level: number): string {
		let message1 = "========普通指令========\n";
		let message2 = "=======督战队指令=======\n";
		let message3 = "========都督指令========\n";
		let message4 = "========服主指令========\n";
		this.commands.forEach((cmd) => {
			if (admin_level < cmd.adminLevel) {
				return;
			}
			switch (cmd.adminLevel) {
				case 0:
					message1 += `${cmd.getInfo()}\n`;
					break;
				case 1:
					message2 += `${cmd.getInfo()}\n`;
					break;
				case 2:
					message3 += `${cmd.getInfo()}\n`;
					break;
				case 3:
					message4 += `${cmd.getInfo()}\n`;
					break;
				default:
					break;
			}
		});
		let message = "====[Zygo] Bot使用指南====\n";
		switch (admin_level) {
			case 0:
				message += message1;
				break;
			case 1:
				message += message1 + message2;
				break;
			case 2:
				message += message1 + message2 + message3;
				break;
			case 3:
				message += message1 + message2 + message3 + message4;
				break;
			case 4:
				message += message1 + message2 + message3 + message4;
				break;
			default:
				break;
		}
		return message;
	}

	/** 是否是命令 */
	public isCommand(command: string): boolean {
		return this.commands.some((cmd) => cmd.isMatch(command));
	}

	/** 匹配命令并执行 */
	public async processCommand(e: any, admin_level: number): Promise<void> {
		const command = e.raw_message.trim();
		const matchedCommand = this.commands.find((cmd) => cmd.isMatch(command));
		if (matchedCommand) {
			if (matchedCommand.regexContent == "help") {
				const message = this.getHelpMessage(admin_level);
				await sendMsgToQQGroup(e.group_id, message, e.message_id, null);
			} else {
				if (admin_level < matchedCommand.adminLevel) {
					await sendMsgToQQGroup(e.group_id, `您的权限不足\n需求权限: ${adminLevelName[matchedCommand.adminLevel]}`, e.message_id, null);
					return;
				}
				await matchedCommand.execute(e.raw_message, e.group_id, e.message_id, e.user_id);
			}
		} else {
			// 是否是图片
			if (e.message && e.message[0] && e.message[0].type == "image") {
				if (e.message[0].data.summary === "[动画表情]") {
					updateFaceUrls(e.message[0].data.url, e.group_id);
				} else {
					const result = await ocrBfvName(e.group_id, e.user_id, e.message[0].data.url);
					if (result) {
						await sendMsgToQQGroup(e.group_id, `尝试识别BFV玩家名称:\n${result}`, e.message_id, null);
					}
				}
			} else {
				// ai模块更新
				if (e.user_id == 2854211804 || e.user_id == 3889013937) {
					return;
				}
				updateAiManager(e.group_id, e.raw_message, e.nick_name);
			}
		}
	}
}

/** 私聊命令管理器类 */
class PrivateCommandManager {
	private commands: PrivateCommand[] = [];

	constructor() {
		this.loadCommands();
	}
	// 加载命令
	private loadCommands(): void {
		// admin1,2 commands
		this.commands.push(new HelpPrivateCommand());
		this.commands.push(new CookiePrivateCommand());
		// admin3 commands
		this.commands.push(new SetCookiePrivateCommand());
		this.commands.push(new ServerConfigPrivateCommand());
		this.commands.push(new ServerSayConfigPrivateCommand());
	}

	/** 是否是命令 */
	public isCommand(command: string): boolean {
		return this.commands.some((cmd) => cmd.isMatch(command));
	}

	/** 匹配命令并执行 */
	public async processCommand(e: any, admin_level: number): Promise<void> {
		const command = e.raw_message.trim();
		const matchedCommand = this.commands.find((cmd) => cmd.isMatch(command));
		if (matchedCommand) {
			if (matchedCommand.regexContent == "help") {
				const message = this.getHelpMessage(admin_level);
				await sendMsgToQQFriend(message, e.user_id);
			} else {
				if (admin_level < matchedCommand.adminLevel) {
					await sendMsgToQQFriend(`您的权限不足\n需求权限: ${adminLevelName[matchedCommand.adminLevel]}`, e.user_id);
					return;
				}
				await matchedCommand.execute(e.raw_message, e.message_id, e.user_id);
			}
		}
	}

	/** 获取帮助信息 */
	private getHelpMessage(admin_level: number): string {
		let message = "====[Zygo] Bot使用指南====\n";
		this.commands.forEach((cmd) => {
			if (admin_level < cmd.adminLevel) {
				return;
			}
			message += `${cmd.getInfo()}\n`;
		});
		return message;
	}
}
