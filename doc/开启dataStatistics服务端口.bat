@echo off
echo ==============================================
echo          配置Windows防火墙7639端口
echo ==============================================

:: 检查管理员权限
fltmc >nul 2>&1 || (
    echo 错误：请右键选择"以管理员身份运行"此脚本！
    pause >nul
    exit /b 1
)

set PORT=7639
set RULE_NAME="Open Port %PORT% (TCP)"

echo 1. 检查是否已存在端口规则...
netsh advfirewall firewall show rule name=%RULE_NAME% >nul 2>&1
if %errorlevel% equ 0 (
    echo 发现现有规则，正在删除...
    netsh advfirewall firewall delete rule name=%RULE_NAME% >nul 2>&1
    if %errorlevel% equ 0 (
        echo 现有规则删除成功
    ) else (
        echo 警告：删除现有规则失败，将尝试直接创建新规则
    )
)

echo.
echo 2. 正在创建新的端口规则...
netsh advfirewall firewall add rule name=%RULE_NAME% ^
    dir=in action=allow protocol=TCP localport=%PORT% ^
    enable=yes profile=any remoteip=any

:: 验证结果
if %errorlevel% equ 0 (
    echo.
    echo 操作成功！7639端口已开放
    echo 可以通过以下命令验证：
    echo netsh advfirewall firewall show rule name=%RULE_NAME%
    echo 注意：如果使用云服务器，请在安全组中放行端口（重要！！！）
) else (
    echo.
    echo 操作失败！错误代码：%errorlevel%
    echo 可能原因：
    echo 1. 系统组策略限制防火墙修改
    echo 2. 第三方安全软件阻止操作
    echo 3. 系统版本不支持此命令
)

echo.
echo ==============================================
pause