import { qqAxios } from "../utils/axios";
import logger from "../utils/logger";
import { AxiosError } from "axios";

/** 私聊发送本地文件 */
export async function sendLocalFileToPrivate(user_id: number, file_path: string, fileName: string): Promise<void> {
    try {
        // 发送文件
        await qqAxios().post('send_private_msg', {
            "user_id": user_id,
            "message": [
                {
                    "type": "file",
                    "data": {
                        // 本地路径
                        "file": "file://" + file_path,
                        "name": fileName
                    }
                }
            ]
        }).then((res) => {
            const data = res.data;
            if (data.status === "failed") {
                logger.error(`私聊发送本地文件到QQ群失败: ${data.message}`);
            }
        });

    } catch (err) {
        const error = err as AxiosError;
        logger.error(`[${error.code}] 响应数据：${JSON.stringify(error.message)}`);
    }
}