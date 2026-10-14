# diaporama Demo

Ce projet est un diaporama.

## Prérequis

- [Node.js](https://nodejs.org) >= 16

## Installation

1. Clonez le dépôt puis installez les dépendances :

```bash
npm install
```

## Lancer le serveur

En développement :
fred: à faire à l'initialisation du projet (inutile lors des "clone" où seul "npm install" suffit
        sinon: si on refait les npm i, alors on monte en version dans les packages "pg" "express" etc..) 
    npm i nodemon 
    npm i express
    npm i pg
    npm i multer (ou bien npm install multer@^1.4.5)

```bash
npm run dev
```

En production :

```bash
npm start

```
`http://localhost:3000/` dans le navigateur -> chargement de index.html (l'interface HTML permettant de gérer auteurs et livres.)

## Conversion de menus CSV ↔ JSON

Deux utilitaires Node.js permettent de convertir les menus entre JSON et TSV (valeurs séparées par des tabulations).

```bash
node scripts/menuCsvToJson.js chemin/vers/menus.tsv sortie.json

node scripts/menuJsonToCsv.js chemin/vers/menu.json sortie.tsv
```

Les fichiers TSV doivent inclure les en-têtes suivants : `link`, `menuTitle`, `itemTitle`, `method`, `action`, `shortcutKey`, `shortcutAccel`, `shortcutShift`, `parameter`, `executeWithoutValidating`, `isSeparator`, `enabled`.

## Endpoints

- `GET /xx` – liste des xxx
- `GET /xx/:id` – récupérer un xxx


## Structure du projet

- `src/app.js` – point d'entrée de l'application Express
- `src/routes/` – routes Express
- `src/controllers/` – logique des handlers
