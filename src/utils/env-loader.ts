import fs from 'fs';
import path from 'path';

/**
 * Carga variables de entorno desde un archivo .env
 */
export function loadEnv(envPath = '.env'): void {
  try {
    const envFilePath = path.resolve(process.cwd(), envPath);
    
    if (fs.existsSync(envFilePath)) {
      const envContent = fs.readFileSync(envFilePath, 'utf-8');
      const envVars = parseEnvFile(envContent);
      
      // Cargar variables en process.env
      for (const [key, value] of Object.entries(envVars)) {
        process.env[key] = value;
      }
      
      console.log(`✓ Variables de entorno cargadas desde ${envPath}`);
    } else {
      console.warn(`⚠️ Archivo ${envPath} no encontrado`);
    }
  } catch (error) {
    console.error(`❌ Error al cargar variables de entorno desde ${envPath}:`, error);
  }
}

/**
 * Parsea el contenido de un archivo .env
 */
function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  
  const lines = content.split('\n');
  
  for (const line of lines) {
    // Omitir líneas de comentarios o vacías
    if (!line || line.startsWith('#')) {
      continue;
    }
    
    // Dividir en clave y valor
    const match = line.match(/^([^=:#]+?)[=:](.*)$/);
    if (match) {
      const key = match[1].trim();
      let value = match[2].trim();
      
      // Eliminar comillas si existen
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.substring(1, value.length - 1);
      }
      
      result[key] = value;
    }
  }
  
  return result;
}
