import { AllVechileDate, AllWeaponDate, PlayerLife, PlayerRecordDataCache, VechileData, WeaponData } from "../../interface/player";
import logger from "../../utils/logger";
import path from 'path';
import { SQLiteDB } from '../../utils/sqlite';
import { getNowDATETIME } from "../../utils/timeTool";

const url = path.join(process.cwd(), "data", "playerRecord.db");
const createPlayerWeaponVehicleTableSql = `CREATE TABLE IF NOT EXISTS playerWeaponVehicle (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_name TEXT,
    personaId INTEGER,
    server_name TEXT,
    sum_kills INTEGER,
    sum_seconds INTEGER,
    weapon_kills INTEGER,
    weapon_seconds INTEGER,
    vehicle_kills INTEGER,
    vehicle_seconds INTEGER,
    weapon_json TEXT,
    vehicle_json TEXT,
    time DATETIME
)`;

// 玩家数据缓存
let playerDataCache: PlayerRecordDataCache[] = []

/** 刷新玩家数据 */
export async function refreshPlayerData(playerName: string, personaId: number, serverName: string, weapons: AllWeaponDate[], vehicles: AllVechileDate[], type: "join" | "settle" | "leave"): Promise<{ sumKills: number, sumTime: number, sumWeaponKills: number, sumWeaponTime: number, sumVehicleKills: number, sumVehicleTime: number }> {
    let sumWeaponKills = 0;
    let sumWeaponTime = 0;
    let sumVehicleKills = 0;
    let sumVehicleTime = 0;

    // 是否存在
    const index = playerDataCache.findIndex(p => p.personaId === personaId);
    if (index !== -1) {
        // 是否有任何一把的武器或载具数据 kills ,seconds 有变化
        let oldWeapons = playerDataCache[index].weapons;
        let oldVechiles = playerDataCache[index].vechiles;
        let hasChange = false;
        let changeWeaponList: WeaponData[] = [];
        let changeVechileList: VechileData[] = [];
        for (let i = 0; i < weapons.length; i++) {
            const weaponList = weapons[i].weapons;
            for (let j = 0; j < weaponList.length; j++) {
                const weapon = weaponList[j];
                let oldWeapon = oldWeapons.find(w => w.name === weapon.name);
                if (oldWeapon) {
                    if (oldWeapon.kills !== weapon.kills || oldWeapon.seconds !== weapon.seconds) {
                        const recordKills = weapon.kills - oldWeapon.kills;
                        const recordHeadShots = weapon.headshots - oldWeapon.headshots;
                        const recordSeconds = Number(((weapon.seconds - oldWeapon.seconds) / 60).toFixed(1));
                        const recordScore = weapon.score - oldWeapon.score;
                        const recordKpm = weapon.kpm - oldWeapon.kpm;

                        if (recordKills !== 0) {
                            // 有变化
                            hasChange = true;
                            sumWeaponKills += recordKills;
                            sumWeaponTime += recordSeconds;
                            changeWeaponList.push({
                                name: weapon.name,
                                kills: recordKills,
                                seconds: recordSeconds,
                                headshots: recordHeadShots,
                                score: recordScore,
                                kpm: recordKpm
                            });
                            logger.warn(`玩家${playerName} 武器: ${weapon.name} ========>> 击杀${recordKills}，时间${recordSeconds} 分钟`);
                        }
                    }
                }
            }
        }
        for (let i = 0; i < vehicles.length; i++) {
            const vechileList = vehicles[i].vechiles;
            for (let j = 0; j < vechileList.length; j++) {
                const vechile = vechileList[j];
                let oldVechile = oldVechiles.find(v => v.name === vechile.name);
                if (oldVechile) {
                    if (oldVechile.kills !== vechile.kills || oldVechile.seconds !== vechile.seconds) {
                        const recordKills = vechile.kills - oldVechile.kills;
                        const recordSeconds = Number(((vechile.seconds - oldVechile.seconds) / 60).toFixed(1));
                        const recordVehicleDestroy = vechile.vehicleDestroy - oldVechile.vehicleDestroy;
                        const recordKpm = vechile.kpm - oldVechile.kpm;

                        if (recordKills !== 0) {
                            // 有变化
                            hasChange = true;
                            sumVehicleKills += recordKills;
                            sumVehicleTime += recordSeconds;
                            changeVechileList.push({
                                name: vechile.name,
                                kills: recordKills,
                                seconds: recordSeconds,
                                vehicleDestroy: recordVehicleDestroy,
                                kpm: recordKpm
                            });
                            logger.warn(`玩家${playerName} 载具: ${vechile.name} ========>> 击杀${recordKills}，时间${recordSeconds} 分钟`);
                        }
                    }
                }
            }
        }

        if (type === "leave") {
            // 删除数据
            playerDataCache.splice(index, 1);
        } else {
            // 更新数据
            const weaponData: WeaponData[] = weapons.map(w => w.weapons).flat();
            const vechileData: VechileData[] = vehicles.map(v => v.vechiles).flat();
            playerDataCache[index] = { name: playerName, personaId: personaId, weapons: weaponData, vechiles: vechileData };
        }

        if (hasChange) {
            // 保存数据
            await savePlayerRecord(playerName, personaId, serverName, sumWeaponKills, sumWeaponTime, sumVehicleKills, sumVehicleTime, changeWeaponList, changeVechileList);
        }

    } else {
        if (type !== "leave") {
            const weaponData: WeaponData[] = weapons.map(w => w.weapons).flat();
            const vechileData: VechileData[] = vehicles.map(v => v.vechiles).flat();
            // 新增数据
            playerDataCache.push({ name: playerName, personaId: personaId, weapons: weaponData, vechiles: vechileData });
            logger.debug(`新增玩家数据：${playerName} (${personaId})`);
        }
    }
    const sumKills = sumWeaponKills + sumVehicleKills;
    const sumTime = sumWeaponTime + sumVehicleTime;
    return { sumKills, sumTime, sumWeaponKills, sumWeaponTime, sumVehicleKills, sumVehicleTime };
}


