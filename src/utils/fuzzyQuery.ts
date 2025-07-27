

// 计算两个字符串之间的Levenshtein距离
function levenshteinDistance(a: string, b: string): number {
    const d = [];
    const n = a.length;
    const m = b.length;

    if (n === 0) return m;
    if (m === 0) return n;

    for (let i = n; i >= 0; i--) d[i] = [i];
    for (let j = m; j >= 0; j--) d[0][j] = j;

    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            d[i][j] = Math.min(
                d[i - 1][j] + 1, // deletion
                d[i][j - 1] + 1, // insertion
                d[i - 1][j - 1] + cost // substitution
            );
        }
    }

    return d[n][m];
}

// 模糊查询函数
export function fuzzySearch(query: string, array: string[], length = 5, threshold = 5): string[] {
    let result = array.filter(name => {
        // 忽略大小写
        const new_query = query.toLowerCase();
        const new_name = name.toLowerCase();
        const distance = levenshteinDistance(new_query, new_name);
        // console.log(name, distance);
        return distance <= threshold; // 设置一个阈值，超过这个值就认为不匹配
    });
    // 返回相似度最近的前5个结果
    return result.slice(0, length);
}