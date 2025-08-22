import logger from "./logger";

export const currentVersion = "V2.0.5";

export function getVersion(): void {
	logger.info(`当前版本号: ${currentVersion}`);
}
