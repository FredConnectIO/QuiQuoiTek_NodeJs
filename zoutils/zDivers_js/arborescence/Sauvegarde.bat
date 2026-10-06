if "%~1"=="" (
    echo Usage: sauvegarde.bat "chemin_vers_source"  "chemin_vers_cible"
    exit /b 1
)

if "%~2"=="" (
    echo Usage: sauvegarde.bat "chemin_vers_source"  "chemin_vers_cible"
    exit /b 1
)

node list-tree-dirAbs ^
   "%~1" ^
   "C:\PARTAGE\Music\sourceDir.txt"

node list-tree-dirAbs ^
  "%~2" ^
  "C:\PARTAGE\Music\cibleOldDir.txt"

node compare-text-2dir ^
  "C:\PARTAGE\Music\sourceDir.txt" ^
  "C:\PARTAGE\Music\cibleOldDir.txt" ^
  "C:\PARTAGE\GitHub\bibliothequeDemo\zoutils\arborescence\updateDirCibleNew.txt" ^
  "%~1" ^
  "%~2"

node list-tree-fileAbs ^
   "%~1" ^
   "C:\PARTAGE\Music\sourceFile.txt"

node list-tree-fileAbs ^
  "%~2" ^
  "C:\PARTAGE\Music\cibleOldFile.txt"

node compare-text-2file ^
  "C:\PARTAGE\Music\sourceFile.txt" ^
  "C:\PARTAGE\Music\cibleOldFile.txt" ^
  "C:\PARTAGE\GitHub\bibliothequeDemo\zoutils\arborescence\updateFileCibleNew.txt" ^
  "%~1" ^
  "%~2"
pause

node updateDirCibleNewJs ^
  "C:\PARTAGE\GitHub\bibliothequeDemo\zoutils\arborescence\updateDirCibleNew.txt" ^
  "C:\PARTAGE\GitHub\bibliothequeDemo\zoutils\arborescence\updateDirCibleNewLog.txt" 
pause

node updateFileCibleNewJs ^
  "C:\PARTAGE\GitHub\bibliothequeDemo\zoutils\arborescence\updateFileCibleNew.txt" ^
  "C:\PARTAGE\GitHub\bibliothequeDemo\zoutils\arborescence\updateFileCibleNewLog.txt" 
pause
