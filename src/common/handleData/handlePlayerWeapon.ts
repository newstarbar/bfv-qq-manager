import { AllVechileDate, AllWeaponDate, VechileData, WeaponData } from "../../interface/player";
import { translateVehicleName, translateVehicleType, translateWeaponName, translateWeaponType } from "../../utils/translation";


/** 玩家武器数据处理 */
export function handlePlayerWeapon(weaponData: any, type: 'ea' | 'gt'): AllWeaponDate[] {
    let allWeaponDate: AllWeaponDate[] = [];
    if (type === 'ea') {
        for (let i = 0; i < weaponData.length; i++) {
            const item: AllWeaponDate = weaponData[i];
            const categoryId = translateWeaponType(item.categoryId.replace('ID_P_', ''));
            const weapons = item.weapons;
            let weaponDataList: WeaponData[] = [];
            for (let j = 0; j < weapons.length; j++) {
                const weapon: any = weapons[j];
                const name = translateWeaponName(weapon.name);
                const kills = weapon.stats.values.kills || 0;
                const headshots = weapon.stats.values.headshots || 0;
                const seconds = weapon.stats.values.seconds || 0;
                const score = weapon.stats.values.score || 0;
                const kpm = weapon.extendedStats.values["per minute kills"] || 0;
                const weaponData: WeaponData = { name, kills, headshots, seconds, kpm, score };
                weaponDataList.push(weaponData);
            }
            allWeaponDate.push({ categoryId, weapons: weaponDataList });
        }

    } else if (type === 'gt') {
        const categoryId = "ALL";
        let weaponDataList: WeaponData[] = [];
        for (let i = 0; i < weaponData.length; i++) {
            const weapon: any = weaponData[i];
            const name = translateWeaponName(weapon.weaponName);
            const kills = weapon.kills || 0;
            const headshots = weapon.headshotKills || 0;
            const seconds = weapon.timeEquipped || 0;
            const score = weapon.score || 0;
            const kpm = weapon.killsPerMinute || 0;
            const weaponD: WeaponData = { name, kills, headshots, seconds, kpm, score };
            weaponDataList.push(weaponD);
        }
        allWeaponDate.push({ categoryId, weapons: weaponDataList });

    }
    return allWeaponDate;
}


/** 玩家载具数据处理 */
export function handlePlayerVehicle(vehicleData: any, type: 'ea' | 'gt'): AllVechileDate[] {
    let allVehicleDate: AllVechileDate[] = [];
    if (type === 'ea') {
        for (let i = 0; i < vehicleData.length; i++) {
            const item: any = vehicleData[i];
            const categoryId = translateVehicleType(item.categoryId);
            const vechiles = item.vehicles;
            let vechileDataList: VechileData[] = [];
            for (let j = 0; j < vechiles.length; j++) {
                const vechile: any = vechiles[j];
                const name = translateVehicleName(vechile.name);
                const kills = vechile.stats.values.kills || 0;
                const seconds = vechile.stats.values.seconds || 0;
                const vehicleDestroy = vechile.stats.values["vehicle destroy"] || 0;
                const kpm = Number((kills / (seconds / 60)).toFixed(2)) || 0;
                const vechileData: VechileData = { name, kills, seconds, vehicleDestroy, kpm };
                vechileDataList.push(vechileData);
            }
            allVehicleDate.push({ categoryId, vechiles: vechileDataList });
        }

    } else if (type === 'gt') {
        const categoryId = "ALL";
        let vechileDataList: VechileData[] = [];
        for (let i = 0; i < vehicleData.length; i++) {
            const vechile: any = vehicleData[i];
            const name = translateVehicleName(vechile.vehicleName);
            const kills = vechile.kills || 0;
            const seconds = 0;
            const vehicleDestroy = 0;
            const kpm = vechile.killsPerMinute || 0;
            const vechileData: VechileData = { name, kills, seconds, vehicleDestroy, kpm };
            vechileDataList.push(vechileData);
        }
        allVehicleDate.push({ categoryId, vechiles: vechileDataList });

    }
    return allVehicleDate;
}