echo off

if not exist "./dist/firefox" md "./dist/firefox"

xcopy "./options" "./dist/firefox/options\" /Y/S
xcopy "./popup" "./dist/firefox/popup\" /Y/S
copy /Y "./*.js" "./dist/firefox\"
copy /Y "./*.css" "./dist/firefox\"
copy /Y "./*.png" "./dist/firefox\"
copy /Y "./manifest.ff.json" "./dist/firefox/manifest.json"

echo on