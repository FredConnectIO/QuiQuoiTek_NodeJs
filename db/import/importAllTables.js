// importer les donnees : mode operatoire
//   cd db\import
//   node importAllTables   (utilise les csv de db/import/csv)
//   seuls les tables pour lesquelles un fichier csv existe sont importees

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'fred',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'quiquoitekdb',
};

const CSV_DIR = path.resolve(__dirname, '../import/csv');
const CHUNK_SIZE = 500;

const sanitizeIdentifier = (value, kind = 'table') => {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`Invalid ${kind} identifier: "${value}"`);
    }
    const trimmed = value.trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(trimmed)) {
        throw new Error(`Unsafe ${kind} identifier: "${value}"`);
    }
    return trimmed;
};

const quoteIdentifier = (identifier) => `"${identifier.replace(/"/g, '""')}"`;

const readCsvFiles = async () => {
    let entries;
    try {
        entries = await fs.promises.readdir(CSV_DIR);
    } catch (err) {
        if (err && err.code === 'ENOENT') {
            throw new Error(`Dossier CSV introuvable : ${CSV_DIR}`);
        }
        throw err;
    }
    return entries
        .filter((name) => name.toLowerCase().endsWith('.csv'))
        .map((name) => {
            const tableName = sanitizeIdentifier(name.replace(/\.csv$/i, ''));
            return {
                tableName,
                filePath: path.join(CSV_DIR, name),
            };
        });
};

const parseCsv = async (filePath) => {
    const content = await fs.promises.readFile(filePath, 'utf8');
    const lines = content.split(/\r?\n/);
    if (!lines.length) {
        return { columns: [], rows: [] };
    }

    const headerLine = lines.shift();
    if (!headerLine) {
        return { columns: [], rows: [] };
    }

    const columns = headerLine.split('\t').map((col) => sanitizeIdentifier(col, 'column'));
    const rows = [];

    for (const line of lines) {
        if (!line || !line.trim()) {
            continue;
        }
        const cells = line.split('\t');
        const normalizedRow = columns.map((_, idx) => (cells[idx] ?? ''));
        rows.push(normalizedRow);
    }

    return { columns, rows };
};

const buildInsertStatement = (tableName, columns, chunk) => {
    const columnList = columns.map(quoteIdentifier).join(',');
    const values = [];
    const valueStrings = chunk.map((row, rowIdx) => {
        const placeholders = columns.map((_, colIdx) => {
            const value = row[colIdx];
            values.push(value === '' ? null : value);
            return `$${rowIdx * columns.length + colIdx + 1}`;
        });
        return `(${placeholders.join(',')})`;
    });
    const sql = `INSERT INTO public.${quoteIdentifier(tableName)} (${columnList}) VALUES ${valueStrings.join(',')}`;
    return { sql, values };
};

const insertRows = async (client, tableName, columns, rows, setLineNumber = () => {}) => {
    console.log(`Import table ${tableName}: ${rows.length} ligne(s)`);
    for (let start = 0; start < rows.length; start += CHUNK_SIZE) {
        const chunk = rows.slice(start, start + CHUNK_SIZE);
        setLineNumber(start + 2); // +1 for header, +1 for 1-based line index
        const { sql, values } = buildInsertStatement(tableName, columns, chunk);
        await client.query(sql, values);
    }
};

const truncateTables = async (client, tableNames) => {
    if (!tableNames.length) {
        console.log('Aucune table a truncater.');
        return;
    }
    const qualified = tableNames.map((table) => `public.${quoteIdentifier(table)}`).join(', ');
    console.log(`TRUNCATE ${qualified}`);
    await client.query(`TRUNCATE TABLE ${qualified} RESTART IDENTITY CASCADE;`);
};

const deleteTables = async (client, tableNames) => {
    if (!tableNames.length) {
        return;
    }
    for (const table of tableNames) {
        const qualified = `public.${quoteIdentifier(table)}`;
        console.log(`DELETE FROM ${qualified}`);
        await client.query(`DELETE FROM ${qualified};`);
    }
};

async function importAllTables() {
    const csvTables = await readCsvFiles();
    if (!csvTables.length) {
        throw new Error(`Aucun fichier *.csv trouve dans ${CSV_DIR}`);
    }

    const client = new Client(DB_CONFIG);
    await client.connect();

    try {
        await client.query('BEGIN');

        const tableNames = csvTables.map(({ tableName }) => tableName);
        await truncateTables(client, tableNames);
        await deleteTables(client, tableNames);

        let currentTable = null;
        let currentLine = null;

        for (const { tableName, filePath } of csvTables) {
            currentTable = tableName;
            currentLine = null;
            const { columns, rows } = await parseCsv(filePath);
            if (!columns.length) {
                console.warn(`Fichier ${filePath} sans en-tete, table ignoree.`);
                continue;
            }
            if (!rows.length) {
                console.log(`Aucune donnee pour ${tableName}, table laissee vide.`);
                continue;
            }
            try {
                await insertRows(client, tableName, columns, rows, (line) => {
                    currentLine = line;
                });
            } catch (err) {
                err._importContext = { tableName: currentTable, lineNumber: currentLine };
                throw err;
            }
        }

        await client.query('COMMIT');
        console.log('Import termine avec succes.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erreur durant import all tables:', err);
        throw err;
    } finally {
        await client.end();
        console.log('Connexion PostgreSQL fermee.');
    }
}

importAllTables().catch((err) => {
    console.error('Import interrompu:', err && err.message ? err.message : err);
    if (err && err._importContext) {
        const { tableName, lineNumber } = err._importContext;
        console.error(`Contexte : table="${tableName}"` + (lineNumber ? `, ligne CSV ~${lineNumber}` : ''));
    }
    process.exitCode = 1;
});
