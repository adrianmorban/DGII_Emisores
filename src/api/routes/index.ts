import { Express } from 'express';
import emisoresRoutes from './emisores.routes';

export function configureRoutes(app: Express): void {
  // Aplicar las rutas de emisores
  emisoresRoutes(app);
  
  // Ruta de estado y salud del servicio
  app.get('/health', (req, res) => {
    res.json({ 
      status: 'ok',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime()
    });
  });
}
