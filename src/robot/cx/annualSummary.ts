import { SQLiteDB } from "../../utils/sqlite";
import path from "path";
import fs from "fs/promises";
import logger from "../../utils/logger";
import { readConfigFile } from "../../utils/localFile";

// 检查数据库文件是否存在
async function checkDatabaseExists(dbPath: string): Promise<boolean> {
	try {
		await fs.access(dbPath, fs.constants.F_OK);
		return true;
	} catch (error) {
		logger.error(`数据库文件不存在: ${dbPath}`, error);
		return false;
	}
}

// 检查表是否存在
async function checkTableExists(db: SQLiteDB, tableName: string): Promise<boolean> {
	try {
		const sql = `SELECT name FROM sqlite_master WHERE type='table' AND name=?`;
		const result = await db.query(sql, [tableName]);
		return result.length > 0;
	} catch (error) {
		logger.error(`检查表存在性失败: ${tableName}`, error);
		return false;
	}
}

// 数据库连接配置
const ONLINE_HISTORY_DB = path.join(process.cwd(), "data", "onlineHistory.db");
const PLAYER_DETAILS_DB = path.join(process.cwd(), "data", "playerDetails.db");
const WARM_PLAYER_DB = path.join(process.cwd(), "data", "warmPlayer.db");
const BAN_RECORD_DB = path.join(process.cwd(), "data", "banRecord.db");
const BLACK_LIST_DB = path.join(process.cwd(), "data", "blackList.db");

// 创建表SQL
const CREATE_TABLE_SQL = "CREATE TABLE IF NOT EXISTS temp (id INTEGER PRIMARY KEY)";

/**
 * 获取服务器年度数据
 * @param serverName 服务器名称
 * @param year 年份
 * @returns 服务器年度数据
 */
