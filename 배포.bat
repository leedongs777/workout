@echo off
cd /d "%~dp0"
echo === GitHub 배포 시작 ===
git pull --no-edit
git add .
git commit -m "update"
git push
echo.
echo === 완료! 1~2분 뒤 사이트에 반영됩니다 ===
pause