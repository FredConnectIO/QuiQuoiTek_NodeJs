@echo off
setlocal

rem Dossier racine du projet (un cran au-dessus de ce script)
set "ROOT=%~dp0.."

rem Verification de npm
where npm >nul 2>&1
if errorlevel 1 (
    echo npm est introuvable dans le PATH. Installez Node.js pour continuer.
    exit /b 1
)

pushd "%ROOT%" >nul 2>&1
if errorlevel 1 (
    echo Impossible de se placer dans le dossier du projet : %ROOT%
    exit /b 1
)

if not exist "package.json" (
    echo package.json introuvable dans %ROOT%
    popd
    exit /b 1
)

if not exist "node_modules" (
    echo Le dossier node_modules est absent. Lancez npm install avant de demarrer le serveur.
    popd
    exit /b 1
)

echo Demarrage du serveur quiquoitek... (npm run dev)
npm run dev

set "RC=%errorlevel%"
popd
exit /b %RC%
