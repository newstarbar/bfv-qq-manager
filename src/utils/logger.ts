import * as log4js from 'log4js';

const logConfig = {
    appenders: {
        console: { type: 'console' },
        file: {
            type: 'file',
            filename: 'logs/app.log',
            pattern: 'yyyy-MM-dd.log', // 按日期命名日志文件
            backups: 10, // 保留日志文件个数
            compress: true, // 压缩日志文件
            encoding: 'utf-8', // 日志文件编码
            maxLogSize: 10485760, // 每个日志文件的最大大小（1 MB）
        }
    },
    categories: {
        default: { appenders: ['console', 'file'], level: 'debug' }
    }
};

log4js.configure(logConfig);

const logger = log4js.getLogger('信息');

export default logger;