
async function fetchPlayerPersonaId(name: string) {
    const response = await fetch(`https://api.bfvrobot.net/api/bfv/player?name=${name}`)
    if (!response.ok) {
        return '00';
    }
    const data = await response.json();
    return data.data.personaId;
}

async function fetchPlayerBaseData(personaId: number) {
    const response = await fetch(`https://api.bfvrobot.net/api/worker/player/getAllStats?personaId=${personaId}`)
    if (!response.ok) {
        return '00';
    }
    const data = await response.json();
    return data.data;
}

async function fetchPlayerBFBAN(personaId: number) {
    const response = await fetch(`https://api.bfban.com/api/player?personaId=${personaId}&history=true`)
    const data = await response.json();
    return data;
}

async function fetchPlayerROBOT(personaId: number) {
    const response = await fetch(`https://api.bfvrobot.net/api/player/getCommunityStatus?personaId=${personaId}`)
    if (!response.ok) {
        return '00';
    }
    const data = await response.json();
    return data.data.reasonStatusName;
}

export async function generateRecordImage(name: string): Promise<{ isSuccess: boolean, content: string }> {
    // 获取开始查询的时间
    const startTime = new Date().getTime();

    const personaId = await fetchPlayerPersonaId(name);
    const data = await fetchPlayerBaseData(personaId);
    const Bfban = await fetchPlayerBFBAN(personaId);
    const RobotStatus = await fetchPlayerROBOT(personaId);

    // 数据异常的列表
    const abnormalList = checkAbnormalWeapons(data);

    if (personaId == '00') {
        return { isSuccess: false, content: '玩家不存在！' };
    }


    if (data == '00' || RobotStatus == '00') {
        return { isSuccess: false, content: '玩家数据异常，请稍后再试！' };
    }

    let BfbanStatus = '未知'
    if (Bfban.code == 'player.ok') {
        switch (Bfban.data.status) {
            case 0:
                BfbanStatus = '状态正常'
                break
            case 1:
                BfbanStatus = '石锤'
                break
            case 2:
                BfbanStatus = '待自证'
                break
            case 6:
                BfbanStatus = '需要更多管理投票'
                break
            case 3:
                BfbanStatus = 'MOSS自证'
                break
            case 4:
                BfbanStatus = '无效举报'
                break
            case 8:
                BfbanStatus = '刷枪'
                break
            default:
                BfbanStatus = '状态正常'
        }
    } else if (Bfban.code === 'player.notFound') {
        BfbanStatus = '无案件'
    } else if (Bfban.code === 'player.bad') {
        BfbanStatus = '网络异常,请求失败'
    }

    // 计算结束查询的时间和耗时
    const endTime = new Date().getTime();
    const queryTime = (endTime - startTime) / 1000; // 转换为秒

    const content = `
<!DOCTYPE html>
<html>
<head>
<style>
  body {
    font-family: 'Microsoft YaHei', sans-serif;
    margin: 0;
    padding: 0;
    background-color: #1a1a1a; /* 深灰色背景 */
    color: #ffffff; /* 白色文字 */
  }
  .container {
    width: 95%;
    margin: 5px auto;
    background: #222; /* 深灰色背景 */
    padding: 10px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
    border-radius: 8px;
    font-size: 1.2em;
  }
  h1, h2 {
    color: #ffffff; /* 白色标题 */
    margin: 0 0 20px 0;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 10px;
    font-size: 1.2em;
  }
  th, td {
    padding: 10px;
    text-align: center;
    border-bottom: 1px solid #333; /* 深灰色边框 */
  }
  th {
    background-color: #333; /* 深灰色表头背景 */
    color: #ffffff; /* 白色表头文字 */
  }
  tr:hover {
    background-color: #444; /* 深灰色行背景 */
  }
  .footer {
    text-align: center;
    padding: 10px;
    color: #cccccc; /* 浅灰色页脚文字 */
    font-size: 0.9em;
  }
  .BFBAN-green {
      color: #00ff00; /* 绿色 */
  }
  .BFBAN-red {
      color: #ff0000; /* 红色 */
  }
  .ROBOT-green {
      color: #00ff00; /* 绿色 */
  }
  .ROBOT-red {
      color: #ff0000; /* 红色 */
  }
  .abnormal-weapons {
      color: #ff0000; /* 红色 */
  }
  .normal-weapons {
      color: #00ff00; /* 绿色 */
  }
</style>
</head>
<body>
<div class="container">
  <div class="player-info">
    <h1>${name || '未知'}&nbsp;&nbsp;[${personaId}]</h1>
    <h2>
      <strong>等级:</strong> ${data.rank || '无'}
      &nbsp;&nbsp;
      <strong>KD:</strong> ${data.killDeath || '无'}
      &nbsp;&nbsp;
      <strong>KPM:</strong> ${data.killsPerMinute || '无'}
      <br>
      <strong>时间:</strong> ${(data.timePlayed / 60 / 60).toFixed(1) || '无'} (h)
      &nbsp;&nbsp;
    </h2>
    <h2>
      <strong class="${data.unpackWeapon.length > 0 ? 'abnormal-weapons' : 'normal-weapons'}">异常武器: ${data.unpackWeapon.length || '无'}</strong>
      &nbsp;&nbsp;
      <strong class="${BfbanStatus === '石锤' ? 'BFBAN-red' : 'BFBAN-green'}">BFBAN: ${BfbanStatus}</strong>
      &nbsp;&nbsp;
      <strong class="${(RobotStatus === '武器数据异常') || (RobotStatus === '全局黑名单') ? 'ROBOT-red' : 'ROBOT-green'}">ROBOT: ${RobotStatus}</strong>
    </h2>
  </div>

  <div class="stats-container">
    <div class="stats-box">
      <table>
        <thead>
          <tr>
            <th>异常武器名称</th>
            <th>原因</th>
          </tr>
        </thead>
        <tbody>
          ${abnormalList.length > 0 ? abnormalList.map(weapon => `
                <tr>
                  <td>${weapon.name}</td>
                  <td>${weapon.reason}</td>
                </tr>
              `).join('') : '<tr><td colspan="2">无异常武器</td></tr>'}
        </tbody>
      </table>
    </div>

  <div class="stats-container">
    <div class="stats-box">
      <table>
        <thead>
          <tr>
            <th>名称</th>
            <th>击杀</th>
            <th>每分钟击杀</th>
            <th>时间(h)</th>
            <th>爆头率</th>
          </tr>
        </thead>
        <tbody>
          ${data.weapons
            .sort((a: any, b: any) => b.kills - a.kills)
            .slice(0, 5)
            .map((weapon: any) => `
                <tr>
                  <td>${weapon.name || '无'}</td>
                  <td>${weapon.kills || '无'}</td>
                  <td>${weapon.killsPerMinute || '无'}</td>
                  <td>${(weapon.timeEquipped / 60 / 60).toFixed(1) || '无'}</td>
                  <td>${weapon.headshots || '无'}</td>
                </tr>
              `).join('')}
        </tbody>
      </table>
    </div>

    <div class="stats-box">
      <table>
        <thead>
          <tr>
            <th>名称</th>
            <th>击杀</th>
            <th>摧毁</th>
            <th>时间(h)</th>
            <th>每分钟击杀数</th>
          </tr>
        </thead>
        <tbody>
          ${data.vehicles
            .sort((a: any, b: any) => b.kills - a.kills)
            .slice(0, 5)
            .map((vehicle: any) => `
                <tr>
                  <td>${vehicle.name || '无'}</td>
                  <td>${vehicle.kills || '无'}</td>
                  <td>${vehicle.destroy || '无'}</td>
                  <td>${(vehicle.timeEquipped / 60 / 60).toFixed(1) || '无'}</td>
                  <td>${vehicle.killsPerMinute || '无'}</td>
                </tr>
              `).join('')}
        </tbody>
      </table>
      <table>
        <thead>
          <tr>
            <th>名称</th>
            <th>击杀</th>
            <th>每分钟击杀</th>
            <th>时间(h)</th>
          </tr>
        </thead>
        <tbody>
          ${data.gadgets
            .sort((a: any, b: any) => b.kills - a.kills)
            .slice(0, 3)
            .map((gadget: any) => `
                <tr>
                  <td>${gadget.name || '无'}</td>
                  <td>${gadget.kills || '无'}</td>
                  <td>${gadget.killsPerMinute || '无'}</td>
                  <td>${(gadget.timeEquipped / 60 / 60).toFixed(1) || '无'}</td>
                </tr>
              `).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <div class="footer">
    <p>耗时: ${queryTime.toFixed(2)} 秒 | 查询时间: ${new Date().toLocaleString()} | 数据来源: BFBAN & BFV ROBOT</p>
  </div>
</div>
</body>
</html>`;

    // const base64 = await htmlToBase64Image(content);
    return { isSuccess: true, content: "base64" };
}

