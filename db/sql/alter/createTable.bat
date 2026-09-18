setlocal
rem === liste des tables:
rem   qui
rem   quoi
rem   poste
rem   role
rem   theme
rem   reltheme
rem   parametre

rem === Parametres de connexion PostgreSQL (adapter si besoin) ===
set "PGHOST=localhost"
set "PGPORT=5432"
set "PGUSER=postgres"
set "PGDATABASE=quiquoitekdb"

rem === nom de la table ===
rem set "TABLE_NAME=%~1"
if "%TABLE_NAME%"=="" (
    set /p TABLE_NAME=nom de la table : 
    echo.
)
if "%TABLE_NAME%"=="" (
    echo "TABLE_NAME ko"
    pause
    exit
)
rem === Localisation du script SQL ===
set "SCRIPT_DIR=%~dp0"
set "SQL_FILE=%SCRIPT_DIR%..\sql\createTable_%TABLE_NAME%.sql"

if not exist "%SQL_FILE%" (
    echo Fichier SQL introuvable : %SQL_FILE%
    pause

    exit /b 1
)
rem === Demande du mot de passe si PGPASSWORD n'est pas deja defini ===
if "%PGPASSWORD%"=="" (
    set /p PGPASSWORD=Mot de passe pour %PGUSER% : 
    echo.
)
rem === Execution du script via psql ===
"C:\Program Files\PostgreSQL\17\pgAdmin 4\runtime\psql" -h "%PGHOST%" -p %PGPORT% -U "%PGUSER%" -d "%PGDATABASE%" -f "%SQL_FILE%"
set "EXIT_CODE=%ERRORLEVEL%"

echo Résultat de l'execution du script (code %EXIT_CODE%).

pause