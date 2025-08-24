import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { configureRoutes } from './routes/index';
import { standardLimiter } from './middlewares/rateLimiter';

export function createServer(): Express {
  // Inicializar la aplicación Express
  const app = express();
  
  // Configurar middlewares
  app.use(helmet()); // Seguridad HTTP
  
  // Configuración de CORS más segura
  const corsOptions = {
    origin: function(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
      // Lista de orígenes permitidos
      // Puedes obtener estos valores de variables de entorno
      const allowedOrigins = process.env.ALLOWED_ORIGINS ? 
        process.env.ALLOWED_ORIGINS.split(',') : 
        ['http://localhost:3000', 'http://localhost:8080'];
      
      // Permitir solicitudes sin origen (como apps móviles o Postman)
      if (!origin) {
        return callback(null, true);
      }
      
      // Verificar si el origen está en la lista de permitidos
      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Bloqueado por política CORS'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    maxAge: 86400 // Cache de preflight en segundos (24 horas)
  };
  
  app.use(cors(corsOptions)); // Aplicar configuración CORS
  
  // Aplicar rate limiting global a todas las rutas
  app.use(standardLimiter);
  
  // Limitar tamaño de payload para prevenir ataques DoS
  app.use(express.json({ limit: '1mb' })); // Para parsear JSON en peticiones
  app.use(express.urlencoded({ extended: true, limit: '1mb' })); // Para parsear formularios
  
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