export async function generateAIRecordString(name: string): Promise<string> {
    const personaId = await fetchPlayerPersonaId(name);
    const data = await fetchPlayerBaseData(personaId);

    if (personaId == '00' || data == '00') {
        return "当前网络异常，请稍后再试！";
    }
    // 基本信息
    const baseInfo = `玩家:${name} \n[${personaId}]\n ======== 基本数据 ========\n`
    // 基本数据
    const baseData = `等级:  ${data.rank} \n击杀:  ${data.kills} 死亡:  ${data.deaths} \n游戏时间(h):  ${(data.timePlayed / 60 / 60).toFixed(1)} \nKD:  ${data.killDeath} KPM:  ${data.killsPerMinute} \n爆头数:  ${data.headshots} \n`

    // 武器数据 击杀最高的前三把枪
    const weaponData = `\n ======== 武器数据 ========\n` + data.weapons.sort((a: any, b: any) => b.kills - a.kills).slice(0, 5).map((weapon: any) => {
        return `名称:  ${weapon.name} \n击杀:  ${weapon.kills} 时间(h):  ${(weapon.timeEquipped / 60 / 60).toFixed(1)} \n爆头率:  ${weapon.headshots} `
    }).join('\n----------------------------------\n')

    // 载具数据 击杀最高的前三把载具
    const vehicleData = `\n\n ======== 载具数据 ========\n` + data.vehicles.sort((a: any, b: any) => b.kills - a.kills).slice(0, 5).map((vehicle: any) => {
        return `名称:  ${vehicle.name} \n击杀:  ${vehicle.kills} 时间(h):  ${(vehicle.timeEquipped / 60 / 60).toFixed(1)} \n摧毁:  ${vehicle.destroy} 伤害:  ${vehicle.damage} `
    }).join('\n----------------------------------\n')

    // 配件数据 击杀最高的前三把配件
    const gadgetData = `\n\n ======== 配件数据 ========\n` + data.gadgets.sort((a: any, b: any) => b.kills - a.kills).slice(0, 3).map((gadget: any) => {
        return `名称:  ${gadget.name} \n击杀:  ${gadget.kills} 时间(h):  ${(gadget.timeEquipped / 60 / 60).toFixed(1)} `
    }).join('\n----------------------------------\n')

    // 组装字符串
    const content = baseInfo + baseData + weaponData + vehicleData + gadgetData
    const options = {
        method: 'POST',
        headers: {
            Authorization: 'Bearer sk-xtspzjzuhzgiiflmhgsrzgkzmqbgpwfdyrrgokaifnqqaicq',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: "Qwen/Qwen2.5-7B-Instruct",
            messages: [{
                role: "user",
                content: [{
                    type: "text",
                    text: "我是一名Battlefield Ⅴ玩家，请根据我提供的生涯数据，进行分析，要求600字以内。不要复述我的数据，请直接给出分析，" + content
                }]
            }],
            stream: false,
            max_tokens: 718,
            stop: ["null"],
            temperature: 0.7,
            top_p: 0.7,
            top_k: 50,
            frequency_penalty: 0.5,
            n: 1,
            response_format: {
                type: "text"
            }
        })
    };
    const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', options);
    if (response.status === 200) {
        const json = await response.json();
        // 返回数据
        return json.choices[0].message.content
    } else {
        return "当前网络异常，请稍后再试！"
    }
}

