import { Browser } from 'puppeteer';
import fs from 'fs';

export async function retryOperation<T>(
  operation: () => Promise<T>, 
  maxRetries = 3, 
  delay = 1000,
  operationName = 'Operación'
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.log(`⚠️ Error en ${operationName} (intento ${attempt}/${maxRetries}): ${lastError.message}`);
      
      if (attempt < maxRetries) {
        console.log(`Reintentando en ${delay / 1000} segundos...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`${operationName} falló después de ${maxRetries} intentos. Último error: ${lastError?.message}`);
}

export async function safeCloseBrowser(browser: Browser | null): Promise<void> {
  if (browser) {
    try {
      await browser.close();
      console.log('✓ Navegador cerrado correctamente');
    } catch (error) {
      console.error('Error al cerrar el navegador:', error);
    }
  }
}

export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`Directorio creado: ${dirPath}`);
  }
}
