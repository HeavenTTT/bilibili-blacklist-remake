@echo off
rem ============================================================
rem  Bilibili-BlackList Remake 开发模式一键启动
rem  双击本文件即可：构建 -> 监听 src 变更自动重建 -> 本地服务器
rem  http://localhost:5173
rem
rem  配合油猴加载器（只需安装一次）：
rem  test\bilibili-blacklist-remake.dev.user.js
rem ============================================================
cd /d "%~dp0.."
npm run dev
pause
