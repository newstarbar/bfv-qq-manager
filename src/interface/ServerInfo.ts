/** 服务器配置 */
export interface ServerConfig {
	tag: string;
	group_id: number;
	zh_name: string;
	en_name: string;
	id: string;
	level: number;
	warm_level: number;
	kd: number;
	kpm: number;
	nokill: number;
	kill: number;
	warm_player: number;
	tv: boolean;
}

/** 服务器状态 */
export interface ServerStatus {
	tag: string;
	zh_name: string;
	en_name: string;
	gameId: number;
	mapName: string;
	mapMode: string;
	soldier: number;
	spectator: number;
	queue: number;
	rotationIndex: number;
	currentTime: number;
}

/** 队伍编号 */
export enum Team {
	one = 1,
	two = 2,
	queue = 3,
	spectator = 4,
	unKnown = 0
}

export const TeamName: { [key in Team]: string } = {
	1: "队伍1",
	2: "队伍2",
	3: "排队中",
	4: "观战",
	0: "未知"
};

/** 玩家信息 */
export interface Player {
	name: string;
	personaId: number;
	team: Team;
	platoon: string;
	joinTime: number;
	warmTime: number;
	isWarmed: boolean;
	isBot: boolean;
}

/** 群内玩家 */
export interface GroupPlayer extends Player {
	user_id: number;
	group_id: number;
	admin_level: number;
	server_name: string;
}

/** 服务器玩家信息 */
export interface ServerPlayers {
	soldier: Player[];
	queue: Player[];
	spectator: Player[];
	bot: Player[];
}

/** 服务器玩家进出日志 */
export interface ServerLog {
	time: Date;
	playerName: string;
	personaId: number;
	team: Team;
	platoon: string;
	action: "join" | "leave";
}

/** 服务器管理玩家模块 */
export interface PlayerManager {
	tag: string;
	serverName: string;
	serverConfig: ServerConfig;
	gameId: number;
	mapName: string;
	mapMode: string;
	players: ServerPlayers;
	serverLog: ServerLog[];
	isWarm: boolean;

	update(mapName: string, mapMode: string, players: ServerPlayers): Promise<void>;
	gameEndEvent(): Promise<void>;
	warmEvent(players: ServerPlayers): Promise<ServerPlayers>;
	joinEvent(players: Player[]): void;
	leaveEvent(players: Player[]): Promise<void>;
}

/** 服务器管理员 */
export interface ServerAdmin {
	name: string;
	user_id: number;
}
