const puppeteer = require('puppeteer');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

class DgiiCsvScraper {
    constructor() {
        this.dbPath = './dgii_data.db';
        this.downloadPath = './downloads';
        this.url = 'https://dgii.gov.do/app/WebApps/Misc/VerLista/?doc=EEC160525';
    }

    // Inicializar la base de datos SQLite
    initDatabase() {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('✓ Conectado a la base de datos SQLite');
                    resolve(db);
                }
            });
        });
    }

    // Crear tabla para almacenar los datos del CSV
    createTable(db) {
        return new Promise((resolve, reject) => {
            // Esta consulta se ajustará según la estructura real del CSV
            const createTableQuery = `
                CREATE TABLE IF NOT EXISTS dgii_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    rnc TEXT,
                    nombre_razon_social TEXT,
                    nombre_comercial TEXT,
                    categoria TEXT,
                    fecha_inclusion TEXT,
                    estado TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `;

            db.run(createTableQuery, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('✓ Tabla creada o verificada exitosamente');
                    resolve();
                }
            });
        });
    }

    // Descargar el CSV usando Puppeteer
    async downloadCsv() {
        console.log('Iniciando descarga del CSV...');
        
        // Crear directorio de descargas si no existe
        if (!fs.existsSync(this.downloadPath)) {
            fs.mkdirSync(this.downloadPath);
        }

        const browser = await puppeteer.launch({ 
            headless: false, // Cambiar a true para modo silencioso
            defaultViewport: null,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        try {
            const page = await browser.newPage();
            
            // Configurar la descarga
            await page._client.send('Page.setDownloadBehavior', {
                behavior: 'allow',
                downloadPath: path.resolve(this.downloadPath)
            });

            console.log('Navegando a la página de DGII...');
            await page.goto(this.url, { 
                waitUntil: 'networkidle2',
                timeout: 30000
            });

            // Esperar a que la página cargue completamente
            console.log('Esperando a que la página cargue...');
            await page.waitForTimeout(3000);

            // Buscar el botón CSV - probamos varios selectores posibles
            const csvButtonSelectors = [
                'input[value="CSV"]',
                'button[value="CSV"]',
                'input[type="submit"][value="CSV"]',
                'input[type="button"][value="CSV"]',
                'a[href*="csv"]',
                '*[onclick*="csv"]',
                '*[onclick*="CSV"]'
            ];

            let csvButton = null;
            
            for (const selector of csvButtonSelectors) {
                try {
                    csvButton = await page.$(selector);
                    if (csvButton) {
                        console.log(`✓ Botón CSV encontrado con selector: ${selector}`);
                        break;
                    }
                } catch (error) {
                    // Continuar con el siguiente selector
                }
            }

            if (!csvButton) {
                // Buscar por texto visible
                csvButton = await page.evaluateHandle(() => {
                    const elements = [...document.querySelectorAll('*')];
                    return elements.find(el => 
                        el.textContent && el.textContent.toLowerCase().includes('csv')
                    );
                });
            }

            if (!csvButton) {
                throw new Error('No se pudo encontrar el botón CSV en la página');
            }

            console.log('Haciendo clic en el botón CSV...');
            
            // Esperar por la descarga
            const downloadPromise = new Promise((resolve) => {
                const checkDownload = setInterval(() => {
                    const files = fs.readdirSync(this.downloadPath);
                    const csvFiles = files.filter(file => file.endsWith('.csv'));
                    
                    if (csvFiles.length > 0) {
                        clearInterval(checkDownload);
                        resolve(path.join(this.downloadPath, csvFiles[0]));
                    }
                }, 1000);
            });

            // Hacer clic en el botón CSV
            await csvButton.click();

            // Esperar a que la descarga se complete (máximo 30 segundos)
            const downloadedFile = await Promise.race([
                downloadPromise,
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout esperando la descarga')), 30000)
                )
            ]);

            console.log(`✓ CSV descargado: ${downloadedFile}`);
            return downloadedFile;

        } finally {
            await browser.close();
        }
    }

    // Procesar el CSV y guardarlo en SQLite
    async processCsvToSqlite(csvFilePath, db) {
        console.log('Procesando CSV y guardando en SQLite...');
        
        return new Promise((resolve, reject) => {
            const results = [];
            
            fs.createReadStream(csvFilePath)
                .pipe(csv())
                .on('data', (data) => {
                    results.push(data);
                })
                .on('end', async () => {
                    try {
                        console.log(`Procesando ${results.length} registros...`);
                        
                        // Limpiar tabla antes de insertar nuevos datos
                        await new Promise((res, rej) => {
                            db.run('DELETE FROM dgii_data', (err) => {
                                if (err) rej(err);
                                else res();
                            });
                        });

                        // Preparar statement para inserción
                        const stmt = db.prepare(`
                            INSERT INTO dgii_data (
                                rnc, nombre_razon_social, nombre_comercial, 
                                categoria, fecha_inclusion, estado
                            ) VALUES (?, ?, ?, ?, ?, ?)
                        `);

                        // Insertar cada registro
                        for (const row of results) {
                            const columns = Object.keys(row);
                            
                            // Adaptar según las columnas reales del CSV
                            stmt.run([
                                row[columns[0]] || '', // RNC
                                row[columns[1]] || '', // Nombre/Razón Social
                                row[columns[2]] || '', // Nombre Comercial
                                row[columns[3]] || '', // Categoría
                                row[columns[4]] || '', // Fecha Inclusión
                                row[columns[5]] || ''  // Estado
                            ]);
                        }

                        stmt.finalize((err) => {
                            if (err) {
                                reject(err);
                            } else {
                                console.log(`✓ ${results.length} registros guardados en SQLite`);
                                resolve(results.length);
                            }
                        });

                    } catch (error) {
                        reject(error);
                    }
                })
                .on('error', reject);
        });
    }

    // Función principal que ejecuta todo el proceso
    async run() {
        let db;
        
        try {
            console.log('🚀 Iniciando aplicación DGII CSV Scraper\n');
            
            // Inicializar base de datos
            db = await this.initDatabase();
            await this.createTable(db);
            
            // Descargar CSV
            const csvFile = await this.downloadCsv();
            
            // Procesar y guardar en SQLite
            const recordsCount = await this.processCsvToSqlite(csvFile, db);
            
            console.log('\n✅ Proceso completado exitosamente!');
            console.log(`📊 Registros procesados: ${recordsCount}`);
            console.log(`💾 Base de datos: ${this.dbPath}`);
            
            // Limpiar archivo CSV descargado (opcional)
            fs.unlinkSync(csvFile);
            console.log('🗑️ Archivo CSV temporal eliminado');
            
        } catch (error) {
            console.error('❌ Error en el proceso:', error.message);
            throw error;
        } finally {
            if (db) {
                db.close((err) => {
                    if (err) {
                        console.error('Error cerrando la base de datos:', err);
                    } else {
                        console.log('🔒 Conexión a base de datos cerrada');
                    }
                });
            }
        }
    }

    // Método para consultar datos guardados
    async queryData(limit = 10) {
        const db = await this.initDatabase();
        
        return new Promise((resolve, reject) => {
            db.all(
                `SELECT * FROM dgii_data ORDER BY created_at DESC LIMIT ?`, 
                [limit], 
                (err, rows) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(rows);
                    }
                    db.close();
                }
            );
        });
    }
}

// Uso de la aplicación
async function main() {
    const scraper = new DgiiCsvScraper();
    
    try {
        await scraper.run();
        
        // Mostrar algunos datos como ejemplo
        console.log('\n📋 Primeros 5 registros guardados:');
        const sampleData = await scraper.queryData(5);
        console.table(sampleData);
        
    } catch (error) {
        console.error('Error en la aplicación:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = DgiiCsvScraper;