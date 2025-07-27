import path from 'path';
import { qqAxios } from '../utils/axios';
import logger from '../utils/logger';
import { SQLiteDB } from '../utils/sqlite';
import { GroupPlayer, Player } from '../interface/ServerInfo';

const url = path.join(process.cwd(), "data", "groupMember.db");
const createTableSql = `CREATE TABLE IF NOT EXISTS groupMember (
    user_id INTEGER PRIMARY KEY,
    group_id INTEGER NOT NULL,
    player_name TEXT,
    persona_id INTEGER,
    admin_level INTEGER,
    join_time INTEGER
)`;

/** 获取群成员信息 */
export async function getMemberInfo(
    group_id: number | null,
    user_id: number | null,
    player_name: string | null): Promise<any[]> {
    const db = new SQLiteDB(url, createTableSql);
    await db.open();
    let sql = 'SELECT * FROM groupMember WHERE ';
    let params: any[] = [];

    if (group_id && user_id) {
        sql += `group_id = ? AND user_id = ?`;
        params = [group_id, user_id];

    } else if (player_name) {
        sql += `player_name = ?`;
        params = [player_name];
    } else if (user_id && !group_id && !player_name) {
        sql += `user_id = ?`;
        params = [user_id];
    }
    const result = await db.query(sql, params);
    await db.close();
    return result;
}

/** 新增或更新群成员信息 */
export async function addOrUpdateMemberInfo(
    group_id: number,
    user_id: number,
    player_name: string,
    admin_level: number,
    persona_id: number,
    join_time: number): Promise<void> {
    const db = new SQLiteDB(url, createTableSql);
    await db.open();
    // 查看该玩家是否存在
    const querySql = `SELECT * FROM groupMember WHERE group_id = ? AND user_id = ?`;
    const result = await db.query(querySql, [group_id, user_id]);
    if (result.length > 0) {
        const sql = `UPDATE groupMember SET admin_level = ?, join_time = ? WHERE group_id = ? AND user_id = ?`;
        await db.execute(sql, [admin_level, join_time, group_id, user_id]);
    } else {
        const sql = `INSERT INTO groupMember (user_id, group_id, player_name, admin_level, persona_id, join_time) VALUES (?,?,?,?,?,?)`;
        await db.execute(sql, [user_id, group_id, player_name, admin_level, persona_id, join_time]);
    }
    await db.close();
}

/** 删除群成员信息 */
export async function deleteMemberInfo(group_id: number, user_id: number): Promise<void> {
    const db = new SQLiteDB(url, createTableSql);
    await db.open();
    // 查看该玩家是否存在
    const querySql = `SELECT * FROM groupMember WHERE group_id = ? AND user_id = ?`;
    const result = await db.query(querySql, [group_id, user_id]);
    if (result.length === 0) {
        return;
    }
    const sql = `DELETE FROM groupMember WHERE group_id = ? AND user_id = ?`;
    await db.execute(sql, [group_id, user_id]);
    await db.close();
}

/** 获取整个群成员信息 */
export async function getAllMemberInfo(group_id: number): Promise<any[]> {
    const db = new SQLiteDB(url, createTableSql);
    await db.open();
    const sql = `SELECT * FROM groupMember WHERE group_id = ? ORDER BY join_time ASC`;
    const result = await db.query(sql, [group_id]);
    await db.close();
    return result;
}


/** 获取所有admin_level以上的群成员信息 */
export async function getAdminMemberInfo(group_id: number, admin_level: number): Promise<any[]> {
    const db = new SQLiteDB(url, createTableSql);
    await db.open();
    const sql = `SELECT * FROM groupMember WHERE group_id = ? AND admin_level >= ? ORDER BY join_time ASC`;
    const result = await db.query(sql, [group_id, admin_level]);
    await db.close();
    return result;
}

/** 判断是否为管理员 */
export async function isAdmin(min_level: number = 1, player_name: string | null, user_id: number | null): Promise<any[]> {
    let sql: string;
    let params: any[] = [];
    if (player_name && !user_id) {
        sql = `SELECT * FROM groupMember WHERE player_name = ? AND admin_level >= ?`;
        params = [player_name, min_level];
    } else if (user_id && !player_name) {
        sql = `SELECT * FROM groupMember WHERE user_id = ? AND admin_level >= ?`;
        params = [user_id, min_level];
    } else {
        return [];
    }
    const db = new SQLiteDB(url, createTableSql);
    await db.open();
    const result = await db.query(sql, params);
    await db.close();
    return result;
}

/** 设置管理员 */
export async function setAdmin(group_id: number, user_id: number, admin_level: number): Promise<[boolean, string]> {
    const db = new SQLiteDB(url, createTableSql);
    await db.open();
    // 查看该玩家是否存在
    const querySql = `SELECT * FROM groupMember WHERE group_id = ? AND user_id = ?`;
    const result = await db.query(querySql, [group_id, user_id]);
    if (result.length === 0) {
        return [false, '该玩家不在群中'];
    }
    const adminLevel: number = result[0].admin_level;
    if (adminLevel == admin_level) {
        return [false, `该玩家权限已是: ${adminLevelName[adminLevel]}`];
    }

    if (adminLevelName[admin_level] === '超级管理员') {
        return [false, '超级管理员权限不可设定'];
    }

    if (!adminLevelName[admin_level]) {
        return [false, '无效的管理员等级\n请使用数字0-3\n0: 普通成员\n1: 督战队\n2: 都督\n3: 总督'];
    }

    const sql = `UPDATE groupMember SET admin_level = ? WHERE group_id = ? AND user_id = ?`;
    await db.execute(sql, [admin_level, group_id, user_id]);
    await db.close();
    if (admin_level === 0) {
        return [true, `【玩家】:${result[0].player_name} 已被取消管理员`];
    } else {
        return [true, `【玩家】:${result[0].player_name} 已被设为 ${adminLevelName[admin_level]}`];
    }
}

