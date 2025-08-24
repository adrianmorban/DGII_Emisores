import { Express, Request, Response } from 'express';
import { emisoresController } from '../controllers/emisores.controller';
import { searchLimiter, updateLimiter } from '../middlewares/rateLimiter';

export default function emisoresRoutes(app: Express): void {
  /**
   * @route   GET /api/v1/emisores
   * @desc    Obtener todos los emisores con paginación
   * @access  Public
   */
  app.get('/api/v1/emisores', emisoresController.getAll);

  /**
   * @route   GET /api/v1/emisores/:rnc
   * @desc    Obtener un emisor por su RNC
   * @access  Public
   */
  app.get('/api/v1/emisores/:rnc', emisoresController.getByRnc);

  /**
   * @route   GET /api/v1/emisores/buscar
   * @desc    Buscar emisores por nombre o razón social
   * @access  Public
   */
  app.get('/api/v1/emisores/buscar', searchLimiter, emisoresController.search);

  /**
   * @route   GET /api/v1/status
   * @desc    Obtener información de última actualización
   * @access  Public
   */
  app.get('/api/v1/status', emisoresController.getStatus);

  /**
   * @route   POST /api/v1/actualizar
   * @desc    Forzar actualización de datos (protegido)
   * @access  Private
   */
  app.post('/api/v1/actualizar', updateLimiter, emisoresController.forceUpdate);
}
