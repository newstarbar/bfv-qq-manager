import { PrivateCommand } from '../../interface/command';
import { sendMsgToQQFriend, sendMsgToQQGroup } from '../../qq/sendMessage';
import { addServerSayConfig, deleteServerSayConfig, getServerSayConfig, updateServerSayConfig } from '../../robot/serverSayManager';
import logger from '../../utils/logger';
import { decodeHTML, padString } from '../../utils/stringTool';

export class ServerSayConfigPrivateCommand implements PrivateCommand {
    regexContent = 'saytext=???';
    description = '详见config';
    regex = /^saytext(=|＝)(\S+) (\d+) (.+)$/;

    regexContent2 = 'sayupdate=???';
    description2 = '详见config';
    regex2 = /^sayupdate(=|＝)(\S+) (\d+) (\S+) (.+)$/;

    regexContent3 = 'saydelete=[序号] 群号';
    description3 = '删除播报配置';
    regex3 = /^saydelete(=|＝)(\S+) (\d+)$/;

    regexContent4 = 'saylist';
    description4 = '查看播报配置列表';
    regex4 = /^saylist$/;

    adminLevel = 3;

    isMatch(command: string): boolean {
        return this.regex.test(command) || this.regex2.test(command) || this.regex3.test(command) || this.regex4.test(command);
    }

    getInfo(): string {
        const content1 = padString(this.regexContent, this.description, 30);
        const content2 = padString(this.regexContent2, this.description2, 30);
        const content3 = padString(this.regexContent3, this.description3, 30);
        const content4 = padString(this.regexContent4, this.description4, 35);
        const content = content1 + '\n' + content2 + '\n' + content3 + '\n' + content4;
        return content;
    }

    async execute(command: string, message_id: number, user_id: number): Promise<any> {
        if (this.regex.test(command)) {
            const tag = command.match(this.regex)![2];
            const group_id = parseInt(command.match(this.regex)![3]);
            let content = command.match(this.regex)![4];
            content = decodeHTML(content);

            // 检查格式是否正确
            const contentRegex = /^\[.+?\](?:\[\+.+?\])*$/;
            if (!contentRegex.test(content)) {
                sendMsgToQQFriend('内容格式错误，请检查[][]', user_id);
                return;
            }
            const regex = /\[(.+?)\]/g;
            const texts: string[] = [];
            let match: RegExpExecArray | null;
            // 使用正则表达式的 exec 方法循环匹配所有 [ 内容 ] 结构
            while ((match = regex.exec(content)) !== null) {
                // 将匹配到的内容添加到数组中
                texts.push(match[1]);
            }
            // 检查texts数组是否为空，是否有超过90个字符的文本
            if (texts.length === 0 || texts.some((text) => text.length > 90)) {
                sendMsgToQQFriend('文本内容不能为空或超过90个字符, 请检查[]', user_id);
                return;
            }
            const result = await addServerSayConfig(tag, group_id, texts);
            sendMsgToQQFriend(result, user_id);

        } else if (this.regex2.test(command)) {
            const tag = command.match(this.regex2)![2];
            const group_id = parseInt(command.match(this.regex)![3]);
            const config = command.match(this.regex2)![4];
            let value: string | string[] = command.match(this.regex2)![5];
            value = decodeHTML(value);
            if (config == "texts") {
                const regex = /\[(.+?)\]/g;
                const texts: string[] = [];
                let match: RegExpExecArray | null;
                // 使用正则表达式的 exec 方法循环匹配所有 [ 内容 ] 结构
                while ((match = regex.exec(value)) !== null) {
                    // 将匹配到的内容添加到数组中
                    texts.push(match[1]);
                }
                // 检查texts数组是否为空，是否有超过90个字符的文本
                if (texts.length === 0 || texts.some((text) => text.length > 90)) {
                    sendMsgToQQFriend('文本内容不能为空或超过90个字符, 请检查[]', user_id);
                    return;
                }
                value = texts;
            }
            const result = await updateServerSayConfig(tag, group_id, config, value);
            sendMsgToQQFriend(result, user_id);

        } else if (this.regex3.test(command)) {
            const tag = command.match(this.regex3)![2];
            const group_id = parseInt(command.match(this.regex)![3]);
            const result = await deleteServerSayConfig(tag, group_id);
            sendMsgToQQFriend(result, user_id);

        } else if (this.regex4.test(command)) {
            const result = await getServerSayConfig();
            sendMsgToQQFriend(result, user_id);

        }
    }
}