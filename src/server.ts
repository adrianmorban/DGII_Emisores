import cron from 'node-cron';
import { createServer } from './api/server';
import { updateDgiiData } from './api/services/update.service';
import { loadEnv } from './utils/env-loader';

// Cargar variables de entorno desde .env
loadEnv();

async function startServer() {
  try {
    // Crear servidor Express
    const app = createServer();
    
    // Obtener puerto de las variables de entorno o usar el 3000 por defecto
    const PORT = process.env.PORT || 3000;
    
    // Iniciar el servidor
    app.listen(PORT, () => {
      console.log(`
      🚀 Servidor iniciado exitosamente
      📡 Escuchando en el puerto: ${PORT}
      🌐 URL: http://localhost:${PORT}
      📊 API: http://localhost:${PORT}/api/v1/emisores
      `);
    });
    
    // Verificar si se debe realizar una actualización al inicio
    const forceUpdateOnStart = process.env.FORCE_UPDATE_ON_START === 'true';
    
    if (forceUpdateOnStart) {
      console.log('Iniciando actualización inicial de datos...');
      
      // Ejecutar la actualización en segundo plano
      updateDgiiData().catch(error => {
        console.error('Error en la actualización inicial:', error);
      });
    }
    
    // Programar actualizaciones periódicas usando cron
    const updateSchedule = process.env.UPDATE_SCHEDULE || '0 3 * * *'; // Por defecto: todos los días a las 3:00 AM
    
    if (!cron.validate(updateSchedule)) {
      console.error(`⚠️ Formato de programación inválido: ${updateSchedule}`);
      console.log('⚠️ Usando programación predeterminada: todos los días a las 3:00 AM');
    } else {
      console.log(`⏱️ Actualizaciones programadas: ${updateSchedule}`);
      
      // Programar la tarea cron
      cron.schedule(updateSchedule, () => {
        console.log('⏰ Iniciando actualización programada...');
        
        updateDgiiData().catch(error => {
          console.error('Error en la actualización programada:', error);
        });
      });
    }
    
  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

// Iniciar el servidor
startServer();

// Manejar señales de cierre
process.on('SIGINT', () => {
  console.log('Servidor detenido por el usuario.');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Servidor detenido.');
  process.exit(0);
});
