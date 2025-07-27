/** 英文地图、模式名称翻译 */
export function translateMapModeName(mapName: string): string {
	switch (mapName) {
		case "Breakthrough":
			return "突破";
		case "Conquest":
			return "征服";
		case "MP_SandAndSea":
			return "艾尔舒丹";
		case "MP_Halfaya":
			return "哈马达";
		case "MP_TropicIslands":
			return "太平洋风暴";
		case "DK_Norway":
			return "挪威";
		case "MP_Hannut_US":
			return "战车风暴";
		case "MP_IwoJima":
			return "硫磺岛";
		case "MP_Norway":
			return "挪威";
		case "MP_ArcticFjord":
			return "纳尔维克";
		case "MP_Hannut":
			return "战车风暴[英德]";
		case "MP_Provence":
			return "普罗旺斯";
		case "MP_Bunker":
			return "地下行动";
		case "MP_Escaut_US":
			return "扭曲钢铁";
		case "MP_Escaut":
			return "扭曲钢铁[英德]";
		case "MP_Foxhunt":
			return "民用机场";
		case "MP_ArcticFjell":
			return "菲耶尔 652";
		case "MP_Jungle":
			return "所罗门群岛";
		case "MP_Devastation":
			return "荒废之地";
		case "MP_Arras":
			return "阿拉斯";
		case "MP_Crete":
			return "水星";
		case "MP_Libya":
			return "迈尔季营地";
		case "MP_WakeIsland":
			return "威克岛";
		case "MP_Kalamas":
			return "马瑞塔";
		case "MP_AfricanHalfaya":
			return "哈马达";
		case "MP_AfricanFox":
			return "民用机场";
		case "MP_Rotterdam":
			return "鹿特丹";
		case "MP_WE_Grind_ArcticFjord":
			return "艾尔舒丹[英德]";
		default:
			return mapName;
	}
}

/** 武器类型翻译 */
export function translateWeaponType(weaponName: string): string {
	let translatedType: string;
	switch (weaponName) {
		case "WCNAME_MMG":
		case "MMG":
			translatedType = "重机枪";
			break;
		case "WCNAME_AMR":
		case "AMR":
			translatedType = "反器材步枪";
			break;
		case "CAT_GADGET":
		case "G":
			translatedType = "武器配件";
			break;
		case "WCNAME_PIC":
		case "PC":
			translatedType = "精确瞄准步枪";
			break;
		case "WCNAME_SIDEARM":
		case "H":
			translatedType = "手枪";
			break;
		case "WCNAME_ASSAULTRIFLE":
		case "AR":
			translatedType = "突击步枪";
			break;
		case "WCNAME_BAC":
		case "BAC":
			translatedType = "栓动卡宾枪";
			break;
		case "WCNAME_SEMIAUTORIFLE":
		case "SR":
			translatedType = "半自动步枪";
			break;
		case "CAT_MELEE":
		case "M":
			translatedType = "近战武器";
			break;
		case "WCNAME_LMG":
		case "LMG":
			translatedType = "轻机枪";
			break;
		case "WCNAME_SHOTGUN":
		case "S":
			translatedType = "霰弹枪";
			break;
		case "WCNAME_SMG":
		case "SMG":
			translatedType = "冲锋枪";
			break;
		case "WCNAME_BOLTACTIONRIFLE":
		case "SAR":
			translatedType = "精确步枪";
			break;
		case "WCNAME_engineering_equipment": // 假设这是EA中工程装备的对应类型
		case "E":
			translatedType = "工程装备";
			break;
		case "SP":
			translatedType = "导弹";
			break;
		case "WCNAME_SELFLOADINGRIFLE":
			translatedType = "半自动装填步枪";
			break;
		default:
			translatedType = weaponName;
	}
	return translatedType;
}

