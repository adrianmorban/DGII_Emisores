import { Request, Response } from 'express';
import { DatabaseService } from '../../services/database.service';
import path from 'path';
import { DgiiDataRecord } from '../../types';
import { lastUpdate, isUpdating } from '../services/update-state.service';
import { updateDgiiData } from '../services/update.service';

// Instancia global de servicios
const dbPath = path.resolve(process.env.DB_PATH || './dgii_data.db');
const dbService = new DatabaseService(dbPath);

// Controlador para los emisores
export const emisoresController = {
  /**
   * Obtener todos los emisores con paginación
   */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string || '1', 10);
      const limit = parseInt(req.query.limit as string || '50', 10);
      const offset = (page - 1) * limit;
      
      // Validar parámetros
      if (page < 1 || limit < 1 || limit > 100) {
        res.status(400).json({ 
          error: 'Parámetros de paginación inválidos. page debe ser >= 1 y limit debe estar entre 1 y 100.'
        });
        return;
      }
      
      // Consultar datos
      const query = `
        SELECT * FROM dgii_data 
        ORDER BY razon_social 
        LIMIT ? OFFSET ?
      `;
      
      const db = await dbService.initDatabase();
      
      // Ejecutar consulta
      const emisores: DgiiDataRecord[] = await new Promise((resolve, reject) => {
        db.all(query, [limit, offset], (err, rows) => {
          if (err) reject(err);
          else resolve(rows as DgiiDataRecord[]);
        });
      });
      
      // Contar total de registros para paginación
      const totalCount: number = await new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM dgii_data', [], (err, row: { count: number }) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });
      
      // Enviar respuesta
      res.json({
        data: emisores,
        pagination: {
          page,
          limit,
          totalItems: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        },
        lastUpdate: lastUpdate?.toISOString() || null
      });
    } catch (error) {
      console.error('Error al obtener emisores:', error);
      res.status(500).json({ error: 'Error al consultar los datos de emisores' });
    }
  },
  
  /**
   * Obtener un emisor por su RNC
   */
  async getByRnc(req: Request, res: Response): Promise<void> {
    try {
      const { rnc } = req.params;
      
      // Validar RNC
      if (!rnc || rnc.length < 9 || rnc.length > 11) {
        res.status(400).json({ error: 'RNC inválido. Debe tener entre 9 y 11 caracteres.' });
        return;
      }
      
      // Consultar datos
      const db = await dbService.initDatabase();
      
      const emisor: DgiiDataRecord | undefined = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM dgii_data WHERE rnc = ?', [rnc], (err, row) => {
          if (err) reject(err);
          else resolve(row as DgiiDataRecord);
        });
      });
      
      if (!emisor) {
        res.status(404).json({ error: 'No se encontró un emisor con este RNC.' });
        return;
      }
      
      res.json({
        data: emisor,
        lastUpdate: lastUpdate?.toISOString() || null
      });
    } catch (error) {
      console.error('Error al obtener emisor por RNC:', error);
      res.status(500).json({ error: 'Error al consultar los datos del emisor' });
    }
  },
  
  /**
   * Buscar emisores por nombre o razón social
   */
  async search(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query.q as string;
      
      if (!query || query.length < 3) {
        res.status(400).json({ error: 'El término de búsqueda debe tener al menos 3 caracteres.' });
        return;
      }
      
      // Preparar la consulta con LIKE
      const searchTerm = `%${query.toLowerCase()}%`;
      const db = await dbService.initDatabase();
      
      const emisores: DgiiDataRecord[] = await new Promise((resolve, reject) => {
        db.all(
          `SELECT * FROM dgii_data 
           WHERE LOWER(razon_social) LIKE ? OR LOWER(nombre_comercial) LIKE ? 
           LIMIT 100`, 
          [searchTerm, searchTerm],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows as DgiiDataRecord[]);
          }
        );
      });
      
      res.json({
        data: emisores,
        count: emisores.length,
        query,
        lastUpdate: lastUpdate?.toISOString() || null
      });
    } catch (error) {
      console.error('Error al buscar emisores:', error);
      res.status(500).json({ error: 'Error al buscar emisores' });
    }
  },
  
  /**
   * Obtener estado de la última actualización
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      // Contar registros en la base de datos
      const db = await dbService.initDatabase();
      
      const recordCount: number = await new Promise((resolve, reject) => {
        db.get('SELECT COUNT(*) as count FROM dgii_data', [], (err, row: { count: number }) => {
          if (err) reject(err);
          else resolve(row.count);
        });
      });
      
      res.json({
        status: {
          totalRecords: recordCount,
          lastUpdate: lastUpdate?.toISOString() || null,
          isUpdating,
          nextUpdate: process.env.UPDATE_SCHEDULE || 'No programada'
        }
      });
    } catch (error) {
      console.error('Error al obtener estado:', error);
      res.status(500).json({ error: 'Error al obtener el estado del servicio' });
    }
  },
  
  /**
   * Forzar actualización de datos (protegido con API key)
   */
  async forceUpdate(req: Request, res: Response): Promise<void> {
    try {
      // Aquí podríamos implementar algún tipo de autenticación o validación
      // Por ejemplo, verificar una API key en los headers
      
      // Para este ejemplo, simplemente iniciamos la actualización
      if (isUpdating) {
        res.status(409).json({ 
          error: 'Ya hay una actualización en progreso.',
          started: lastUpdate
        });
        return;
      }
      
      // Iniciar actualización en segundo plano
      updateDgiiData().catch(err => {
        console.error('Error en actualización forzada:', err);
      });
      
      res.json({ 
        message: 'Actualización iniciada en segundo plano',
        status: 'updating'
      });
    } catch (error) {
      console.error('Error al forzar actualización:', error);
      res.status(500).json({ error: 'Error al iniciar la actualización' });
    }
  }
};
