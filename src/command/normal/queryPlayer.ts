import { handlePlayerLife } from '../../common/handleData/handlePlayerLife';
import { handlePlayerWeapon } from '../../common/handleData/handlePlayerWeapon';
import { Command } from '../../interface/command';
import { PlayerLife, PlayerLoadout } from '../../interface/player';
import { generatePlayerLifeWeaponImage } from '../../qq/generateBase64Image';
import { sendBase64ImgToQQGroup, sendMsgToQQGroup } from '../../qq/sendMessage';
import { isPlayerNameExist, playerStatusInBfban, playerStatusInCommunity } from '../../robot/cx/basePlayerQuery';
import { addPlayerWeaponDetail, addQueryPlayerLife } from '../../robot/eaApiManger';
import logger from '../../utils/logger';
import { padString } from '../../utils/stringTool';

export class QueryPlayerCommand implements Command {
    regexContent = 'cx=昵称';
    description = '查询玩家数据';
    regex = /^cx(=|＝)(\S+)$/;
    adminLevel = 0;

    isMatch(command: string): boolean {
        // 正则匹配
        return this.regex.test(command);
    }

    getInfo(): string {
        // 总共20个字符，中间用空格补齐
        const content = padString(this.regexContent, this.description, 34);
        return content;
    }

    async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
        const playerName = command.match(this.regex)![2];
        // 是存在
        const result = await isPlayerNameExist(playerName);
        if (typeof result !== 'string') {

            // 查询玩家的武器数据
            const playerWeapon = await addPlayerWeaponDetail(result.personaId);
            const weaponList = handlePlayerWeapon(playerWeapon, "ea");

            // 查询社区数据
            const { isNormal: communityIsNormal, content: communityContent } = await playerStatusInCommunity(result.personaId);
            // 查询bfban数据
            const { isNormal: bfbanIsNormal, content: bfbanContent } = await playerStatusInBfban(result.personaId);
            // 查询玩家的生涯数据
            const lifeData = await addQueryPlayerLife(result.personaId);
            const playerLife = handlePlayerLife(result.name, result.personaId, false, lifeData, 'ea');

            // 构造数据
            const data: PlayerLoadout = {
                name: result.name,
                personaId: result.personaId,
                community: {
                    isNormal: communityIsNormal,
                    content: communityContent,
                },
                bfban: {
                    isNormal: bfbanIsNormal,
                    content: bfbanContent,
                },
                weapons: weaponList,
                playerLife: playerLife,
            }

            const base64Image = await generatePlayerLifeWeaponImage(data);
            // 发送数据
            sendBase64ImgToQQGroup(group_id, base64Image, message_id);

        } else {
            // 不存在
            sendMsgToQQGroup(group_id, result, message_id);
        }
    }
}



