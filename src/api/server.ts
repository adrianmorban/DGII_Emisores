import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { configureRoutes } from './routes';

export function createServer(): Express {
  // Inicializar la aplicación Express
  const app = express();
  
  // Configurar middlewares
  app.use(helmet()); // Seguridad HTTP
  app.use(cors()); // Permitir peticiones cross-origin
  app.use(express.json()); // Para parsear JSON en peticiones
  app.use(express.urlencoded({ extended: true })); // Para parsear formularios
  
  // Logger para desarrollo
  if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
  } else {
    app.use(morgan('combined'));
  }
  
  // Configurar las rutas de la API
  configureRoutes(app);
  
  // Middleware para manejo de errores 404
  app.use((req, res) => {
    res.status(404).json({
      error: 'Ruta no encontrada'
    });
  });
  
  return app;
}
