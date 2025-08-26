import logger from "./logger";

export const currentVersion = "V2.1.1";

export function getVersion(): void {
	logger.info(`当前版本号: ${currentVersion}`);
}
