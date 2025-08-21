import logger from "./logger";

const currentVersion = "2.0.5";

export function getVersion(): void {
	logger.info(`当前版本号: ${currentVersion}`);
}
