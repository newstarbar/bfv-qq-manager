# BFV 二代服管机[最终版本 2.2.0]【已停止更新维护】

一款针对 BFV（战地 5）服务器的高效管理工具，基于 QQ 机器人实现便捷操作，支持服务器配置管理、权限控制、自动播报、玩家战绩追踪等功能，旨在为服主提供更流畅的服务器运维体验。

> ⚠️ 免责声明：使用本 BFV 二代服管机程序的服主请注意。服主是否存在违规（皇人）行为与开发组 Zygo 无关。本程序依赖于 BFV ROBOT 社区的相关服务，若发现皇服情况，请联系 BFV ROBOT 社区进行处理。

## 快速上手

1. 跳转到[发布页面](https://github.com/newstarbar/bfv-qq-manager/releases)下载最新版本
2. 解压安装包至本地目录
3. 参考[使用整合包指南](使用整合包指南.md)完成环境配置
4. 启动程序即可开始使用

## ✨ 功能特点

| 功能分类   | 具体功能                                             | 状态      |
| ---------- | ---------------------------------------------------- | --------- |
| 权限管理   | 完善的权限控制系统（不再再完全依赖头衔）             | ✅ 已实现 |
|            | 权限分级系统（精细化权限管控）                       | ✅ 已实现 |
| 服务器管理 | 服务器状态监控与考勤管理                             | ✅ 已实现 |
|            | 便捷的配置管理（创建/更新/修改服务器配置）           | ✅ 已实现 |
|            | 限制特定武器/载具的使用                              | ✅ 已实现 |
| 数据查询   | 基于 EAcookie 的稳定查询机制                         | ✅ 已实现 |
|            | 玩家战绩记录与排行榜功能                             | ✅ 已实现 |
| 自动化功能 | 自动化 cookie 管理                                   | ✅ 已实现 |
|            | 多场景自动播报（服务器状态/踢人通知）                | ✅ 已实现 |
| 超杀管理   | 分角色超杀阈值设置（群友/路人/暖服成员）             | ✅ 已实现 |
|            | 结算后自动添加超杀玩家至临时黑名单（暖服时自动解除） | ✅ 已实现 |
|            | 分步战限杀、载具限杀                                 | ⏳ 开发中 |
| 安全检测   | 武器异常检测（可自定义严格程度，自动踢出异常玩家）   | ⏳ 开发中 |

## 📋 前置环境

使用前需完成以下依赖配置，确保程序正常运行：

### 1. napcat 框架配置

BFV 二代服管机依赖 napcat 框架实现 QQ 机器人功能。napcat 是基于 NTQQ 的现代化 Bot 协议端，支持无图形环境运行，在 Linux 系统表现优异，性能与内存占用优于传统 Hook 框架。

-   **项目地址**：[NapNeko/NapCatQQ](https://github.com/NapNeko/NapCatQQ)
-   **官方文档**：[NapCat 官方文档](https://napneko.github.io)（含安装、配置及接口说明）
-   **Windows 下载**：[一键安装包](https://github.com/NapNeko/NapCatQQ/releases/latest/download/napcat.shell.windows.onekey.zip)，解压后运行 `napcat installer.exe` 自动下载依赖，生成类似 `napcat.xxxx.shell` 的文件夹（后续配置在此文件夹操作）。
-   **配置要点**：确保服管机配置文件中的 `ws_ip`、`ws_token`、`http_ip`、`http_token` 与 napcat 配置一致（默认值通常无需修改，特殊配置需对应调整）：
    ```json
    {
    	"ws_ip": "127.0.0.1:3001", // 与napcat配置对应
    	"ws_token": "napcat", // 与napcat配置一致
    	"http_ip": "127.0.0.1:3000", // 与napcat配置对应
    	"http_token": "napcat" // 与napcat配置一致
    }
    ```

### 2. BFV ROBOT 社区第三方平台绑定

需完成 QQ、KOOK、QQ Open ID 绑定，以支持社区机器人交互及功能调用。

-   **详细指南**：[BFV ROBOT 社区用户第三方平台绑定指南](https://zth.ink/?p=558)
-   **QQ 绑定流程**：参考 [QQ 绑定原文](https://forum.bfvrobot.net/t/topic/625)，通过 QQ 邮箱验证完成绑定；若无法访问原 QQ 号，可联系社区成员协助解绑。
-   **QQ Open ID 绑定**：
    1. 使用 RunRun 机器人（ROBOT 团队官方机器人）单聊输入 `/bind` 获取 Open ID；
    2. 登录 ROBOT 官网，在个人界面第三方账户区域填入 Open ID 并完成人机验证；
    3. 回到 RunRun 机器人私聊输入 `/bindVerify` 完成绑定。
-   **补充说明**：部分指令需绑定社区用户后使用，参考 [BFV ROBOT 社区公共 QQ 机器人食用指南](https://zth.ink/?p=572)。

## 📥 下载与安装

### 1. 依赖与程序下载

1. 下载 **V2 前置环境依赖**：

    - Windows：[Win-Configure.zip](https://github.com/newstarbar/bfv-qq-manager/releases/download/v2/Win-Configure.zip)
    - Linux：[Linux-Configure.tar](https://github.com/newstarbar/bfv-qq-manager/releases/download/v2/Linux-Configure.tar)  
      解压到程序同级目录。

2. 下载最新版本主程序：

    - Windows：`bfv-manager-win.exe`
    - Linux：`bfv-manager-linux.sh`  
      放置在程序同级目录。

3. 下载数据统计程序：
    - Windows：`data-statistics-win.exe`
    - Linux：`data-statistics-linux.sh`  
      放置在程序同级目录（推荐主程序部署在国内云服务器，数据统计程序部署在国外服务器，使用同一环境依赖）。

### 2. 启动步骤

1. 运行主程序：

    - Windows：双击 `bfv-manager-win.exe`
    - Linux：执行 `bash bfv-manager-linux.sh`

2. 启动数据统计程序：

    - Windows：双击 `data-statistics-win.exe`
    - Linux：执行 `bash data-statistics-linux.sh`
    - 若主程序与数据统计程序不在同一机器，需修改配置文件 `data_statistics_ip` 项，并运行 [开放端口脚本](https://github.com/newstarbar/bfv-qq-manager/blob/main/doc/开启dataStatistics服务端口.bat)；云服务器需在安全组开放 7639 端口。

3. 按提示完成配置，等待程序启动完成。

## 🔧 环境配置

### 1. 生图模块部署

1. 将 `chrome.zip` 放置在主程序（`bfv-manager-win.exe` 或 `bfv-manager-linux.sh`）同级文件夹；
2. 解压得到 `chrome` 文件夹，确保目录结构如下：
    ```
    BFVQQ服管系统.exe
    chrome/
    └── win/
        └── chrome.exe
    ```
    （此为固定环境配置，后续版本更新无需改动）。

### 2. 核心配置文件修改

找到程序同级目录的 `config.json`（或类似名称）配置文件，按以下说明修改：

```json
{
	"status_ip": "127.0.0.1:7639", // 服务器玩家对局战绩查询接口
	"status_token": "zygo", // 战绩查询接口token（外部部署需修改，勿泄露）
	"ws_ip": "127.0.0.1:3001", // 与napcat配置对应，请勿修改默认值
	"ws_token": "napcat", // 与napcat配置一致，请勿修改默认值
	"http_ip": "127.0.0.1:3000", // 与napcat配置对应，请勿修改默认值
	"http_token": "napcat", // 与napcat配置一致，请勿修改默认值
	"bot_name": "服管机器人", // 自定义机器人QQ昵称（踢人时显示）
	"bot_qq": "", // 填写机器人QQ号（需完成验证）
	"admin_qq": "", // 填写超级管理员QQ号（初始化群聊必填）
	"group_name": "", // 填写群组名称（需完成验证）
	"ai_token": "", // AI模块token（获取地址：https://cloud.siliconflow.cn/i/wIXurGHa）
	"ai_model": "Qwen/Qwen2.5-7B-Instruct" // AI模型名称（获取地址：https://cloud.siliconflow.cn/me/models）
}
```

### 3. 配置服务器武器限制

参考[示例配置文件](https://github.com/newstarbar/bfv-qq-manager/blob/main/doc/check_config.json)

-   该文件需放置`config.json`同级目录, 名称为`check_config.json`
-   每个服务器单独配置： - `server_name`：服务器中文名称（需完全一致）
-   `ban_list`：禁用武器列表
-   `name`：禁用武器名称
-   `start_time`：禁用开始时间
-   `end_time`：禁用结束时间
-   时间严格遵守 `HH-MM` 24 小时制，如 00-00 为凌晨 0 点，23-59 为深夜 12 点，既全天禁用。

## 🚀 初次使用流程

### 1. 初始化群聊

在目标 QQ 群内发送 `init` 命令，完成群聊初始化。

### 2. 刷新群成员权限

发送 `update` 命令，自动识别群成员头衔并分配初始权限：

-   头衔含「督战队」→ 1 级管理员
-   头衔含「都督」→ 2 级管理员
-   头衔含「总督」「群主」「服主」→ 3 级管理员
-   配置文件 `admin_qq` 对应账号 → 4 级超级管理员（唯一）

### 3. 手动设置管理员权限

发送命令 `admin=QQ号 权限等级`（示例：`admin=123456 1`），设置后需再次发送 `update` 生效。

### 4. Cookie 管理

-   超管绑定他人 Cookie：发送 `cookie=EAID QQ号 SID`
-   管理员私聊机器人更新自身 Cookie：发送 `sid=具体Cookie[SID]`
-   Cookie 过期时，机器人会自动私聊提醒。

### 5. 设置 EA 查询主账号

发送 `main=EAID` 指定主账号（⚠️ 强烈建议使用开通 EA 密钥的红信账号，降低封禁风险）。

### 6. 配置服务器限制武器

-   参考 [示例配置](https://github.com/newstarbar/bfv-qq-manager/blob/main/doc/check_config.json)，每个服务器需单独配置；
-   `server_name` 需与服务器中文名称一致；
-   `ban_list` 为禁用武器列表，含 `name`（武器名称）、`start_time`（禁用开始时间，HH-MM 格式）、`end_time`（禁用结束时间）、`reason`（禁用原因）。

## 📝 详细配置指南

### 一、服务器配置

#### 1. 创建服务器

##### 群聊创建格式

```
create=序号 "中文服名" "原服名" 开服ID 不暖服限制等级 暖服限制等级 限制kd 限制kpm 非群友限杀 群友限杀 几人以下算暖服 是否为小电视
```

示例：`create=1 "测试服" "TestServer" 1001 10 5 2.0 1.5 3 5 3 false`

##### 私聊创建格式（需添加 QQ 群号）

```
create=序号 "中文服名" "原服名" 群号 开服ID 不暖服限制等级 暖服限制等级 限制kd 限制kpm 非群友限杀 群友限杀 几人以下算暖服 是否为小电视
```

示例：`create=1 "测试服" "TestServer" 123456 1001 10 5 2.0 1.5 3 5 3 false`

##### 参数说明

| 参数位置       | 含义                   | 规范要求                 |
| -------------- | ---------------------- | ------------------------ |
| 序号           | 自定义服务器标识       | 数字                     |
| 中文服名       | 服务器中文名称         | 英文引号包裹             |
| 原服名         | 服务器原始名称         | 英文引号包裹             |
| 群号           | 关联 QQ 群号（私聊用） | 数字（群聊创建无需填写） |
| 开服 ID        | 网页开服唯一 ID        | 数字                     |
| 不暖服限制等级 | 非暖服状态等级限制     | 数字                     |
| 暖服限制等级   | 暖服状态等级限制       | 数字                     |
| 限制 kd        | KD 值限制              | 数字（支持小数）         |
| 限制 kpm       | KPM 值限制             | 数字（支持小数）         |
| 非群友限杀     | 非群成员超杀阈值       | 数字                     |
| 群友限杀       | 群成员超杀阈值         | 数字                     |
| 暖服判定人数   | 低于该人数视为暖服     | 数字                     |
| 是否为小电视   | 是否开启小电视功能     | true/false               |

#### 2. 更新服务器配置

##### 格式

```
update=序号 修改项 修改值
```

示例：`update=1 level 15`（将序号 1 的服务器不暖服限制等级改为 15）

##### 可修改配置项

| 配置项  | 配置名         | 规范要求                |
| ------- | -------------- | ----------------------- |
| zh_name | 服务器中文名   | 英文引号包裹的全称      |
| en_name | 服务器原始名称 | 英文引号包裹的全称      |
| id      | ConfigID       | 网页开服唯一 ID（数字） |
| level   | 限制等级       | 数字（不暖服状态）      |
| kd      | 限制 KD        | 数字（支持小数）        |
| kpm     | 限制 KPM       | 数字（支持小数）        |
| nokill  | 未加群限杀     | 数字                    |
| kill    | 加群限杀       | 数字                    |
| warm    | 暖服判定人数   | 数字                    |
| tv      | 是否为小电视   | true/false              |

##### 注意事项

-   若服务器处于开启状态，修改后需发送 `check` 命令更新信息（会打断暖服记录进度，谨慎使用）。

### 二、自动播报配置

#### 1. 创建播报配置

##### 群聊创建格式

```
saytext=序号 [内容1][内容2][...]
```

示例：`saytext=1 [欢迎加入测试服][当前服务器限制等级10级][请遵守服务器规则]`

##### 私聊创建格式（需添加 QQ 群号）

```
saytext=序号 群号 [内容1][内容2][...]
```

示例：`saytext=1 123456 [欢迎加入测试服][当前服务器限制等级10级]`

##### 说明

-   序号需与对应服务器的序号一致；
-   内容用英文括号分段，每段最多 90 个字符（分段用于轮播展示，避免长公告）。

#### 2. 更新播报配置

##### 群聊修改格式

```
sayupdate=序号 修改项 修改值
```

示例：`sayupdate=1 interval 5`（将序号 1 的播报间隔改为 5 分钟）

##### 私聊修改格式（需添加 QQ 群号）

```
sayupdate=序号 群号 修改项 修改值
```

示例：`sayupdate=1 123456 enable 0`（关闭序号 1 的播报）

##### 可修改配置项

| 配置项    | 配置名           | 规范要求                 |
| --------- | ---------------- | ------------------------ |
| texts     | 播报内容         | [内容 1][内容2][...]格式 |
| warm_text | 暖服播报内容     | 纯字符（不带括号）       |
| interval  | 播报间隔（分钟） | 数字                     |
| enable    | 播报启用状态     | 0（关闭）/1（开启）      |

##### 注意事项

-   屏蔽播报和管理员发信息不受 `enable` 状态影响。

## ⚠️ 重要注意事项

1. 所有命令中的引号均需使用**英文引号**，不可使用中文引号。
2. 私聊创建/修改服务器或播报配置时，必须添加对应的 QQ 群号；群聊中操作无需群号。
3. 服务器配置修改后，若服务器处于开启状态，需使用 `check` 命令更新信息。

## ⚠️ 风险提示

-   程序调用频率较高，**主 EA 查询账号存在被 EA 封禁的未知风险**，请谨慎选择账号。
-   建议使用开通 EA 密钥的红信账号作为主查询账号，**勿使用个人常用账号**。
-   任何账号封禁问题，由用户自行承担责任。
-   非主查询账号的 Cookie 仅用于播报系统，风险较低。

## 👨‍💻 关于开发者与反馈

本项目由 Zygo 群组精心打造，致力于优化 BFV 服务器管理体验。

-   若使用中遇到问题或有建议，欢迎加入 QQ 反馈群：[1028746092](https://qm.qq.com/q/AYA2UyBUty)
-   也可进入 Zygo 大群体验最新功能：[975809080](https://qm.qq.com/q/ZhAtavkiUq)
-   欢迎在 GitHub 提交 issue 或直接联系项目维护者。