/** 武器名称翻译 */
export function translateWeaponName(weaponName: string): string {
	switch (weaponName) {
		case "MG 42":
			return "MG 42通用机枪";
		case "MG 34":
			return "MG 34通用机枪";
		case "VGO":
			return "VGO空勤机枪";
		case "M1922 MG":
			return "M1922机枪";
		case "S2-200":
			return "S2-200";
		case "M1919A6":
			return "M1919A6";
		case "Boys AT Rifle":
			return "博斯反坦克步枪";
		case "Panzerbüchse 39":
			return "39反坦克步枪";
		case "Frag Grenade Rifle":
			return "破片榴弹步枪";
		case "Sticky Dynamite":
			return "粘性炸药";
		case "Panzerfaust":
			return "反坦克榴弹手枪";
		case "Ammo Crate":
			return "弹药箱";
		case "Bandages":
			return "绷带";
		case "AT Mine":
			return "反坦克地雷";
		case "AP Mine":
			return "反步兵地雷";
		case "Medical Crate":
			return "医疗箱";
		case "Spotting Scope":
			return "观察镜";
		case "Flare Gun":
			return "信号枪";
		case "Spawn Beacon":
			return "重生信标";
		case "Smoke Grenade":
			return "烟雾手榴弹";
		case "Frag Grenade":
			return "破片手榴弹";
		case "Incendiary Grenade":
			return "燃烧手榴弹";
		case "PIAT":
			return "PIAT榴弹发射器";
		case "AT Grenade Pistol":
			return "反坦克手榴弹发射器";
		case "Smoke Grenade Rifle":
			return "烟雾弹步枪";
		case "Sniper Decoy":
			return "狙击诱饵";
		case "Anti-Tank Bundle Grenade":
			return "反坦克捆绑式手雷";
		case "Sticky Grenade":
			return "黏性手雷";
		case "Throwing Blade":
			return "飞刀";
		case "Impact Grenade":
			return "冲击手雷";
		case "Medical Syringe":
			return "医疗注射器";
		case "Fliegerfaust":
			return "防空铁拳";
		case "Shaped Charge":
			return "锥形装药";
		case "Lunge Mine":
			return "刺雷";
		case "M1A1 Bazooka":
			return "M1A1火箭筒";
		case "M2 Flamethrower":
			return "M2火焰喷射器";
		case "Katana":
			return "武士刀";
		case "Kunai":
			return "苦无";
		case "Doppel-Schuss":
			return "双发手枪";
		case "Type 99 Mine":
			return "九九式Mine";
		case "Firecrackers":
			return "爆竹";
		case "RMN50 Rifle Frag":
			return "RMN50手持迫击炮";
		case "Demolition Grenade":
			return "爆破手雷";
		case "Pistol Flamethrower":
			return "手枪火焰喷射器";
		case "Kampfpistole":
			return "战斗手枪";
		case "Trench Carbine":
			return "战壕卡宾枪";
		case "P08 Carbine":
			return "P08卡宾枪";
		case "Liberator":
			return "解放者";
		case "Repetierpistole M1912":
			return "斯太尔 M1912 手枪";
		case "Mk VI Revolver":
			return "韦伯利 Mk VI 转轮手枪";
		case "M1911":
			return "M1911 手枪";
		case "P38 Pistol":
			return "P38 手枪";
		case "Ruby":
			return "红宝石半自动手枪";
		case "P08 Pistol":
			return "P08 手枪";
		case "Type 94":
			return "九四式手枪";
		case "Model 27":
			return "M27 左轮手枪";
		case "Welrod":
			return "威尔洛德微声手枪";
		case "PPK":
			return "PPK 手枪";
		case "PPKS":
			return "PPKS 手枪";
		case "M1911 Suppressed":
			return "M1911 手枪（消音消焰）";
		case "StG 44":
			return "StG 44 突击步枪";
		case "Sturmgewehr 1-5":
			return "格韦尔 1-5 突击步枪";
		case "M1907 SF":
			return "温彻斯特 1907 型半自动步枪";
		case "Ribeyrolles 1918":
			return "利贝罗勒 1918 自动步枪";
		case "Breda M1935 PG":
			return "贝达 M1935半自动步枪";
		case "M2 Carbine":
			return "M2 卡宾枪";
		case "Commando Carbine":
			return "突击队卡宾枪";
		case "M28 con Tromboncino":
			return "M28 步枪榴弹发射器";
		case "Jungle Carbine":
			return "丛林卡宾枪";
		case "Gewehr 43":
			return "格韦尔 43 步枪";
		case "M1A1 Carbine":
			return "M1A1 卡宾枪";
		case "Turner SMLE":
			return "特纳 SMLE 步枪";
		case "Selbstlader 1916":
			return "鲁格 1906 半自动步枪";
		case "Gewehr 1-5":
			return "格韦尔 1-5 半自动步枪";
		case "Ag m/42":
			return "Ag m/42 半自动步枪";
		case "MAS 44":
			return "MAS 44 步枪";
		case "Karabin 1938M":
			return "Karabin 1938M 半自动步枪";
		case "M1 Garand":
			return "M1 加兰德步枪";
		case "M3 Infrared":
			return "M3 红外线狙击步枪";
		case "M1941 Johnson":
			return "M1941 约翰逊步枪";
		case "Scout Knife M1916":
			return "侦察兵小刀 M1916";
		case "Hatchet":
			return "斧头";
		case "Club":
			return "棍棒";
		case "Shovel":
			return "铲子";
		case "Pickaxe":
			return "尖嘴镐";
		case "Kukri":
			return "廓尔喀弯刀";
		case "British Army Jack Knife":
			return "英军小刀";
		case "Coupe Coupe":
			return "库佩库佩";
		case "Cricket Bat":
			return "板球棒";
		case "Lever Pipe":
			return "撬管";
		case "K98 Bayonet":
			return "K98 刺刀";
		case "Poignard":
			return "匕首";
		case "MKIII(S) Elite Combat Dagger":
			return "MKIII(S) 精英战斗匕首";
		case "German Naval Dagger":
			return "德国海军匕首";
		case "Broken Bottle":
			return "破损的瓶子";
		case "Burned Plank":
			return "烧焦的木板";
		case "Hachiwari":
			return "突刺棒";
		case "Escape Axe":
			return "逃生斧";
		case "EGW Survival Knife":
			return "EGW 求生小刀";
		case "Combat Knife":
			return "战斗刀";
		case "Barbed Baseball Bat":
			return "带刺棒球棍";
		case "Fallschirmjäger Switchblade":
			return "空降兵弹簧刀";
		case "Arditi Dagger":
			return "突击队匕首";
		case "Commando Machete":
			return "突击队砍刀";
		case "Sai":
			return "三节棍";
		case "Bolo-Guna":
			return "飞旋镖";
		case "Knuckle Duster":
			return "指节铜套";
		case "Shillelagh":
			return "爱尔兰棍";
		case "Ilse's Pickaxe":
			return "伊尔泽的尖嘴镐";
		case "Control Stick":
			return "控制杆";
		case "Lion Head Sword":
			return "狮头剑";
		case "Lewis Gun":
			return "刘易斯机枪";
		case "KE7":
			return "KE7 机枪";
		case "Bren Gun":
			return "布伦轻机枪";
		case "FG-42":
			return "FG42 伞兵机枪";
		case "LS/26":
			return "LS/26";
		case "Madsen MG":
			return "麦德森机枪";
		case "Chauchat":
			return "绍沙轻机枪";
		case "BAR M1918A2":
			return "M1918A2 式勃朗宁自动步枪";
		case "Type 97 MG":
			return "九七式车载重机枪";
		case "Type 11 LMG":
			return "十一年式轻机枪";
		case "12g Automatic":
			return "12 口径自动霰弹枪";
		case "M30 Drilling":
			return "M30 复合枪";
		case "M1897":
			return "M1897 霰弹枪";
		case "Model 37":
			return "M37 霰弹枪";
		case "Sjögren Shotgun":
			return "舍格伦霰弹枪";
		case "M1928A1":
			return "M1928A1 冲锋枪";
		case "MP34":
			return "MP34 冲锋枪";
		case "MP28":
			return "MP28 冲锋枪";
		case "STEN":
			return "斯登冲锋枪";
		case "Suomi KP/-31":
			return "索米 KP/-31 冲锋枪";
		case "EMP":
			return "埃尔马 EMP 冲锋枪";
		case "ZK-383":
			return "ZK-383 冲锋枪";
		case "MAB 38":
			return "MAB 38 冲锋枪";
		case "Type 100":
			return "百式冲锋枪";
		case "M3 Grease Gun":
			return "M3 冲锋枪";
		case "Type 2A":
			return "二式冲锋枪";
		case "Welgun":
			return "威尔甘冲锋枪";
		case "Krag-Jørgensen":
			return "Krag-Jørgensen 步枪";
		case "Gewehr M95/30":
			return "格韦尔 M95/30 步枪";
		case "Lee-Enfield No.4 Mk I":
			return "李-恩菲尔德 No.4 Mk I 步枪";
		case "Kar98k":
			return "Kar98k 步枪";
		case "Ross Rifle Mk III":
			return "罗斯 Mk Ⅲ 步枪";
		case "Type 99 Arisaka":
			return "九九式Arisaka";
		case "K31/43":
			return "K31/43";
		case "RSC":
			return "RSC 半自动步枪";
		case "Selbstlader 1906":
			return "Selbstlader 1906";
		case "Model 8":
			return "Model 8";
		case "ZH-29":
			return "ZH-29 步枪";
		default:
			return weaponName;
	}
}

