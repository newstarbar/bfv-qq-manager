import path from 'path';
import logger from '../../utils/logger';
import { SQLiteDB } from '../../utils/sqlite';
import { Player } from '../../interface/ServerInfo';
import { getNowDATETIME } from '../../utils/timeTool';
import { setWarmPlayer } from './onlineHistory';

const url = path.join(process.cwd(), "data", "warmPlayer.db");
const createTableSql = `CREATE TABLE IF NOT EXISTS warmPlayer (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_name TEXT NOT NULL,
    server_name TEXT NOT NULL,
    time DATETIME NOT NULL
)`;

/** 添加暖服玩家 */
export async function addWarmPlayer(serverName: string, players: Player[]) {
    const db = new SQLiteDB(url, createTableSql);
    await db.open();
    const today = getNowDATETIME();
    for (const player of players) {
        const sql = `INSERT INTO warmPlayer (player_name, server_name, time) VALUES (?,?,?)`;
        const params = [player.name, serverName, today];
        await db.execute(sql, params);
        await setWarmPlayer(player.name, serverName);

        logger.info(`添加暖服玩家 ${player.name} 到记录成功`);
    }
    await db.close();
}

const warmHour = 16;

/** 获取玩家是否为暖服玩家 */
export async function isWarmPlayer(playerName: string): Promise<{ isWarm: boolean, time: string, hour: number }> {
    const db = new SQLiteDB(url, createTableSql);
    await db.open();
    const sql = `SELECT time FROM warmPlayer WHERE player_name = ? ORDER BY time DESC LIMIT 1`;
    const params = [playerName];
    const result = await db.query(sql, params);
    await db.close();
    if (result.length > 0) {
        const time = result[0].time;
        const hour = warmHour - Number(((new Date().getTime() - new Date(time).getTime()) / 1000 / 60 / 60).toFixed(1));
        if (hour > 0) {
            return { isWarm: true, time, hour };
        } else {
            return { isWarm: false, time, hour: 0 };
        }
    } else {
        return { isWarm: false, time: '', hour: 0 };
    }
}

/** 获取当前的暖服玩家列表 */
export async function getWarmPlayerList(): Promise<string[]> {
    const db = new SQLiteDB(url, createTableSql);
    await db.open();
    const sql = `SELECT player_name, MAX(time) as max_time FROM warmPlayer GROUP BY player_name ORDER BY max_time DESC `;
    const result = await db.query(sql, []);
    await db.close();
    const playerList: string[] = [];
    for (const item of result) {
        const time = item.max_time;
        const hour = warmHour - Number(((new Date().getTime() - new Date(time).getTime()) / 1000 / 60 / 60).toFixed(1));
        if (hour > 0) {
            playerList.push(item.player_name);
        }
    }
    return playerList;
}


