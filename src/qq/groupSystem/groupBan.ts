import { addGlobalBlackList, deleteGlobalBlackList } from "../../robot/ban/backListManager";


/** 接收群组联盟事件 */
export function receiveGroupAllianceEvent(e: any) {
    if (e.raw_message.startsWith("<群组联合BANADD>")) {
        addGroupAllianceBan(e);
    } else if (e.raw_message.startsWith("<群组联合BANDEL>")) {
        deleteGroupAllianceBan(e);
    }
}

/** 添加群组联ban */
export function addGroupAllianceBan(e: any) {
    const list = e.raw_message.split("\n");
    const player_name = list[1];
    const persona_id = list[2];
    const reason = list[3];
    const group_id = list[4];
    const group_name = list[5];
    const admin_qq = list
    const admin_name = list[7];
    const time = list[8];
    // 添加群组联盟黑名单
    addGlobalBlackList(player_name, persona_id, reason, group_id, group_name, admin_qq, admin_name, time);
}

/** 删除群组联盟黑名单 */
export function deleteGroupAllianceBan(e: any) {
    const list = e.raw_message.split("\n");
    const player_name = list[1];
    const persona_id = list[2];
    // 删除群组联盟黑名单
    deleteGlobalBlackList(player_name);
}