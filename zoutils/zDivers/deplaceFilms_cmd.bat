@echo off
setlocal

rem usage: .\deplacefilms E:\Videos_LaCie_2To exec

rem Deplace chaque fichier present dans un sous-repertoire de deuxieme niveau
rem vers un sous-repertoire portant le nom du fichier.
rem
rem Exemple : D:\Videos\Action\Anglais\film.mkv
rem        -> D:\Videos\Action\Anglais\film\film.mkv
rem
rem Par defaut, le script simule les operations.
rem Usage : %~nx0 "D:\Videos" [exec]

set "ROOT=%~1"
set "MODE=%~2"

if not defined ROOT (
  echo Usage : %~nx0 "ROOT" [exec]
  echo         Ajouter exec pour effectuer reellement les operations.
  exit /b 1
)

if not exist "%ROOT%\" (
  echo [ERREUR] Repertoire introuvable : "%ROOT%"
  exit /b 1
)

if "%MODE%"=="exec" (
  echo [MODE EXECUTION] Les fichiers seront reellement deplaces.
) else (
  echo [MODE SIMULATION] Aucune modification ne sera effectuee.
  echo Pour executer : %~nx0 "%ROOT%" exec
)

echo Racine : "%ROOT%"
echo.

rem NIVEAU1 correspond par exemple a "Action" et NIVEAU2 a "Anglais".
for /d %%D in ("%ROOT%\*") do (
  for /d %%S in ("%%~fD\*") do (
    echo [DOSSIER] "%%~fS"

    rem Le test "if not exist ...\" permet d'ignorer les sous-repertoires.
    for %%F in ("%%~fS\*") do (
      if exist "%%~fF" if not exist "%%~fF\" call :traiterFichier "%%~fF"
    )
  )
)

echo.
echo Traitement termine.
exit /b 0

:traiterFichier
set "SOURCE=%~1"
set "TARGETDIR=%~dp1%~n1"
set "TARGET=%TARGETDIR%\%~nx1"

if "%MODE%"=="exec" (
  if not exist "%TARGETDIR%\" (
    echo [CREATION] "%TARGETDIR%"
    mkdir "%TARGETDIR%"
    if errorlevel 1 (
      echo [ERREUR] Impossible de creer "%TARGETDIR%"
      exit /b 0
    )
  )

  echo [DEPLACEMENT] "%SOURCE%" -^> "%TARGET%"
  move "%SOURCE%" "%TARGETDIR%\" >nul
  if errorlevel 1 echo [ERREUR] Echec du deplacement de "%SOURCE%"
) else (
  if not exist "%TARGETDIR%\" echo [SIMULATION][CREATION] "%TARGETDIR%"
  echo [SIMULATION][DEPLACEMENT] "%SOURCE%" -^> "%TARGET%"
)

exit /b 0