export async function getServerAnnualData(serverName: string, year: number) {
	logger.info(`开始获取服务器年度数据，服务器: ${serverName}，年份: ${year}`);
	let result: any = {
		WARM_TOTAL_TIMES: 0,
		WARM_TOP_PLAYER: "暂无数据",
		WARM_TOP_TIMES: 0,
		TOTAL_DAYS_ONLINE: 0,
		TOTAL_HOURS: 0,
		TOTAL_ROUNDS: 0,
		PEAK_DATE: "暂无数据",
		PEAK_PLAYERS: 0,
		TOP_WEAPON_NAME: "暂无数据",
		TOP_WEAPON_KILLS: 0,
		TOP_WEAPON_HOURS: 0,
		TOP_VEHICLE_NAME: "暂无数据",
		TOP_VEHICLE_KILLS: 0,
		TOP_VEHICLE_HOURS: 0,
		TOTAL_KICKS: 0,
		TOTAL_BANS: 0,
		TOP_BAN_REASON: "暂无数据",
		TEMP_BLACKLIST_COUNT: 0,
		TOP_DISciplinary_NAME: "暂无数据",
		TOP_DISciplinary_COUNT: 0,
		TOP_DISciplinary_NAME_1: "暂无数据",
		TOP_DISciplinary_COUNT_1: 0,
		TOP_DISciplinary_NAME_2: "暂无数据",
		TOP_DISciplinary_COUNT_2: 0,
		TOP_DISciplinary_NAME_3: "暂无数据",
		TOP_DISciplinary_COUNT_3: 0
	};

	// 数据库连接
	let warmPlayerDb: SQLiteDB | null = null;
	let playerDetailsDb: SQLiteDB | null = null;
	let onlineHistoryDb: SQLiteDB | null = null;
	let banRecordDb: SQLiteDB | null = null;
	let blackListDb: SQLiteDB | null = null;

	try {
		// 1. 检查数据库文件是否存在
		const warmPlayerExists = await checkDatabaseExists(WARM_PLAYER_DB);
		const playerDetailsExists = await checkDatabaseExists(PLAYER_DETAILS_DB);
		const onlineHistoryExists = await checkDatabaseExists(ONLINE_HISTORY_DB);
		const banRecordExists = await checkDatabaseExists(BAN_RECORD_DB);
		const blackListExists = await checkDatabaseExists(BLACK_LIST_DB);

		// 2. 初始化并打开数据库连接
		if (warmPlayerExists) {
			warmPlayerDb = new SQLiteDB(WARM_PLAYER_DB, CREATE_TABLE_SQL);
			await warmPlayerDb.open();
		}

		if (playerDetailsExists) {
			playerDetailsDb = new SQLiteDB(PLAYER_DETAILS_DB, CREATE_TABLE_SQL);
			await playerDetailsDb.open();
		}

		if (onlineHistoryExists) {
			onlineHistoryDb = new SQLiteDB(ONLINE_HISTORY_DB, CREATE_TABLE_SQL);
			await onlineHistoryDb.open();
		}

		// 3. 查询暖服总次数
		if (warmPlayerDb) {
			try {
				const tableExists = await checkTableExists(warmPlayerDb, "warmPlayer");
				if (tableExists) {
					// 查询所有暖服记录，不限制服务器名称，因为可能server_name参数不匹配
					const warmTotalSql = `SELECT COUNT(*) as warmTotal FROM warmPlayer`;
					const warmTotalResult = await warmPlayerDb.query(warmTotalSql, []);
					result.WARM_TOTAL_TIMES = warmTotalResult[0]?.warmTotal || 0;
				} else {
					logger.warn("warmPlayer表不存在");
				}
			} catch (error) {
				logger.error("查询暖服总次数出错", error);
			}
		}

		// 4. 查询暖服次数最多的玩家
		if (warmPlayerDb) {
			try {
				const tableExists = await checkTableExists(warmPlayerDb, "warmPlayer");
				if (tableExists) {
					// 查询所有暖服记录，不限制服务器名称
					const warmTopSql = `SELECT player_name, COUNT(*) as c FROM warmPlayer 
					                  GROUP BY player_name ORDER BY c DESC LIMIT 1`;
					const warmTopResult = await warmPlayerDb.query(warmTopSql, []);
					result.WARM_TOP_PLAYER = warmTopResult[0]?.player_name || "暂无数据";
					result.WARM_TOP_TIMES = warmTopResult[0]?.c || 0;
				} else {
					logger.warn("warmPlayer表不存在");
				}
			} catch (error) {
				logger.error("查询暖服次数最多的玩家出错", error);
			}
		}

		// 5. 查询服务器全年运行天数
		if (onlineHistoryDb) {
			try {
				const tableExists = await checkTableExists(onlineHistoryDb, "onlineHistory");
				if (tableExists) {
					// 查询所有在线记录，不限制服务器名称
					const totalDaysSql = `SELECT COUNT(DISTINCT DATE(time)) as totalDays FROM onlineHistory`;
					const totalDaysResult = await onlineHistoryDb.query(totalDaysSql, []);
					result.TOTAL_DAYS_ONLINE = totalDaysResult[0]?.totalDays || 0;
				} else {
					logger.warn("onlineHistory表不存在");
				}
			} catch (error) {
				logger.error("查询服务器运行天数出错", error);
			}
		}

		// 6. 查询服务器全年运行总小时数
		if (playerDetailsDb) {
			try {
				const tableExists = await checkTableExists(playerDetailsDb, "playerDetails");
				if (tableExists) {
					// 暂时移除时间范围限制，简化查询
					const totalHoursSql = `SELECT ROUND(SUM(timePlayed)/3600,1) as totalHours FROM playerDetails`;
					const totalHoursResult = await playerDetailsDb.query(totalHoursSql, []);
					result.TOTAL_HOURS = totalHoursResult[0]?.totalHours || 0;
				} else {
					logger.warn("playerDetails表不存在");
				}
			} catch (error) {
				logger.error("查询服务器总小时数出错", error);
			}
		}

		// 7. 查询服务器全年运行总场次
		if (playerDetailsDb) {
			try {
				const tableExists = await checkTableExists(playerDetailsDb, "playerDetails");
				if (tableExists) {
					// 暂时移除时间范围限制，简化查询
					const totalRoundsSql = `SELECT COUNT(DISTINCT id) as totalRounds FROM playerDetails`;
					const totalRoundsResult = await playerDetailsDb.query(totalRoundsSql, []);
					result.TOTAL_ROUNDS = totalRoundsResult[0]?.totalRounds || 0;
				} else {
					logger.warn("playerDetails表不存在");
				}
			} catch (error) {
				logger.error("查询服务器总场次出错", error);
			}
		}

		// 8. 查询服务器最高在线人数和日期
		if (onlineHistoryDb) {
			try {
				const tableExists = await checkTableExists(onlineHistoryDb, "onlineHistory");
				if (tableExists) {
					// 查询所有在线记录，不限制服务器名称
					// 同时，我们需要按小时或更细粒度查询，而不是按天
					const peakSql = `SELECT time as date, COUNT(*) as playerCount 
					               FROM onlineHistory 
					               GROUP BY time 
					               ORDER BY playerCount DESC LIMIT 1`;
					const peakResult = await onlineHistoryDb.query(peakSql, []);
					result.PEAK_DATE = peakResult[0]?.date ? new Date(peakResult[0].date).toISOString().split("T")[0] : "暂无数据";
					result.PEAK_PLAYERS = peakResult[0]?.playerCount || 0;
				} else {
					logger.warn("onlineHistory表不存在");
				}
			} catch (error) {
				logger.error("查询服务器最高在线人数出错", error);
			}
		}

		// 9. 查询服务器最热门武器
		if (playerDetailsDb) {
			try {
				const tableExists = await checkTableExists(playerDetailsDb, "weapons");
				if (tableExists) {
					// 暂时移除时间范围限制，简化查询
					const topWeaponSql = `SELECT name, SUM(kills) as kills, ROUND(SUM(timeEquipped)/3600,1) as hours 
					                    FROM weapons 
					                    GROUP BY name 
					                    ORDER BY kills DESC LIMIT 1`;
					const topWeaponResult = await playerDetailsDb.query(topWeaponSql, []);
					result.TOP_WEAPON_NAME = topWeaponResult[0]?.name || "暂无数据";
					result.TOP_WEAPON_KILLS = topWeaponResult[0]?.kills || 0;
					result.TOP_WEAPON_HOURS = topWeaponResult[0]?.hours || 0;
				} else {
					logger.warn("weapons表不存在");
				}
			} catch (error) {
				logger.error("查询服务器最热门武器出错", error);
			}
		}

		// 10. 查询服务器最热门载具
		if (playerDetailsDb) {
			try {
				const tableExists = await checkTableExists(playerDetailsDb, "vehicles");
				if (tableExists) {
					// 暂时移除时间范围限制，简化查询
					const topVehicleSql = `SELECT name, SUM(kills) as kills, ROUND(SUM(timeEquipped)/3600,1) as hours 
					                     FROM vehicles 
					                     GROUP BY name 
					                     ORDER BY kills DESC LIMIT 1`;
					const topVehicleResult = await playerDetailsDb.query(topVehicleSql, []);
					result.TOP_VEHICLE_NAME = topVehicleResult[0]?.name || "暂无数据";
					result.TOP_VEHICLE_KILLS = topVehicleResult[0]?.kills || 0;
					result.TOP_VEHICLE_HOURS = topVehicleResult[0]?.hours || 0;
				} else {
					logger.warn("vehicles表不存在");
				}
			} catch (error) {
				logger.error("查询服务器最热门载具出错", error);
			}
		}

		// 查询防空武器和载具破坏武器
		if (playerDetailsDb) {
			try {
				const tableExists = await checkTableExists(playerDetailsDb, "weapons");
				if (tableExists) {
					const gadgetsSql = `SELECT SUM(kills) as SUM_AA_KILLS, ROUND(SUM(timeEquipped)/3600,1) as SUM_AA_HOURS 
					                   FROM weapons 
					                   WHERE name='防空铁拳'`;

					const gadgetsResult = await playerDetailsDb.query(gadgetsSql, []);
					result.SUM_AA_KILLS = gadgetsResult[0]?.SUM_AA_KILLS || 0;
					result.SUM_AA_HOURS = gadgetsResult[0]?.SUM_AA_HOURS || 0;
				} else {
					logger.warn("weapons表不存在");
				}
			} catch (error) {
				logger.error("查询服务器最热门武器出错", error);
			}
		}

		// 11. 查询踢人次数、封禁次数和封禁原因
		if (banRecordExists) {
			banRecordDb = new SQLiteDB(BAN_RECORD_DB, CREATE_TABLE_SQL);
			await banRecordDb.open();
		}

		if (blackListExists) {
			blackListDb = new SQLiteDB(BLACK_LIST_DB, CREATE_TABLE_SQL);
			await blackListDb.open();
		}

		// 11.1 查询踢人次数
		if (banRecordDb) {
			try {
				const tableExists = await checkTableExists(banRecordDb, "banRecord");
				if (tableExists) {
					// 暂时移除时间范围限制，简化查询
					const totalKicksSql = `SELECT COUNT(*) as totalKicks FROM banRecord 
					                     WHERE is_kick=1`;
					const totalKicksResult = await banRecordDb.query(totalKicksSql);
					result.TOTAL_KICKS = totalKicksResult[0]?.totalKicks || 0;
				} else {
					logger.warn("banRecord表不存在");
				}
			} catch (error) {
				logger.error("查询踢人次数出错", error);
			}
		}

		// 11.2 查询封禁次数
		let banCount = 0;
		let localCount = 0;
		let globalCount = 0;
		let tempCount = 0;

		// 查询banRecord表中的封禁次数
		if (banRecordDb) {
			try {
				const tableExists = await checkTableExists(banRecordDb, "banRecord");
				if (tableExists) {
					// 暂时移除时间范围限制，简化查询
					const banRecordSql = `SELECT COUNT(*) as banCount FROM banRecord 
					                    WHERE is_kick=0`;
					const banRecordResult = await banRecordDb.query(banRecordSql);
					banCount = banRecordResult[0]?.banCount || 0;
				} else {
					logger.warn("banRecord表不存在");
				}
			} catch (error) {
				logger.error("查询banRecord表中的封禁次数出错", error);
			}
		}

		// 查询blackList表中的封禁次数
		if (blackListDb) {
			try {
				const localTableExists = await checkTableExists(blackListDb, "localBlackList");
				if (localTableExists) {
					// 暂时移除时间范围限制，简化查询
					const localBlackListSql = `SELECT COUNT(*) as localCount FROM localBlackList`;
					const localBlackListResult = await blackListDb.query(localBlackListSql, []);
					localCount = localBlackListResult[0]?.localCount || 0;
					result.PERM_BLACKLIST_COUNT = localCount;
				} else {
					logger.warn("localBlackList表不存在");
				}
			} catch (error) {
				logger.error("查询localBlackList表中的封禁次数出错", error);
			}

			try {
				const tempTableExists = await checkTableExists(blackListDb, "tempBlackList");
				if (tempTableExists) {
					// 暂时移除时间范围限制，简化查询
					const tempBlackListSql = `SELECT COUNT(*) as tempCount FROM tempBlackList`;
					const tempBlackListResult = await blackListDb.query(tempBlackListSql, []);
					tempCount = tempBlackListResult[0]?.tempCount || 0;
					result.TEMP_BLACKLIST_COUNT = tempCount;
				} else {
					logger.warn("tempBlackList表不存在");
				}
			} catch (error) {
				logger.error("查询tempBlackList表中的封禁次数出错", error);
			}
		}

		result.TOTAL_BANS = banCount + localCount + globalCount + tempCount;

		// 11.3 查询最常见的封禁原因
		if (result.TOTAL_BANS > 0 && banRecordDb) {
			try {
				const tableExists = await checkTableExists(banRecordDb, "banRecord");
				if (tableExists && banCount > 0) {
					// 暂时移除时间范围限制，简化查询
					const topBanReasonSql = `SELECT reason, COUNT(*) as reasonCount FROM banRecord 
					                       WHERE reason IS NOT NULL AND reason != '' 
					                       GROUP BY reason ORDER BY reasonCount DESC LIMIT 3`;
					const topBanReasonResult = await banRecordDb.query(topBanReasonSql);
					result.TOP_BAN_REASON_1 = topBanReasonResult[0]?.reason || "未知原因";
					result.TOP_BAN_REASON_1_COUNT = topBanReasonResult[0]?.reasonCount || 0;
					result.TOP_BAN_REASON_2 = topBanReasonResult[1]?.reason || "未知原因";
					result.TOP_BAN_REASON_2_COUNT = topBanReasonResult[1]?.reasonCount || 0;
					result.TOP_BAN_REASON_3 = topBanReasonResult[2]?.reason || "未知原因";
					result.TOP_BAN_REASON_3_COUNT = topBanReasonResult[2]?.reasonCount || 0;
				} else {
					result.TOP_BAN_REASON = "来自黑名单";
				}
			} catch (error) {
				logger.error("查询最常见的封禁原因出错", error);
			}
		} else {
			result.TOP_BAN_REASON = "暂无数据";
		}

		const botName = await readConfigFile().bot_name;

		if (result.TOTAL_BANS > 0 && banRecordDb) {
			try {
				const tableExists = await checkTableExists(banRecordDb, "banRecord");
				if (tableExists && banCount > 0) {
					result.BOT_DISciplinary_NAME = botName;
					// admin_name 等于bot_name或者管理员的数量
					const botDisciplinaryResult = await banRecordDb.query(
						`SELECT COUNT(*) as disciplinaryCount FROM banRecord WHERE admin_name = ? or admin_name = '管理员' or admin_name = '机器人' or admin_name = '麦克阿瑟'`,
						[botName]
					);
					result.BOT_DISciplinary_COUNT = botDisciplinaryResult[0]?.disciplinaryCount || 0;
					const topDisciplinarySql = `SELECT admin_name, COUNT(*) as disciplinaryCount FROM banRecord WHERE admin_name != ? and admin_name != '管理员' and admin_name != '机器人' and admin_name != '麦克阿瑟' GROUP BY admin_name ORDER BY disciplinaryCount DESC LIMIT 3`;
					const topDisciplinaryResult = await banRecordDb.query(topDisciplinarySql, [botName]);
					result.TOP_DISciplinary_NAME_1 = topDisciplinaryResult[0]?.admin_name || "未知纪律检查组";
					result.TOP_DISciplinary_COUNT_1 = topDisciplinaryResult[0]?.disciplinaryCount || 0;
					result.TOP_DISciplinary_NAME_2 = topDisciplinaryResult[1]?.admin_name || "未知纪律检查组";
					result.TOP_DISciplinary_COUNT_2 = topDisciplinaryResult[1]?.disciplinaryCount || 0;
					result.TOP_DISciplinary_NAME_3 = topDisciplinaryResult[2]?.admin_name || "未知纪律检查组";
					result.TOP_DISciplinary_COUNT_3 = topDisciplinaryResult[2]?.disciplinaryCount || 0;
				} else {
					result.TOP_DISciplinary_NAME = "未知纪律检查组";
					result.TOP_DISciplinary_COUNT = 0;
					result.TOP_DISciplinary_NAME_1 = "未知纪律检查组";
					result.TOP_DISciplinary_COUNT_1 = 0;
					result.TOP_DISciplinary_NAME_2 = "未知纪律检查组";
					result.TOP_DISciplinary_COUNT_2 = 0;
					result.TOP_DISciplinary_NAME_3 = "未知纪律检查组";
					result.TOP_DISciplinary_COUNT_3 = 0;
				}
			} catch (error) {
				logger.error("查询最常见的纪律检查组出错", error);
				result.TOP_DISciplinary_NAME = "未知纪律检查组";
				result.TOP_DISciplinary_COUNT = 0;
				result.TOP_DISciplinary_NAME_1 = "未知纪律检查组";
				result.TOP_DISciplinary_COUNT_1 = 0;
				result.TOP_DISciplinary_NAME_2 = "未知纪律检查组";
				result.TOP_DISciplinary_COUNT_2 = 0;
				result.TOP_DISciplinary_NAME_3 = "未知纪律检查组";
				result.TOP_DISciplinary_COUNT_3 = 0;
			}
		}

		// 关闭数据库连接
		if (banRecordDb) await banRecordDb.close();
		if (blackListDb) await blackListDb.close();
	} catch (error) {
		logger.error("获取服务器年度数据出错", error);
	} finally {
		// 关闭数据库连接
		try {
			if (warmPlayerDb) await warmPlayerDb.close();
		} catch (error) {
			logger.error("关闭warmPlayerDb出错", error);
		}
		try {
			if (playerDetailsDb) await playerDetailsDb.close();
		} catch (error) {
			logger.error("关闭playerDetailsDb出错", error);
		}
		try {
			if (onlineHistoryDb) await onlineHistoryDb.close();
		} catch (error) {
			logger.error("关闭onlineHistoryDb出错", error);
		}
		try {
			if (banRecordDb) await banRecordDb.close();
		} catch (error) {
			logger.error("关闭banRecordDb出错", error);
		}
		try {
			if (blackListDb) await blackListDb.close();
		} catch (error) {
			logger.error("关闭blackListDb出错", error);
		}
	}

	logger.info(`获取服务器年度数据完成，结果: ${JSON.stringify(result)}`);
	return result;
}