/** 不同权限等级的管理员名称 */
export const adminLevelName: { [key: number]: string } = {
    0: '普通成员',
    1: '督战队',
    2: '都督',
    3: '总督',
    4: '超级管理员'
};

/** 刷新群成员信息 */
export async function refreshMemberInfo(group_id: number): Promise<string> {
    const res = await qqAxios().post('get_group_member_list', {
        group_id: group_id,
        no_cache: true,
    });
    const data = res.data;
    if (data.status === 'ok') {
        const memberList: any[] = data.data;

        // 新增或更新群成员数量
        let groupMemberCount = 0;

        for (const member of memberList) {
            const { user_id, card, join_time, is_robot, title } = member;
            if (is_robot) {
                continue;
            }
            const name = (card as string).replace('游戏中-', '');

            let admin_level = 0;
            if (title.includes('督战队')) {
                admin_level = 1;
            } else if (title.includes('都督')) {
                admin_level = 2;
            } else if (title.includes('总督') || title.includes('腐竹') || title.includes('服主')) {
                admin_level = 3;
            }
            const persona_id = 0;

            const allGroupMember = await getAllMemberInfo(group_id);
            const groupMember = allGroupMember.find(item => item.user_id === user_id);
            if (!groupMember) {
                groupMemberCount++;
                await addOrUpdateMemberInfo(group_id, user_id, name, admin_level, persona_id, join_time);
            }
        }
        // 移出数据库中不存在的群成员
        const allGroupMember = await getAllMemberInfo(group_id);
        const sqliteMemberUserIds = allGroupMember.map(item => item.user_id);
        const groupMemberUserIds = memberList.map(item => item.user_id);
        const leaveMemberUserIds = sqliteMemberUserIds.filter(item => !groupMemberUserIds.includes(item));
        for (const user_id of leaveMemberUserIds) {
            await deleteMemberInfo(group_id, user_id);
        }
        const leaveMemberCount = leaveMemberUserIds.length;

        return `刷新群成员信息成功\n新增成员数量: ${groupMemberCount}\n移出成员数量: ${leaveMemberCount}`;
    } else {
        logger.error(`刷新群成员信息失败: ${data.status}`);
        return "获取群成员信息失败";
    }
}

/** 设置persona_id */
export async function setPersonaId(playerName: string, personaId: number): Promise<void> {
    const db = new SQLiteDB(url, createTableSql);
    await db.open();
    const sql = `UPDATE groupMember SET persona_id = ? WHERE player_name = ?`;
    await db.execute(sql, [personaId, playerName]);
    await db.close();
}

/** Bind设置player_name和persona_id */
export async function setPlayerNameAndPersonaId(group_id: number, user_id: number, player_name: string, persona_id: number): Promise<string> {
    const db = new SQLiteDB(url, createTableSql);
    await db.open();
    // 查看该玩家是否存在
    const querySql = `SELECT * FROM groupMember WHERE group_id = ? AND user_id = ?`;
    const result = await db.query(querySql, [group_id, user_id]);
    if (result.length === 0) {
        await addOrUpdateMemberInfo(group_id, user_id, player_name, 0, persona_id, 0);
        return '之前没有记录';
    } else {
        const sql = `UPDATE groupMember SET player_name = ?, persona_id = ? WHERE user_id = ? AND group_id = ?`;
        await db.execute(sql, [player_name, persona_id, user_id, group_id]);
        await db.close();
        return result[0].player_name;
    }
}


/** 过滤出是群内的玩家 */
export async function filterGroupMember(group_id: number, players: Player[]): Promise<GroupPlayer[]> {
    const allGroupMember = await getAllMemberInfo(group_id);
    const groupMemberName = allGroupMember.map(item => item.player_name);
    const groupMemberPersonaId = allGroupMember.map(item => item.persona_id);
    const groupMember = players.filter(player => groupMemberPersonaId.includes(player.personaId) || groupMemberName.includes(player.name));
    // 是否要设置一下persona_id
    groupMember.forEach(player => {
        const groupMemberInfo = allGroupMember.find(item => item.player_name === player.name);
        if (groupMemberInfo.persona_id === 0) {
            setPersonaId(player.name, player.personaId);
        }
    });
    const groupPlayer: GroupPlayer[] = groupMember.map(player => {
        const groupMemberInfo = allGroupMember.find(item => item.player_name === player.name);
        return {
            ...player,
            user_id: groupMemberInfo.user_id,
            group_id: group_id,
            admin_level: groupMemberInfo.admin_level,
            server_name: ""
        };
    });

    return groupPlayer;
}

/** 是否是群友 */
export async function isGroupMember(group_id: number, name: string): Promise<boolean> {
    const db = new SQLiteDB(url, createTableSql);
    await db.open();
    const sql = `SELECT * FROM groupMember WHERE group_id = ? AND player_name = ?`;
    const result = await db.query(sql, [group_id, name]);
    await db.close();
    return result.length > 0;
}