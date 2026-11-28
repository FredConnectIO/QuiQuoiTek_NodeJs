// Depuis la racine du projet : node db/add/addAllTables.js
// Ajoute les lignes de db/add/csv/quoi.csv et de db/add/csv/qui.csv si ces fichiers sont présents.
// Déplace les fichiers importés dans db/add/csv(trt).
// format du csv: nom|genre|pays|domaine|stock|qualif|remarque|datedernierevisu|date_aaaa|date_mm|date_jj|liendisk|lienweb
//                (remplacer | par tab)
const fs = require('node:fs/promises');
const path = require('path');
const { Client } = require('pg');
const { insertQuisCsv, insertQuoisCsv, prepareQuisCsv, prepareQuoisCsv } = require('../../src/db/tableCsv');

const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'fred',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'quiquoitekdb',
};

const imports = [
    { table: 'quoi', prepare: prepareQuoisCsv, insert: insertQuoisCsv },
    { table: 'qui', prepare: prepareQuisCsv, insert: insertQuisCsv },
];

const archiveDir = path.join(__dirname, 'csv(trt)');
const archiveDateFormat = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

async function archiveCsv(source, table) {
    const parts = Object.fromEntries(archiveDateFormat.formatToParts(new Date()).map(({ type, value }) => [type, value]));
    const suffix = ` t${parts.year}${parts.month}${parts.day} ${parts.hour}${parts.minute}${parts.second}.csv`;

    for (let index = 1; ; index += 1) {
        const filename = `${table}${index === 1 ? '' : ` (${index})`}${suffix}`;
        try {
            await fs.link(source, path.join(archiveDir, filename));
        } catch (error) {
            if (error.code === 'EEXIST') continue;
            throw error;
        }
        await fs.unlink(source);
        return filename;
    }
}

async function addTable({ table, prepare, insert }) {
    const filename = `${table}.csv`;
    const source = path.join(__dirname, 'csv', filename);
    let csvBuffer;
    try {
        csvBuffer = await fs.readFile(source);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`Aucun fichier ${filename} dans db/add/csv.`);
            return;
        }
        throw error;
    }

    const prepared = prepare(csvBuffer);
    await fs.mkdir(archiveDir, { recursive: true });
    const client = new Client(DB_CONFIG);
    await client.connect();
    try {
        await client.query('BEGIN');
        const { inserted, duplicates } = await insert(client, prepared);
        if (duplicates) {
            throw new Error(`Noms déjà présents dans la table ${table} : ${duplicates.join(', ')}.`);
        }
        await client.query('COMMIT');
        console.log(`Table ${table} : ${inserted} ligne(s) ajoutée(s).`);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        await client.end();
    }

    try {
        const archivedFilename = await archiveCsv(source, table);
        console.log(`Fichier déplacé vers csv(trt)/${archivedFilename}.`);
    } catch (error) {
        console.error(`Import de ${filename} validé en base. Déplacement vers csv(trt) impossible.`, error.message);
        process.exitCode = 1;
    }
}

async function addAllTables() {
    for (const entry of imports) {
        try {
            await addTable(entry);
        } catch (error) {
            console.error(`Ajout depuis ${entry.table}.csv interrompu.`, error.message);
            if (error.duplicates) {
                console.error(`Noms en double : ${error.duplicates.join(', ')}.`);
            }
            process.exitCode = 1;
        }
    }
}

addAllTables();
