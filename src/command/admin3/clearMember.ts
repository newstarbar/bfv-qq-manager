import { Command } from '../../interface/command';
import { padString } from '../../utils/stringTool';

export class ClearMemberCommand implements Command {
    regexContent = 'clear=天数';
    description = '清理?天前上线';

    regexContent2 = 'clearshow';
    description2 = '显示即将清理';

    regexContent3 = 'clearout=qq号';
    description3 = '移出清理列表';

    adminLevel = 3;

    isMatch(command: string): boolean {
        // 正则匹配
        return /^clear(=|＝)(\d+)$/.test(command) || /^clearshow$/.test(command) || /^clearout(=|＝)(\d+)$/.test(command);
    }

    getInfo(): string {
        // 总共20个字符，中间用空格补齐
        // const content1 = padString(this.regexContent, this.description, 34);
        // const content2 = padString(this.regexContent2, this.description2, 34);
        // const content3 = padString(this.regexContent3, this.description3, 31);
        // const content = content1 + '\n' + content2 + '\n' + content3;
        // return content;
        return "";
    }

    async execute(command: string, group_id: number, message_id: number, user_id: number): Promise<any> {
    }
}