/** 载具类型翻译 */
export function translateVehicleType(vehicleType: string): string {
	switch (vehicleType) {
		case "Planes":
			return "飞机";
		case "Tanks":
			return "坦克";
		case "Helicopters":
			return "直升机";
		case "Transports":
			return "运输载具";
		case "Stationary":
			return "定点武器";
		default:
			return vehicleType;
	}
}

/** 载具名称翻译 */
export function translateVehicleName(vehicleName: string): string {
	switch (vehicleName) {
		// 飞机类
		case "BF 109 G-2":
			return "BF 109 G-2 战斗机";
		case "BF 109 G-6":
			return "BF 109 G-6 战斗机";
		case "SPITFIRE MK VA":
			return "MK VA 喷火式战斗机";
		case "BLENHEIM MK IF":
			return "布伦海姆 MK IF 轰炸机";
		case "JU-88 A":
			return "Ju-88 A 轰炸机";
		case "CORSAIR F4U-1A":
			return "F4U-1A 海盗式战斗机";
		case "CORSAIR F4U-1C":
			return "F4U-1C 海盗式战斗机";
		case "ZERO A6M2":
			return "零式战斗机一一型";
		case "P51K Fighter":
			return "P51K 战斗机";
		case "A-20 Bomber":
			return "A-20 轰炸机";
		case "P-70 Night Fighter":
			return "P-70 夜间战斗机";

		// 装甲车辆类
		case "KÜBELWAGEN":
			return "水桶车";
		case "M3":
			return "M3 冲锋车";
		case "T48 GMC":
			return "T48 GMC";
		case "KETTENKRAD":
			return "半履带摩托车";
		case "SD. KFZ 251 HALFTRACK":
			return "SD. KFZ 251 半履带车";
		case "SD. KFZ. 251 PAKWAGEN":
			return "SD. KFZ. 251 PAKWAGEN 战车";
		case "UNIVERSAL CARRIER":
			return "通用运兵车";
		case "TRACTOR":
			return "拖拉机";
		case "TYPE 95 CAR":
			return "九五式小型乘用车";
		case "GPW":
			return "GPW";
		case "DINGHY":
			return "小艇";
		case "LCVP":
			return "LCVP";

		// 坦克类
		case "CHURCHILL MK VII":
			return "丘吉尔 MK VII 坦克";
		case "CHURCHILL GUN CARRIER":
			return "丘吉尔自行火炮";
		case "CHURCHILL CROCODILE":
			return "丘吉尔鳄鱼坦克";
		case "TIGER I":
			return "虎 I 坦克";
		case "STURMTIGER":
			return "突击虎坦克";
		case "PANZER 38T":
			return "38T 坦克";
		case "STAGHOUND T17E1":
			return "T17E1 猎鹿犬装甲车";
		case "PANZER IV":
			return "四号坦克";
		case "FLAKPANZER IV":
			return "四号自行高射炮";
		case "STURMGESCHUTZ IV":
			return "四号突击炮";
		case "VALENTINE MK VIII":
			return "MK VIII 型瓦伦丁坦克";
		case "VALENTINE ARCHER":
			return "瓦伦丁自行反坦克炮";
		case "VALENTINE AA MK I":
			return "防空 MK I 型瓦伦丁坦克";
		case "SHERMAN":
			return "谢尔曼坦克";
		case "T34 CALLIOPE":
			return "T34卡利欧波";
		case "TYPE 97":
			return "九七式";
		case "LVT":
			return "LVT";
		case "KA-MI":
			return "特二式内火艇";
		case "M8 GREYHOUND":
			return "M8 灰狗";
		case "SdKfz 234 PUMA":
			return "SdKfz 234 美洲豹";

		// 其他武器装备类
		case "6 POUNDER":
			return "6 磅 炮";
		case "FLAK 38":
			return "38 型高射炮";
		case "PAK 40":
			return "PAK 40 反坦克炮";
		case "VICKERS":
			return "维克斯机枪";
		case "STATIONARY MG34":
			return "MG34 定点机枪";
		case "TYPE 93 HMG":
			return "九三式重机枪";
		case "40MM AA":
			return "40 毫米防空炮";
		case "TYPE 10":
			return "10 式";

		default:
			return vehicleName;
	}
}
