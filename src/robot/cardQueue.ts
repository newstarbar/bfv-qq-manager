import { Player, ServerConfig } from "../interface/ServerInfo";
import { sendMsgToQQGroup } from "../qq/sendMessage";

/** 卡排队阈值 */
const CARD_QUEUE_THRESHOLD = 6;
/** 踢卡排队冷却时间 */
const KICK_CARD_QUEUE_COOLDOWN = 5 * 60 * 1000; // 5分钟
/** 当前卡排队冷却时间 */
let currentCardQueueCooldown = 0;

/** 检测卡排队 */
export function checkCardQueue(serverConfig: ServerConfig, team1: Player[], team2: Player[], queue: Player[], gameId: string) {
	// 不是小电视服
	if (serverConfig.tv) {
		return;
	}

	// 是否有卡排队的情况
	// 过滤掉机器人
	const team1NotBot = team1.filter((p) => !p.isBot);
	const team2NotBot = team2.filter((p) => !p.isBot);

	if (queue.length > 0) {
		// 队伍1或者队伍2 大于等于32；同时队伍1或者队伍2 卡排队数大于等于阈值
		if ((team1NotBot.length >= 32 || team2NotBot.length >= 32) && (32 - team1NotBot.length >= CARD_QUEUE_THRESHOLD || 32 - team2NotBot.length >= CARD_QUEUE_THRESHOLD)) {
			// 是否在排队冷却时间内
			const now = new Date().getTime();
			if (now - currentCardQueueCooldown < KICK_CARD_QUEUE_COOLDOWN) {
				// 排队冷却时间内，不执行踢卡操作
				return;
			}
			currentCardQueueCooldown = now;
			// 过滤掉排队中时间小于3分钟，大于100分钟的玩家
			const queueNotTooLong = queue.filter((p) => (now - p.joinTime) / 1000 / 1000 / 60 < 100 && (now - p.joinTime) / 1000 / 1000 / 60 > 3);

			if (queueNotTooLong.length > 0) {
				// 排队中时间排序
				const MaxLoogTimePlayer = queueNotTooLong.sort((a, b) => a.joinTime - b.joinTime).slice(0, 1)[0];

				sendMsgToQQGroup(
					serverConfig.group_id,
					`${serverConfig.zh_name}\n[${gameId}]\n出现队伍卡排队情况:\n队伍1: ${team1NotBot.length}  队伍2: ${team2NotBot.length}  排队: ${queue.length}\n推测卡排队玩家: ${
						MaxLoogTimePlayer.name
					} (已排队: ${(now - MaxLoogTimePlayer.joinTime) / 1000 / 1000 / 60} 分钟)`,
					null
				);
			}
		}
	}
}
