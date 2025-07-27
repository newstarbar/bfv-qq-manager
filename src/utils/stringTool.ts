/** 获取字符串的显示长度（中文字符按两个长度计算） */
function calculateDisplayLength(str: string): number {
    let length = 0;
    for (const char of str) {
        // 简单判断是否为中文字符（实际项目中可能需要更复杂的判断）
        if (/[\u4e00-\u9fa5]/.test(char)) {
            length += 2;
        } else {
            length += 1;
        }
    }
    return length;
}

/** 填充字符串到指定长度，并根据对齐方式进行填充 */
export function padString(str1: string, str2: string, length: number): string {
    const length1 = calculateDisplayLength(str1);
    const length2 = calculateDisplayLength(str2);
    const totalLength = length1 + length2;
    if (totalLength >= length) {
        return str1 + str2;
    }
    const paddingLength = length - totalLength;
    const padding = ' '.repeat(paddingLength);
    return str1 + padding + str2;
}

/** 解码 HTML 实体 如 &lt; */
export function decodeHTML(str: string) {
    // 创建映射表
    const entities: { [key: string]: string } = {
        'amp': '&',      // & 符号
        'lt': '<',       // 小于号
        'gt': '>',       // 大于号
        'quot': '"',     // 双引号
        'apos': "'",     // 单引号
        'nbsp': '\xa0',  // 非断空格
        'cent': '¢',     // 分数
        'pound': '£',    // 英镑
        'curren': '¥',   // 平方
        'yen': '¥',      // 日元
        'euro': '€',     // 欧元
        'sect': '§',     // 分节号
        'copy': '©',     // 版权
        'reg': '®',      // 注册商标
        'trade': '™',    // 商标
        'times': '×',    // 乘号
        'divide': '÷',   // 除号
        'laquo': '«',    // 左双角括号
        'raquo': '»',    // 右双角括号
        'para': '¶',     // 段落符号
        'bdquo': '„',    // 底引号
        'hellip': '…',   // 省略号
        'lsquo': '‘',    // 左单引号
        'rsquo': '’',    // 右单引号
        'ldquo': '“',    // 左双引号
        'rdquo': '”',    // 右双引号
        'dagger': '†',   // 单匕首号
        'Dagger': '‡',   // 双匕首号
        'bull': '•',     // 黑圆点
        'lsaquo': '‹',   // 左单角括号
        'rsaquo': '›',   // 右单角括号
        'oline': '‾',    // 上划线
        'frasl': '⁄',    // 分数斜杠
        'eacute': 'é',   // 带 acute 的 e
        'agrave': 'à',   // 带 grave 的 a
        'acirc': 'â',    // 带 circumflex 的 a
        'auml': 'ä',     // 带 umlaut 的 a
        'aring': 'å',    // 带 ring 的 a
        'aelig': 'æ',    // ae 字母
        'ccedil': 'ç',   // 带 cedilla 的 c
        'egrave': 'è',   // 带 grave 的 e
        'ecirc': 'ê',    // 带 circumflex 的 e
        'euml': 'ë',     // 带 umlaut 的 e
        'igrave': 'ì',   // 带 grave 的 i
        'icirc': 'î',    // 带 circumflex 的 i
        'iuml': 'ï',     // 带 umlaut 的 i
        'eth': 'ð',      // eth 字符
        'ntilde': 'ñ',   // 带 tilde 的 n
        'ograve': 'ò',   // 带 grave 的 o
        'ocirc': 'ô',    // 带 circumflex 的 o
        'otilde': 'õ',   // 带 tilde 的 o
        'ouml': 'ö',     // 带 umlaut 的 o
        'oelig': 'ø',    // 带 stroke 的 o
        'oslash': 'ø',   // 带 slash 的 o
        'ugrave': 'ù',   // 带 grave 的 u
        'ucirc': 'û',    // 带 circumflex 的 u
        'uuml': 'ü',     // 带 umlaut 的 u
        'yacute': 'ý',   // 带 acute 的 y
        'yuml': 'ÿ',     // 带 umlaut 的 y
        'thorn': 'þ',    // thorn 字符
    };

    // 匹配实体的正则表达式
    const entityRegex = /&#?\w+;/g;
    // 替换实体
    const replaceEntity = (entity: string) => {
        // 去掉 & 和 ;，得到实体名称
        let entityName = entity.substring(1, entity.length - 1);
        // 检查是否是数字实体
        if (entityName.startsWith('#')) {
            // 如果是十六进制数字
            if (entityName.startsWith('#x')) {
                return String.fromCharCode(parseInt(entityName.substr(2), 16));
            }
            // 如果是十进制数字
            else {
                return String.fromCharCode(parseInt(entityName.substr(1), 10));
            }
        }
        // 否则按名称查找
        return entities[entityName] || entity;
    };
    return str.replace(entityRegex, (match) => replaceEntity(match));
}