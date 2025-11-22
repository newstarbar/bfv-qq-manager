/** 玩家生涯信息 */
export interface PlayerLife {
	name: string;
	personaId: number;
	timePlayed: number;
	level: number;
	wins: number;
	losses: number;
	kills: number;
	deaths: number;
	kpm: number;
	kd: number;
	longestHeadShot: number;
	isWarmed: boolean;
}

/** 玩家武器信息 */
export interface PlayerRecordDataCache {
	name: string;
	personaId: number;
	weapons: WeaponData[];
	vechiles: VechileData[];
}

// 武器大类型
export interface AllWeaponDate {
	categoryId: string;
	weapons: WeaponData[];
}

/** 武器数据 */
export interface WeaponData {
	name: string;
	kills: number;
	headshots: number;
	seconds: number;
	kpm: number;
	score: number;
}

/** 载具大类型 */
export interface AllVechileDate {
	categoryId: string;
	vechiles: VechileData[];
}

/** 载具数据 */
export interface VechileData {
	name: string;
	kills: number;
	seconds: number;
	kpm: number;
	vehicleDestroy: number;
}

/** 玩家基础信息 */
export interface PlayerBaseInfo {
	name: string;
	personaId: number;
	registerDate: string | null;
	lastLogin: string | null;
}

/** 玩家生涯武器载具的信息数据 */
export interface PlayerLoadout {
	name: string;
	personaId: number;
	community: {
		isNormal: boolean;
		content: string;
	};
	bfban: {
		isNormal: boolean;
		content: string;
	};
	weapons: AllWeaponDate[];
	playerLife: PlayerLife;
}

/** 本地黑名单玩家信息 */
export interface LocalBlackPlayer {
	name: string;
	personaId: number;
	reason: string;
	admin_name: string;
	admin_qq: number;
	time: string;
}

/** 临时黑名单玩家信息 */
export interface TempBlackPlayer {
	name: string;
	personaId: number;
	reason_type: string;
	reason_text: string;
	time: string;
}
