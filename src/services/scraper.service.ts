import puppeteer, { Browser, Page } from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { retryOperation, safeCloseBrowser, ensureDirectoryExists } from '../utils/helpers';

export class ScraperService {
  private url: string;
  private downloadPath: string;

  constructor(url: string, downloadPath: string) {
    this.url = url;
    this.downloadPath = downloadPath;
  }

  // Descargar el CSV usando Puppeteer
  async downloadCsv(): Promise<string> {
    console.log('Iniciando descarga del CSV...');
    
    // Crear directorio de descargas si no existe
    ensureDirectoryExists(this.downloadPath);
    
    let browser: Browser | null = null;

    try {
      // Obtener configuración de las variables de entorno
      const isHeadless = process.env.PUPPETEER_HEADLESS === 'true';
      const timeout = parseInt(process.env.PUPPETEER_TIMEOUT || '60000', 10);
      
      // Configuración mejorada de Puppeteer
      browser = await puppeteer.launch({ 
        headless: isHeadless,
        defaultViewport: null,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--window-size=1280,720'
        ],
        timeout: timeout
      });

      // Obtener el número máximo de reintentos desde variables de entorno
      const maxRetries = parseInt(process.env.MAX_RETRIES || '3', 10);
      
      // Usamos retryOperation para manejar posibles errores y reintentos
      return await retryOperation(
        async () => await this.performDownload(browser!),
        maxRetries, 
        5000,
        'Descarga del CSV'
      );
    } finally {
      await safeCloseBrowser(browser);
    }
  }

  private async performDownload(browser: Browser): Promise<string> {
    const page = await browser.newPage();
    
    try {
      // Configurar la descarga
      // En versiones más recientes de Puppeteer, usamos el cliente del navegador
      const client = await page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: path.resolve(this.downloadPath)
      });

      console.log('Navegando a la página de DGII...');
      await page.goto(this.url, { 
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Esperar a que la página cargue completamente
      console.log('Esperando a que la página cargue...');
      await page.waitForTimeout(3000);

      // Buscar el botón CSV - probamos varios selectores posibles
      const csvButtonSelectors = [
        'input[value="CSV"]',
        'button[value="CSV"]',
        'input[type="submit"][value="CSV"]',
        'input[type="button"][value="CSV"]',
        'a[href*="csv"]',
        'a.btn:contains("CSV")',
        'button:contains("CSV")',
        '*[onclick*="csv"]',
        '*[onclick*="CSV"]',
        // Selectores más específicos para la página de DGII
        'form[action*="csv"]',
        'input[name*="csv"]',
        'input[id*="csv"]'
      ];

      let csvButton = null;
      // Obtener el número máximo de reintentos desde variables de entorno
      const maxButtonRetries = parseInt(process.env.MAX_RETRIES || '3', 10);
      
      // Intentamos múltiples veces con esperas entre intentos
      for (let retry = 0; retry < maxButtonRetries && !csvButton; retry++) {
        if (retry > 0) {
          console.log(`Reintento ${retry} para encontrar el botón CSV...`);
          await page.waitForTimeout(2000); // Esperar entre intentos
        }
        
        // Intentar con cada selector
        for (const selector of csvButtonSelectors) {
          try {
            csvButton = await page.$(selector);
            if (csvButton) {
              console.log(`✓ Botón CSV encontrado con selector: ${selector}`);
              break;
            }
          } catch (error) {
            // Continuar con el siguiente selector
          }
        }
        
        // Si no encontramos con selectores, buscar por texto
        if (!csvButton) {
          try {
            console.log("Buscando botón por contenido de texto 'CSV'...");
            csvButton = await page.evaluateHandle(() => {
              const elements = [...document.querySelectorAll('*')];
              return elements.find(el => 
                el.textContent && 
                el.textContent.toLowerCase().includes('csv') &&
                (el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'INPUT')
              );
            });
            
            if (csvButton && !await page.evaluate(el => el === null, csvButton)) {
              console.log('✓ Botón CSV encontrado por contenido de texto');
            } else {
              csvButton = null;
            }
          } catch (error) {
            console.log("Error al buscar por texto:", error);
          }
        }
      }

      // Si después de todos los intentos no encontramos el botón
      if (!csvButton) {
        // Intentar obtener una captura de pantalla para depuración
        try {
          const screenshotPath = path.join(this.downloadPath, 'debug_screenshot.png');
          await page.screenshot({ path: screenshotPath, fullPage: true });
          console.log(`Se guardó una captura de pantalla en: ${screenshotPath}`);
        } catch (err) {
          console.log('No se pudo guardar la captura de pantalla', err);
        }
        
        throw new Error('No se pudo encontrar el botón CSV en la página');
      }

      // Obtener archivos existentes antes de la descarga
      const beforeFiles = new Set(fs.readdirSync(this.downloadPath));
      console.log('Archivos antes de la descarga:', Array.from(beforeFiles));
      
      // Hacer clic en el botón CSV
      if ('click' in csvButton) {
        await csvButton.click();
        console.log('Se hizo clic en el botón CSV');
      } else {
        throw new Error('No se pudo hacer clic en el botón CSV');
      }
      
      // Obtener el tiempo de espera desde variables de entorno
      const timeoutMs = parseInt(process.env.DOWNLOAD_TIMEOUT || '60000', 10);
      const startTime = Date.now();
      
      // Función para encontrar el archivo nuevo o modificado recientemente
      const findDownloadedFile = (): string | null => {
        const currentFiles = fs.readdirSync(this.downloadPath);
        
        // Primero buscamos archivos nuevos que terminen en .csv
        for (const file of currentFiles) {
          if (!beforeFiles.has(file) && file.endsWith('.csv')) {
            return path.join(this.downloadPath, file);
          }
        }
        
        // Si no hay archivos nuevos, buscamos archivos .csv modificados recientemente (últimos 30 segundos)
        const thirtySecondsAgo = Date.now() - 30000;
        for (const file of currentFiles) {
          if (file.endsWith('.csv')) {
            const filePath = path.join(this.downloadPath, file);
            try {
              const stats = fs.statSync(filePath);
              if (stats.mtime.getTime() > thirtySecondsAgo) {
                console.log(`Archivo CSV modificado recientemente: ${file}`);
                return filePath;
              }
            } catch (err) {
              // Ignorar errores al verificar archivos
            }
          }
        }
        
        return null;
      };
      
      // Esperar a que aparezca el archivo descargado
      let downloadedFile: string | null = null;
      console.log('Esperando la descarga del archivo...');
      
      // Esperar un tiempo inicial para que la descarga comience
      await page.waitForTimeout(3000);
      
      // Intentar hasta 10 veces durante el tiempo de espera
      const checkInterval = Math.min(2000, timeoutMs / 10);
      const maxChecks = Math.floor(timeoutMs / checkInterval);
      
      for (let i = 0; i < maxChecks; i++) {
        downloadedFile = findDownloadedFile();
        
        if (downloadedFile) {
          console.log(`Archivo encontrado: ${path.basename(downloadedFile)}`);
          
          // Verificar que el archivo sea válido
          try {
            const stats = fs.statSync(downloadedFile);
            
            // Si el archivo existe y tiene un tamaño mayor a 100 bytes, lo consideramos válido
            if (stats.size > 100) {
              console.log(`Archivo válido con ${stats.size} bytes`);
              break;
            } else {
              console.log(`Archivo encontrado pero es muy pequeño (${stats.size} bytes), esperando...`);
            }
          } catch (err) {
            console.log('Error verificando el archivo:', err);
          }
        }
        
        // Si estamos en la última verificación, no esperamos más
        if (i === maxChecks - 1) break;
        
        console.log(`Verificación ${i+1}/${maxChecks}, esperando ${checkInterval/1000} segundos...`);
        await page.waitForTimeout(checkInterval);
      }
      
      // Si después de todos los intentos, no encontramos un archivo válido
      if (!downloadedFile) {
        // Como último recurso, buscar cualquier archivo CSV reciente
        const currentFiles = fs.readdirSync(this.downloadPath);
        const csvFiles = currentFiles.filter(file => file.endsWith('.csv'));
        
        if (csvFiles.length > 0) {
          // Usar el archivo CSV más reciente
          const mostRecentFile = csvFiles.sort((a, b) => {
            return fs.statSync(path.join(this.downloadPath, b)).mtime.getTime() - 
                   fs.statSync(path.join(this.downloadPath, a)).mtime.getTime();
          })[0];
          
          downloadedFile = path.join(this.downloadPath, mostRecentFile);
          console.log(`No se detectó descarga nueva, usando archivo CSV más reciente: ${mostRecentFile}`);
        } else {
          throw new Error(`Timeout esperando la descarga después de ${timeoutMs / 1000} segundos`);
        }
      }

      console.log(`✓ CSV descargado: ${downloadedFile}`);
      return downloadedFile;
      
    } finally {
      await page.close().catch(err => console.log('Error al cerrar la página:', err));
    }
  }
}