/** 保存玩家的一局数据 */
export async function savePlayerRecord(playerName: string, personaId: number, serverName: string, weaponKills: number, weaponSeconds: number, vehicleKills: number, vehicleSeconds: number, weapons: WeaponData[], vechiles: VechileData[]): Promise<void> {
    const db = new SQLiteDB(url, createPlayerWeaponVehicleTableSql);
    await db.open();
    const today = getNowDATETIME();
    const sql = `INSERT INTO playerWeaponVehicle (player_name, personaId, server_name, sum_kills, sum_seconds, weapon_kills, weapon_seconds, vehicle_kills, vehicle_seconds, weapon_json, vehicle_json, time) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`;
    const params = [playerName, personaId, serverName, weaponKills + vehicleKills, weaponSeconds + vehicleSeconds, weaponKills, weaponSeconds, vehicleKills, vehicleSeconds, JSON.stringify(weapons), JSON.stringify(vechiles), today];
    await db.execute(sql, params);
    await db.close();
}


/** 查看玩家战绩数据 */
export async function getPlayerRecord(playerName: string, count: number = 5): Promise<string> {
    const db = new SQLiteDB(url, createPlayerWeaponVehicleTableSql);
    await db.open();
    const sql = `SELECT * FROM playerWeaponVehicle WHERE player_name = ? ORDER BY time DESC LIMIT ?`;
    const params = [playerName, count];
    const result = await db.query(sql, params);
    await db.close();
    let str = "========战绩面板========\n";
    for (let i = 0; i < result.length; i++) {
        const record = result[i];
        const serverName = record.server_name;
        const time = record.time;
        const sumKills = record.sum_kills;
        const sumSeconds = (record.sum_seconds).toFixed(1);
        const weaponKills = record.weapon_kills;
        const weaponSeconds = (record.weapon_seconds).toFixed(1);
        const vehicleKills = record.vehicle_kills;
        const vehicleSeconds = (record.vehicle_seconds).toFixed(1);
        str += `${serverName}\n`;
        str += `总击杀: ${sumKills}  总时长: ${sumSeconds} 分钟\n`;
        str += `步战击杀: ${weaponKills}  步战时长: ${weaponSeconds} 分钟\n`;
        str += `载具击杀: ${vehicleKills}  载具时长: ${vehicleSeconds} 分钟\n`;
        str += `时间: ${time}\n`;
        str += '--------------------------------\n';
    }
    return str;
}


/** 查看玩家详细战绩数据 */
export async function getPlayerDetailRecord(playerName: string, count: number = 5): Promise<string> {
    const db = new SQLiteDB(url, createPlayerWeaponVehicleTableSql);
    await db.open();
    const sql = `SELECT * FROM playerWeaponVehicle WHERE player_name = ? ORDER BY time DESC LIMIT ?`;
    const params = [playerName, count];
    const result = await db.query(sql, params);
    await db.close();
    let str = "========战绩面板========\n";
    for (let i = 0; i < result.length; i++) {
        const record = result[i];
        const weapons: WeaponData[] = JSON.parse(record.weapon_json);
        const vechiles: VechileData[] = JSON.parse(record.vehicle_json);
        const serverName = record.server_name;
        const time = record.time;
        str += `${serverName}\n`;
        for (let j = 0; j < weapons.length; j++) {
            const weapon = weapons[j];
            const weaponKills = weapon.kills;
            const weaponSeconds = (weapon.seconds).toFixed(1);
            str += `${weapon.name} 击杀: ${weaponKills}  时长: ${weaponSeconds} 分钟\n`;
        }
        for (let j = 0; j < vechiles.length; j++) {
            const vechile = vechiles[j];
            const vehicleKills = vechile.kills;
            const vehicleSeconds = (vechile.seconds).toFixed(1);
            str += `${vechile.name} 击杀: ${vehicleKills}  时长: ${vehicleSeconds} 分钟\n`;
        }
        str += `总击杀: ${record.sum_kills}  总时长: ${record.sum_seconds.toFixed(1)} 分钟\n`;
        str += `时间: ${time}\n`;
        str += '--------------------------------\n';
    }
    return str;
}
