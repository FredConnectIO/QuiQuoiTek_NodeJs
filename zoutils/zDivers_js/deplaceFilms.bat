setlocal EnableDelayedExpansion
rem executé OK 2026 07 02
rem Deplace chaque fichier de ROOT dans un sous-repertoire du meme nom
rem Usage :  ".\deplaceFilms.bat "D:\Videos\Action\SF"
set "ROOT=%~1"

if "%ROOT%"=="" (
  echo Usage : %~nx0 "ROOT"
  exit /b 1
)

for %%F in ("%ROOT%\*") do (
  if exist "%%~fF" if not exist "%%~fF\" (
    set "TARGETDIR=%ROOT%\%%~nF"
    if not exist "!TARGETDIR!" mkdir "!TARGETDIR!"
    move "%%~fF" "!TARGETDIR!\" >nul
  )
)

endlocal