// 狙击枪的枪械列表
const sniperWeapons = [
    "李-恩菲尔德 No.4 Mk I 步枪",
    "Model 8 半自动步枪",
    "格韦尔 M95/30 步枪",
    "ZH-29 步枪",
    "Krag-Jørgensen 步枪",
    "RSC 半自动步枪",
    "毛瑟 Kar98k 步枪",
    "鲁格 1906 半自动步枪",
    "罗斯 Mk Ⅲ 步枪",
    "赛博反坦克步枪",
    "P08 卡宾枪",
    "39 反坦克步枪",
    "K31/43",
    "九九式步枪",
    "战壕卡宾枪",
    "M3 红外线狙击步枪",
    "K31/43",
]

const excludeWeapons = [
    "弯刀"
]

/** 查询数据异常的枪械 */
function checkAbnormalWeapons(data: any): any[] {
    let abnormalWeapons: any[] = [];
    const totalKillsPerMinute = data.killsPerMinute;
    data.weapons.forEach((weapon: any) => {
        const isA = excludeWeapons.some(weaponName => weapon.name.includes(weaponName));
        if (!isA) {
            const name = weapon.name;
            const kills = weapon.kills;
            const killsPerMinute = weapon.killsPerMinute;
            // headshots是"13.79%"要先去除%符号
            const headshots = Number(weapon.headshots.replace('%', ''));

            const diffKPM = (killsPerMinute - totalKillsPerMinute) / totalKillsPerMinute * 100;

            if (kills >= 280) {
                if (sniperWeapons.includes(name)) {
                    if (headshots > 50) {
                        if (killsPerMinute > 2 && diffKPM > 40) {
                            abnormalWeapons.push({
                                name: name,
                                reason: `KPM 异常[高由于生涯${diffKPM.toFixed(1)}% 且 爆头率异常[${headshots}%]]`,
                            });
                        } else {
                            abnormalWeapons.push({
                                name: name,
                                reason: `爆头率异常[${headshots}%]`,
                            });
                        }
                    } else if (killsPerMinute > 2 && diffKPM > 40) {
                        abnormalWeapons.push({
                            name: name,
                            reason: `KPM 异常[高由于生涯${diffKPM.toFixed(1)}%]`,
                        });
                    }
                } else {
                    if (headshots > 35) {
                        if (killsPerMinute > 2 && diffKPM > 40) {
                            abnormalWeapons.push({
                                name: name,
                                reason: `KPM 异常[高由于生涯${diffKPM.toFixed(1)}% 且 爆头率异常[${headshots}%]]`,
                            });
                        } else {
                            abnormalWeapons.push({
                                name: name,
                                reason: `爆头率异常[${headshots}%]`,
                            });
                        }
                    } else if (killsPerMinute > 2 && diffKPM > 40) {
                        abnormalWeapons.push({
                            name: name,
                            reason: `KPM 异常[高由于生涯${diffKPM.toFixed(1)}%]`,
                        });
                    }
                }
            } else if (kills >= 80) {
                if (sniperWeapons.includes(name)) {
                    if (headshots > 65) {
                        if (killsPerMinute > 2 && diffKPM > 40) {
                            abnormalWeapons.push({
                                name: name,
                                reason: `KPM 异常[高由于生涯${diffKPM.toFixed(1)}% 且 爆头率异常[${headshots}%]]`,
                            });
                        } else {
                            abnormalWeapons.push({
                                name: name,
                                reason: `爆头率异常[${headshots}%]`,
                            });
                        }
                    } else if (killsPerMinute > 2 && diffKPM > 40) {
                        abnormalWeapons.push({
                            name: name,
                            reason: `KPM 异常[高由于生涯${diffKPM.toFixed(1)}%]`,
                        });
                    }
                } else {
                    if (headshots > 40) {
                        if (killsPerMinute > 2 && diffKPM > 40) {
                            abnormalWeapons.push({
                                name: name,
                                reason: `KPM 异常[高由于生涯${diffKPM.toFixed(1)}% 且 爆头率异常[${headshots}%]]`,
                            });
                        } else {
                            abnormalWeapons.push({
                                name: name,
                                reason: `爆头率异常[${headshots}%]`,
                            });
                        }
                    } else if (killsPerMinute > 2 && diffKPM > 40) {
                        abnormalWeapons.push({
                            name: name,
                            reason: `KPM 异常[高由于生涯${diffKPM.toFixed(1)}%]`,
                        });
                    }
                }
            }
        }
    })
    if (data.unpackWeapon.length > 0) {
        data.unpackWeapon.forEach((weapon: any) => {
            abnormalWeapons.push({
                name: weapon.name,
                reason: "解包武器"
            });
        })
    }
    return abnormalWeapons;
}