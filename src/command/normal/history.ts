import { Command } from '../../interface/command';
import { generateHistoryOnlineImage, generateHistoryOnlinePlayerImage } from '../../qq/generateBase64Image';
import { sendBase64ImgToQQGroup } from '../../qq/sendMessage';
import { getOnlineHistory } from '../../robot/hs/onlineHistory';
import { padString } from '../../utils/stringTool';

export class HistoryCommand implements Command {
    regexContent = 'hs=日期|昵称';
    description = '查询历史';
    regex = /^hs(=|＝)(\S+)( (\d{4}-\d{2}))?$/;
    regex2 = /^hs(=|＝)0( (\d{4}-\d{2}))?$/;

    adminLevel = 0;

    isMatch(command: string): boolean {
        // 正则匹配
        return this.regex.test(command) || this.regex2.test(command);
    }

    getInfo(): string {
        // 总共20个字符，中间用空格补齐
        const content = padString(this.regexContent, this.description, 34);
        return content;
    }

    async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
        if (this.regex2.test(command)) {
            const date = command.match(this.regex2)![3] || '';
            if (date) {
                const year = Number(date.slice(0, 4));
                const month = Number(date.slice(5, 7));
                const history = await getOnlineHistory(null, year, month);
                const base64Image = await generateHistoryOnlineImage(year, month, history);
                sendBase64ImgToQQGroup(group_id, base64Image, message_id);

            } else {
                const year = new Date().getFullYear();
                const month = new Date().getMonth() + 1;
                const history = await getOnlineHistory(null);
                const base64Image = await generateHistoryOnlineImage(year, month, history);
                sendBase64ImgToQQGroup(group_id, base64Image, message_id);

            }
        } else if (this.regex.test(command)) {
            if (this.regex2.test(command)) {
                const date = command.match(this.regex2)![3] || '';
                if (date) {
                    const year = Number(date.slice(0, 4));
                    const month = Number(date.slice(5, 7));
                    const history = await getOnlineHistory(null, year, month);
                    const base64Image = await generateHistoryOnlineImage(year, month, history);
                    sendBase64ImgToQQGroup(group_id, base64Image, message_id);

                } else {
                    const year = new Date().getFullYear();
                    const month = new Date().getMonth() + 1;
                    const history = await getOnlineHistory(null);
                    const base64Image = await generateHistoryOnlineImage(year, month, history);
                    sendBase64ImgToQQGroup(group_id, base64Image, message_id);

                }
            }
            const playerName = command.match(this.regex)![2];
            const date = command.match(this.regex)![4] || '';
            if (date) {
                const year = Number(date.slice(0, 4));
                const month = Number(date.slice(5, 7));
                const history = await getOnlineHistory(playerName, year, month);
                const base64Image = await generateHistoryOnlinePlayerImage(playerName, year, month, history);
                sendBase64ImgToQQGroup(group_id, base64Image, message_id);

            } else {
                const year = new Date().getFullYear();
                const month = new Date().getMonth() + 1;
                const history = await getOnlineHistory(playerName);
                const base64Image = await generateHistoryOnlinePlayerImage(playerName, year, month, history);
                sendBase64ImgToQQGroup(group_id, base64Image, message_id);

            }
        }
    }
}