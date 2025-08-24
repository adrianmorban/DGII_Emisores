import sqlite3 from 'sqlite3';
import { DgiiDataRecord } from '../types';

export class DatabaseService {
  private dbPath: string;
  private db: sqlite3.Database | null = null;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    sqlite3.verbose();
  }

  // Inicializar la base de datos SQLite
  async initDatabase(): Promise<sqlite3.Database> {
    // Si ya tenemos una conexión activa, la reutilizamos
    if (this.db) {
      return this.db;
    }
    
    return new Promise<sqlite3.Database>((resolve, reject) => {
      try {
        const db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
          if (err) {
            console.error('Error al conectar a la base de datos:', err.message);
            reject(err);
          } else {
            console.log('✓ Conectado a la base de datos SQLite');
            this.db = db;
            
            // Configurar la base de datos para mejor rendimiento
            db.run('PRAGMA journal_mode = WAL;');
            db.run('PRAGMA synchronous = NORMAL;');
            
            resolve(db);
          }
        });
      } catch (error) {
        console.error('Error al crear la conexión a la base de datos:', error);
        reject(error);
      }
    });
  }

  // Crear tabla para almacenar los datos del CSV
  async createTable(db: sqlite3.Database): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      // Vamos a crear la tabla si no existe, sin intentar eliminarla
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS dgii_data (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          orden TEXT,
          rnc TEXT,
          razon_social TEXT,
          nombre_comercial TEXT,
          fecha_autorizacion TEXT,
          fecha_limite TEXT,
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

  // Eliminar todos los registros de la tabla
  async clearTable(db: sqlite3.Database): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      db.run('DELETE FROM dgii_data', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // Preparar statement para inserción de datos
  prepareInsertStatement(db: sqlite3.Database): sqlite3.Statement {
    return db.prepare(`
      INSERT INTO dgii_data (
        orden, rnc, razon_social, nombre_comercial, 
        fecha_autorizacion, fecha_limite
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
  }

  // Método para consultar datos guardados
  async queryData(limit = 10): Promise<DgiiDataRecord[]> {
    const db = await this.initDatabase();
    
    return new Promise<DgiiDataRecord[]>((resolve, reject) => {
      db.all<DgiiDataRecord>(
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

  // Cerrar la conexión a la base de datos
  closeConnection(): void {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error cerrando la base de datos:', err);
        } else {
          console.log('🔒 Conexión a base de datos cerrada');
        }
      });
      this.db = null;
    }
  }
}