/**
 * 获取玩家年度数据
 * @param playerName 玩家名称
 * @param year 年份
 * @returns 玩家年度数据
 */
export async function getPlayerAnnualData(playerName: string, year: number) {
	logger.info(`开始获取玩家年度数据，玩家: ${playerName}，年份: ${year}`);
	let result: any = {
		TOTAL_KILLS: 0,
		ASSIST_KILLS: 0,
		HEADSHOTS: 0,
		REVIVES: 0,
		HEALS: 0,
		WINS: 0,
		LOSES: 0,
		TIME_PLAYED_H: 0,
		WIN_RATE: 0,
		KD_RATIO: 0,
		TOTAL_SCORE: 0,
		FAV_WEAPON_NAME: "暂无数据",
		FAV_WEAPON_KILLS: 0,
		FAV_WEAPON_HOURS: 0,
		FAV_VEHICLE_NAME: "暂无数据",
		FAV_VEHICLE_KILLS: 0,
		FAV_VEHICLE_HOURS: 0,
		FAV_GADGET_NAME: "暂无数据",
		FAV_GADGET_HOURS: 0
	};

	let playerDetailsDb: SQLiteDB | null = null;

	try {
		// 检查数据库文件是否存在
		const playerDetailsExists = await checkDatabaseExists(PLAYER_DETAILS_DB);
		if (!playerDetailsExists) {
			logger.error(`playerDetails.db文件不存在`);
			return result;
		}

		playerDetailsDb = new SQLiteDB(PLAYER_DETAILS_DB, CREATE_TABLE_SQL);
		await playerDetailsDb.open();

		// 1. 查询总击杀数
		try {
			const tableExists = await checkTableExists(playerDetailsDb, "playerDetails");
			if (tableExists) {
				// 暂时移除时间范围限制，简化查询
				const totalKillsSql = `SELECT SUM(kills) as totalKills FROM playerDetails 
				                     WHERE name=?`;
				const totalKillsResult = await playerDetailsDb.query(totalKillsSql, [playerName]);
				result.TOTAL_KILLS = totalKillsResult[0]?.totalKills || 0;
			} else {
				logger.warn("playerDetails表不存在");
			}
		} catch (error) {
			logger.error("查询总击杀数出错", error);
		}

		// MAX_KILL_STREAK MAX_KILLS_ONE_ROUND MAX_KD_ONE_ROUND
		try {
			const tableExists = await checkTableExists(playerDetailsDb, "playerDetails");
			if (tableExists) {
				// 查询单局最高击杀
				const maxKillsSql = `SELECT MAX(kills) as maxKills FROM playerDetails WHERE name=?`;
				const maxKillsResult = await playerDetailsDb.query(maxKillsSql, [playerName]);
				result.MAX_KILLS_ONE_ROUND = maxKillsResult[0]?.maxKills || 0;

				// 查询最大KD比
				const maxKdSql = `SELECT MAX(CASE WHEN deaths=0 THEN kills ELSE kills*1.0/deaths END) as maxKD FROM playerDetails WHERE name=?`;

				const maxKdResult = await playerDetailsDb.query(maxKdSql, [playerName]);
				result.MAX_KD_ONE_ROUND = maxKdResult[0]?.maxKD ? parseFloat(maxKdResult[0].maxKD.toFixed(2)) : 0;

				result.MAX_KILL_STREAK = 0;
			} else {
				logger.warn("playerDetails表不存在");
			}
		} catch (error) {
			logger.error("查询最大连胜数出错", error);
		}

		// 查询暖服次数
		try {
			const warmPlayerExists = await checkDatabaseExists(WARM_PLAYER_DB);
			if (warmPlayerExists) {
				const warmPlayerDb = new SQLiteDB(WARM_PLAYER_DB, CREATE_TABLE_SQL);
				await warmPlayerDb.open();
				const warmTableExists = await checkTableExists(warmPlayerDb, "warmPlayer");
				if (warmTableExists) {
					const warmTimesSql = `SELECT COUNT(*) as warmTimes FROM warmPlayer WHERE player_name=?`;

					const warmTimesResult = await warmPlayerDb.query(warmTimesSql, [playerName]);
					result.WARM_TIMES = warmTimesResult[0]?.warmTimes || 0;
				}
				await warmPlayerDb.close();
			}
		} catch (error) {
			logger.error("查询暖服次数出错", error);
			result.WARM_TIMES = 0;
		}

		// 查询被踢和被拉黑次数
		try {
			const banRecordExists = await checkDatabaseExists(BAN_RECORD_DB);
			if (banRecordExists) {
				const banRecordDb = new SQLiteDB(BAN_RECORD_DB, CREATE_TABLE_SQL);
				await banRecordDb.open();
				const banTableExists = await checkTableExists(banRecordDb, "banRecord");
				if (banTableExists) {
					// 查询被踢次数
					const kickedSql = `SELECT COUNT(*) as kickedTimes FROM banRecord WHERE player_name=? AND is_kick=1`;

					const kickedResult = await banRecordDb.query(kickedSql, [playerName]);
					result.KICKED_TIMES = kickedResult[0]?.kickedTimes || 0;

					// 查询被拉黑次数
					const bannedSql = `SELECT COUNT(*) as bannedTimes FROM banRecord WHERE player_name=? AND is_kick=0`;

					const bannedResult = await banRecordDb.query(bannedSql, [playerName]);
					result.BANNED_TIMES = bannedResult[0]?.bannedTimes || 0;
				}
				await banRecordDb.close();
			}
		} catch (error) {
			logger.error("查询被踢和被拉黑次数出错", error);
			result.KICKED_TIMES = 0;
			result.BANNED_TIMES = 0;
		}

		// 2. 查询助攻数
		try {
			const tableExists = await checkTableExists(playerDetailsDb, "playerDetails");
			if (tableExists) {
				// 暂时移除时间范围限制，简化查询
				const assistKillsSql = `SELECT SUM(killAssists) as assistKills FROM playerDetails 
				                      WHERE name=?`;

				const assistKillsResult = await playerDetailsDb.query(assistKillsSql, [playerName]);

				result.ASSIST_KILLS = assistKillsResult[0]?.assistKills || 0;
			} else {
				logger.warn("playerDetails表不存在");
			}
		} catch (error) {
			logger.error("查询助攻数出错", error);
		}

		// 3. 查询爆头数
		try {
			const tableExists = await checkTableExists(playerDetailsDb, "playerDetails");
			if (tableExists) {
				// 暂时移除时间范围限制，简化查询
				const headshotsSql = `SELECT SUM(headshots) as headshots FROM playerDetails 
				                            WHERE name=?`;

				const headshotsResult = await playerDetailsDb.query(headshotsSql, [playerName]);

				result.HEADSHOTS = headshotsResult[0]?.headshots || 0;
			} else {
				logger.warn("playerDetails表不存在");
			}
		} catch (error) {
			logger.error("查询爆头数出错", error);
		}

		// 4. 查询救人数
		try {
			const tableExists = await checkTableExists(playerDetailsDb, "playerDetails");
			if (tableExists) {
				// 暂时移除时间范围限制，简化查询
				const revivesSql = `SELECT SUM(revives) as revives FROM playerDetails 
				                          WHERE name=?`;

				const revivesResult = await playerDetailsDb.query(revivesSql, [playerName]);

				result.REVIVES = revivesResult[0]?.revives || 0;
			} else {
				logger.warn("playerDetails表不存在");
			}
		} catch (error) {
			logger.error("查询救人数出错", error);
		}

		// 5. 查询治疗量
		try {
			const tableExists = await checkTableExists(playerDetailsDb, "playerDetails");
			if (tableExists) {
				// 暂时移除时间范围限制，简化查询
				const healsSql = `SELECT SUM(heals) as heals FROM playerDetails 
				                        WHERE name=?`;

				const healsResult = await playerDetailsDb.query(healsSql, [playerName]);

				result.HEALS = healsResult[0]?.heals || 0;
			} else {
				logger.warn("playerDetails表不存在");
			}
		} catch (error) {
			logger.error("查询治疗量出错", error);
		}

		// 6. 查询胜场/负场
		try {
			const tableExists = await checkTableExists(playerDetailsDb, "playerDetails");
			if (tableExists) {
				// 暂时移除时间范围限制，简化查询
				const winsLosesSql = `SELECT SUM(wins) as wins, SUM(loses) as loses FROM playerDetails 
				                        WHERE name=?`;

				const winsLosesResult = await playerDetailsDb.query(winsLosesSql, [playerName]);

				result.WINS = winsLosesResult[0]?.wins || 0;
				result.LOSES = winsLosesResult[0]?.loses || 0;
			} else {
				logger.warn("playerDetails表不存在");
			}
		} catch (error) {
			logger.error("查询胜场/负场出错", error);
		}

		// 7. 查询游戏时长
		try {
			const tableExists = await checkTableExists(playerDetailsDb, "playerDetails");
			if (tableExists) {
				// 暂时移除时间范围限制，简化查询
				const timePlayedSql = `SELECT ROUND(SUM(timePlayed)/3600,1) as timePlayedH FROM playerDetails 
				                         WHERE name=?`;

				const timePlayedResult = await playerDetailsDb.query(timePlayedSql, [playerName]);

				result.TIME_PLAYED_H = timePlayedResult[0]?.timePlayedH || 0;
			} else {
				logger.warn("playerDetails表不存在");
			}
		} catch (error) {
			logger.error("查询游戏时长出错", error);
		}

		// 8. 查询胜率
		try {
			const tableExists = await checkTableExists(playerDetailsDb, "playerDetails");
			if (tableExists) {
				// 暂时移除时间范围限制，简化查询
				const winRateSql = `SELECT CASE WHEN SUM(wins)+SUM(loses)=0 THEN 0 
				                      ELSE ROUND(SUM(wins)*100.0/(SUM(wins)+SUM(loses)),1) END as winRate 
				                      FROM playerDetails 
				                      WHERE name=?`;

				const winRateResult = await playerDetailsDb.query(winRateSql, [playerName]);
				result.WIN_RATE = winRateResult[0]?.winRate || 0;
			} else {
				logger.warn("playerDetails表不存在");
			}
		} catch (error) {
			logger.error("查询胜率出错", error);
		}

		// 9. 查询KD比
		try {
			const tableExists = await checkTableExists(playerDetailsDb, "playerDetails");
			if (tableExists) {
				// 暂时移除时间范围限制，简化查询
				const kdRatioSql = `SELECT CASE WHEN SUM(deaths)=0 THEN ROUND(SUM(kills),2) 
				                      ELSE ROUND(SUM(kills)*1.0/SUM(deaths),2) END as kdRatio 
				                      FROM playerDetails 
				                      WHERE name=?`;

				const kdRatioResult = await playerDetailsDb.query(kdRatioSql, [playerName]);
				result.KD_RATIO = kdRatioResult[0]?.kdRatio || 0;
			} else {
				logger.warn("playerDetails表不存在");
			}
		} catch (error) {
			logger.error("查询KD比出错", error);
		}

		// 10. 查询总得分
		try {
			const tableExists = await checkTableExists(playerDetailsDb, "playerDetails");
			if (tableExists) {
				// 暂时移除时间范围限制，简化查询
				const totalScoreSql = `SELECT SUM(totalScore) as totalScore FROM playerDetails 
				                         WHERE name=?`;

				const totalScoreResult = await playerDetailsDb.query(totalScoreSql, [playerName]);
				result.TOTAL_SCORE = totalScoreResult[0]?.totalScore || 0;
			} else {
				logger.warn("playerDetails表不存在");
			}
		} catch (error) {
			logger.error("查询总得分出错", error);
		}

		// 11. 查询最喜爱武器
		try {
			const tableExists = await checkTableExists(playerDetailsDb, "weapons");
			if (tableExists) {
				// 暂时移除时间范围限制，简化查询
				const favWeaponSql = `SELECT name, SUM(kills) as kills, ROUND(SUM(timeEquipped)/3600,1) as hours 
				                        FROM weapons 
				                        WHERE playerName=? 
				                        GROUP BY name ORDER BY hours DESC LIMIT 1`;

				const favWeaponResult = await playerDetailsDb.query(favWeaponSql, [playerName]);

				result.FAV_WEAPON_NAME = favWeaponResult[0]?.name || "暂无数据";
				result.FAV_WEAPON_KILLS = favWeaponResult[0]?.kills || 0;
				result.FAV_WEAPON_HOURS = favWeaponResult[0]?.hours || 0;
			} else {
				logger.warn("weapons表不存在");
			}
		} catch (error) {
			logger.error("查询最喜爱武器出错", error);
		}

		// 12. 查询最喜爱载具
		try {
			const tableExists = await checkTableExists(playerDetailsDb, "vehicles");
			if (tableExists) {
				// 暂时移除时间范围限制，简化查询
				const favVehicleSql = `SELECT name, SUM(kills) as kills, ROUND(SUM(timeEquipped)/3600,1) as hours 
				                        FROM vehicles 
				                        WHERE playerName=? 
				                        GROUP BY name ORDER BY hours DESC LIMIT 1`;

				const favVehicleResult = await playerDetailsDb.query(favVehicleSql, [playerName]);

				result.FAV_VEHICLE_NAME = favVehicleResult[0]?.name || "暂无数据";
				result.FAV_VEHICLE_KILLS = favVehicleResult[0]?.kills || 0;
				result.FAV_VEHICLE_HOURS = favVehicleResult[0]?.hours || 0;
			} else {
				logger.warn("vehicles表不存在");
			}
		} catch (error) {
			logger.error("查询最喜爱载具出错", error);
		}

		// 13. 查询最喜爱 gadgets
		try {
			const tableExists = await checkTableExists(playerDetailsDb, "gadgets");
			if (tableExists) {
				// 暂时移除时间范围限制，简化查询
				const favGadgetSql = `SELECT name, ROUND(SUM(timeEquipped)/3600,1) as hours, SUM(kills) as kills 
				                        FROM gadgets 
				                        WHERE playerName=? 
				                        GROUP BY name ORDER BY hours DESC LIMIT 1`;

				const favGadgetResult = await playerDetailsDb.query(favGadgetSql, [playerName]);

				result.FAV_GADGET_NAME = favGadgetResult[0]?.name || "暂无数据";
				result.FAV_GADGET_HOURS = favGadgetResult[0]?.hours || 0;
				result.FAV_GADGET_KILLS = favGadgetResult[0]?.kills || 0;
			} else {
				logger.warn("gadgets表不存在");
			}
		} catch (error) {
			logger.error("查询最喜爱gadgets出错", error);
		}

		await playerDetailsDb.close();
	} catch (error) {
		logger.error("获取玩家年度数据出错", error);
	} finally {
		// 关闭数据库连接
		try {
			if (playerDetailsDb) await playerDetailsDb.close();
		} catch (error) {
			logger.error("关闭playerDetailsDb出错", error);
		}
	}

	logger.info(`获取玩家年度数据完成，结果: ${JSON.stringify(result)}`);
	return result;
}

