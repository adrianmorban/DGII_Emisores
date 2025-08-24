import rateLimit from 'express-rate-limit';

// Rate limiter para rutas generales
export const standardLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '15') * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Demasiadas solicitudes, por favor intente de nuevo más tarde.'
  }
});

// Rate limiter más estricto para la actualización forzada
export const updateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // solo 5 solicitudes por hora
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Demasiadas solicitudes de actualización. Máximo 5 por hora.'
  }
});

// Rate limiter para búsqueda y consulta
export const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 30, // 30 solicitudes por 15 minutos
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    message: 'Demasiadas búsquedas. Por favor, espere unos minutos antes de intentar nuevamente.'
  }
});
