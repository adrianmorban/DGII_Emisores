import fs from 'fs';
import path from 'path';
import { DatabaseService } from '../services/database.service';
import { ScraperService } from '../services/scraper.service';
import { CsvProcessorService } from '../services/csv-processor.service';
import { DgiiDataRecord } from '../types';

export class DgiiCsvScraper {
  private dbPath: string;
  private downloadPath: string;
  private url: string;
  private databaseService: DatabaseService;
  private scraperService: ScraperService;
  private csvProcessorService: CsvProcessorService;

  constructor() {
    // Usar variables de entorno o valores predeterminados
    this.dbPath = path.resolve(process.env.DB_PATH || './dgii_data.db');
    this.downloadPath = path.resolve(process.env.DOWNLOAD_PATH || './downloads');
    this.url = process.env.DGII_URL || 'https://dgii.gov.do/app/WebApps/Misc/VerLista/?doc=EEC160525';
    
    this.databaseService = new DatabaseService(this.dbPath);
    this.scraperService = new ScraperService(this.url, this.downloadPath);
    this.csvProcessorService = new CsvProcessorService();
  }

  // Función principal que ejecuta todo el proceso
  async run(): Promise<number> {
    let db;
    let recordsCount = 0;
    
    try {
      console.log('🚀 Iniciando proceso de actualización de datos DGII\n');
      
      // Inicializar base de datos
      db = await this.databaseService.initDatabase();
      await this.databaseService.createTable(db);
      
      // Descargar CSV
      const csvFile = await this.scraperService.downloadCsv();
      
      // Procesar y guardar en SQLite
      recordsCount = await this.csvProcessorService.processCsvToSqlite(csvFile, db);
      
      console.log('\n✅ Proceso completado exitosamente!');
      console.log(`📊 Registros procesados: ${recordsCount}`);
      console.log(`💾 Base de datos: ${this.dbPath}`);
      
      // Limpiar archivo CSV descargado (opcional)
      fs.unlinkSync(csvFile);
      console.log('🗑️ Archivo CSV temporal eliminado');
      
      // Devolver el número de registros procesados
      return recordsCount;
      
    } catch (error: any) {
      console.error('❌ Error en el proceso:', error.message);
      throw error;
    } finally {
      if (db) {
        this.databaseService.closeConnection();
      }
    }
  }

  // Método para consultar datos guardados
  async queryData(limit = 10): Promise<DgiiDataRecord[]> {
    return this.databaseService.queryData(limit);
  }
}
