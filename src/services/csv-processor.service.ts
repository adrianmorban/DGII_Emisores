import fs from 'fs';
import csv from 'csv-parser';
import sqlite3 from 'sqlite3';
import { CsvRecord, DgiiDataRecord } from '../types';

export class CsvProcessorService {
    // Procesar el CSV y guardarlo en SQLite
  async processCsvToSqlite(csvFilePath: string, db: sqlite3.Database): Promise<number> {
    console.log(`Procesando CSV (${csvFilePath}) y guardando en SQLite...`);
    
    // Verificar si el archivo existe
    if (!fs.existsSync(csvFilePath)) {
      throw new Error(`El archivo CSV no existe: ${csvFilePath}`);
    }    return new Promise<number>((resolve, reject) => {
      // Primero verificamos si el archivo existe y lo leemos para diagnosticar
      try {
        const fileContent = fs.readFileSync(csvFilePath, 'utf8');
        const lines = fileContent.split('\n');
        
        console.log(`Archivo CSV encontrado con ${lines.length} líneas.`);
        if (lines.length > 0) {
          console.log(`Primera línea: ${lines[0]}`);
        }
        if (lines.length > 1) {
          console.log(`Segunda línea: ${lines[1]}`);
        }
        
        // Verificar si el archivo está vacío o dañado
        if (lines.length <= 1 || fileContent.trim() === '') {
          reject(new Error('El archivo CSV está vacío o dañado'));
          return;
        }
      } catch (err) {
        console.error('Error al leer el archivo CSV para diagnóstico:', err);
      }
      
      const results: CsvRecord[] = [];
      
      // Opciones básicas para la lectura del CSV
      const csvOptions = {
        headers: [
          'orden', 
          'rnc', 
          'razon_social', 
          'nombre_comercial', 
          'fecha_autorizacion', 
          'fecha_limite'
        ],
        skipLines: 1 // Saltar la línea de encabezados originales
      };
        
      fs.createReadStream(csvFilePath)
        .pipe(csv(csvOptions))
        .on('data', (data: CsvRecord) => {
          // Limpiar manualmente los espacios en blanco de las claves y valores
          const cleanRecord: CsvRecord = {};
          Object.keys(data).forEach(key => {
            const cleanKey = key.trim();
            cleanRecord[cleanKey] = typeof data[key] === 'string' ? data[key].trim() : data[key];
          });
          results.push(cleanRecord);
        })
        .on('end', async () => {
          try {
            console.log(`Procesando ${results.length} registros...`);
            
            // Limpiar tabla antes de insertar nuevos datos
            await new Promise<void>((res, rej) => {
              db.run('DELETE FROM dgii_data', (err) => {
                if (err) rej(err);
                else res();
              });
            });

            // Preparar statement para inserción
            const stmt = db.prepare(`
              INSERT INTO dgii_data (
                orden, rnc, razon_social, nombre_comercial, 
                fecha_autorizacion, fecha_limite
              ) VALUES (?, ?, ?, ?, ?, ?)
            `);

            // Insertar cada registro
            for (const row of results) {
              // Obtener las columnas reales del CSV
              console.log('Columnas del CSV:', Object.keys(row));
              
              // Usar directamente los nombres de las columnas que ya mapeamos en las opciones de CSV
              const orden = row["orden"] || '';
              const rnc = row["rnc"] || '';
              const razonSocial = row["razon_social"] || '';
              const nombreComercial = row["nombre_comercial"] || '';
              const fechaAutorizacion = row["fecha_autorizacion"] || '';
              const fechaLimite = row["fecha_limite"] || '';
              
              // Insertar registro
              stmt.run([
                orden,
                rnc,
                razonSocial,
                nombreComercial,
                fechaAutorizacion,
                fechaLimite
              ]);
            }

          stmt.finalize((err) => {
            if (err) {
              console.error('Error al finalizar la inserción de datos:', err);
              reject(err);
            } else {
              console.log(`✓ ${results.length} registros guardados en SQLite`);
              
              // Verificar que realmente se hayan insertado registros
              db.get('SELECT COUNT(*) as count FROM dgii_data', (countErr, row: any) => {
                if (countErr) {
                  console.error('Error al verificar la cantidad de registros insertados:', countErr);
                  reject(countErr);
                } else {
                  const count = row?.count || 0;
                  console.log(`Verificación: ${count} registros en la tabla dgii_data`);
                  resolve(results.length);
                }
              });
            }
          });          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  }
}