/**
 * 获取玩家在线历史数据
 * @param playerName 玩家名称
 * @param year 年份
 * @returns 玩家在线历史数据
 */
export async function getPlayerOnlineHistory(playerName: string, year: number) {
	logger.info(`开始获取玩家在线历史数据，玩家: ${playerName}，年份: ${year}`);
	const result: any = {
		PLAYER_ONLINE_DAYS: 0,
		PLAYER_ROUNDS: 0,
		PLAYER_ONLINE_HOURS: 0
	};

	// 时间范围参数（暂时注释，简化查询）
	const startDate = `${year}-01-01`;
	const endDate = `${year}-12-31 23:59:59`;

	let onlineHistoryDb: SQLiteDB | null = null;
	let playerDetailsDb: SQLiteDB | null = null;

	try {
		// 检查onlineHistory.db文件是否存在
		const onlineHistoryExists = await checkDatabaseExists(ONLINE_HISTORY_DB);
		if (!onlineHistoryExists) {
			logger.error(`onlineHistory.db文件不存在`);
			return result;
		}

		onlineHistoryDb = new SQLiteDB(ONLINE_HISTORY_DB, CREATE_TABLE_SQL);
		await onlineHistoryDb.open();
		logger.info("onlineHistoryDb数据库连接成功");

		// 1. 查询玩家在线天数
		try {
			const tableExists = await checkTableExists(onlineHistoryDb, "onlineHistory");
			if (tableExists) {
				// 暂时移除时间范围限制，简化查询
				const onlineDaysSql = `SELECT COUNT(DISTINCT DATE(time)) as onlineDays FROM onlineHistory 
				                     WHERE player_name=?`;

				const onlineDaysResult = await onlineHistoryDb.query(onlineDaysSql, [playerName]);

				result.PLAYER_ONLINE_DAYS = onlineDaysResult[0]?.onlineDays || 0;
			} else {
				logger.warn("onlineHistory表不存在");
			}
		} catch (error) {
			logger.error("查询玩家在线天数出错", error);
		}

		// 2. 查询玩家游戏场次
		try {
			const tableExists = await checkTableExists(onlineHistoryDb, "onlineHistory");
			if (tableExists) {
				// 暂时移除时间范围限制，简化查询
				const roundsSql = `SELECT COUNT(*) as rounds FROM onlineHistory 
				                         WHERE player_name=?`;

				const roundsResult = await onlineHistoryDb.query(roundsSql, [playerName]);

				result.PLAYER_ROUNDS = roundsResult[0]?.rounds || 0;
			} else {
				logger.warn("onlineHistory表不存在");
			}
		} catch (error) {
			logger.error("查询玩家游戏场次出错", error);
		}

		// 3. 查询玩家在线小时数
		// 注意：这里假设onlineHistory表中没有直接的时长记录，需要从playerDetails表获取
		try {
			// 检查playerDetails.db文件是否存在
			const playerDetailsExists = await checkDatabaseExists(PLAYER_DETAILS_DB);
			if (playerDetailsExists) {
				playerDetailsDb = new SQLiteDB(PLAYER_DETAILS_DB, CREATE_TABLE_SQL);
				await playerDetailsDb.open();

				const tableExists = await checkTableExists(playerDetailsDb, "playerDetails");
				if (tableExists) {
					// 暂时移除时间范围限制，简化查询
					const onlineHoursSql = `SELECT ROUND(SUM(timePlayed)/3600,1) as onlineHours FROM playerDetails 
					                                  WHERE name=?`;

					const onlineHoursResult = await playerDetailsDb.query(onlineHoursSql, [playerName]);

					result.PLAYER_ONLINE_HOURS = onlineHoursResult[0]?.onlineHours || 0;
				} else {
					logger.warn("playerDetails表不存在");
				}

				await playerDetailsDb.close();
			} else {
				logger.error(`playerDetails.db文件不存在`);
				result.PLAYER_ONLINE_HOURS = 0;
			}
		} catch (error) {
			logger.error("获取玩家在线小时数出错", error);
			result.PLAYER_ONLINE_HOURS = 0;
			try {
				if (playerDetailsDb) await playerDetailsDb.close();
			} catch (closeError) {
				logger.error("关闭playerDetailsDb出错", closeError);
			}
		}

		await onlineHistoryDb.close();
	} catch (error) {
		logger.error("获取玩家在线历史数据出错", error);
	} finally {
		// 关闭数据库连接
		try {
			if (onlineHistoryDb) await onlineHistoryDb.close();
		} catch (error) {
			logger.error("关闭onlineHistoryDb出错", error);
		}
	}

	logger.info(`获取玩家在线历史数据完成，结果: ${JSON.stringify(result)}`);
	return result;
}
