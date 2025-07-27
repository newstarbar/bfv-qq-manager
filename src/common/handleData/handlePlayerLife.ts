import { PlayerLife } from "../../interface/player";

/** 玩家生涯数据处理 */
export function handlePlayerLife(name: string, personaId: number, isWarmed: boolean, playerData: any, type: 'ea' | 'robot' | 'gt'): PlayerLife {
    let timePlayed: number = 0;
    let level: number = 0;
    let wins: number = 0;
    let losses: number = 0;
    let kills: number = 0;
    let deaths: number = 0;
    let kpm: number = 0;
    let kd: number = 0;
    let longestHeadShot: number = 0;

    if (type === 'ea') {
        const basicStats = playerData.basicStats;
        // 最长爆头距离
        longestHeadShot = playerData.longestHeadShot;
        wins = basicStats.wins;
        losses = basicStats.losses;
        timePlayed = basicStats.timePlayed;
        kills = basicStats.kills;
        deaths = basicStats.deaths;
        level = basicStats.rank.number;
        kpm = basicStats.kpm;
        // 保留两位小数
        kd = Number((kills / (deaths === 0 ? 1 : deaths)).toFixed(2));

    } else if (type === 'robot') {
        personaId = playerData.personaId;
        wins = playerData.wins;
        losses = playerData.loses;
        timePlayed = playerData.timePlayed;
        kills = playerData.kills;
        deaths = playerData.deaths;
        level = playerData.rank;
        kpm = Number(playerData.killsPerMinute);
        // 保留两位小数
        kd = Number(playerData.killDeath);

    } else if (type === 'gt') {
        personaId = playerData.id;
        wins = playerData.wins;
        losses = playerData.loses;
        timePlayed = playerData.secondsPlayed;
        kills = playerData.kills;
        deaths = playerData.deaths;
        level = playerData.rank;
        kpm = playerData.killsPerMinute;
        // 保留两位小数
        kd = Number((kills / (deaths === 0 ? 1 : deaths)).toFixed(2));

    }
    const playerLife: PlayerLife = { name, personaId, timePlayed, level, wins, losses, kills, deaths, kpm, kd, longestHeadShot, isWarmed };
    return playerLife;
}