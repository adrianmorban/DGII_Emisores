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
      
      // Configuración mejorada de Puppeteer para modo headless
      browser = await puppeteer.launch({ 
        headless: isHeadless ? 'new' : false, // Usar 'new' headless mode
        defaultViewport: { width: 1280, height: 720 }, // Viewport fijo para headless
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-default-apps',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--window-size=1280,720',
          // Específico para descargas en headless
          '--disable-web-security',
          '--allow-running-insecure-content'
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
      // Configurar User-Agent para evitar detección de bot
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Configurar headers adicionales
      await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      });

      // Configurar la descarga usando CDP (Chrome DevTools Protocol)
      const client = await page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: path.resolve(this.downloadPath)
      });

      // Método alternativo usando el cliente de la página si está disponible
      try {
        const pageClient = await page.createCDPSession();
        await pageClient.send('Page.setDownloadBehavior', {
          behavior: 'allow',
          downloadPath: path.resolve(this.downloadPath)
        });
      } catch (clientError) {
        console.log('Método alternativo de configuración de descarga no disponible, continuando...');
      }

      console.log('Navegando a la página de DGII...');
      
      // Configurar timeout de página más largo
      page.setDefaultTimeout(45000);
      page.setDefaultNavigationTimeout(45000);
      
      await page.goto(this.url, { 
        waitUntil: ['networkidle0', 'domcontentloaded'],
        timeout: 45000
      });

      // Esperar a que la página cargue completamente
      console.log('Esperando a que la página cargue completamente...');
      
      // Esperar a que el DOM esté completamente cargado
      await page.waitForFunction(() => document.readyState === 'complete');
      
      // Esperar adicional para JavaScript que se ejecute después del load
      await page.waitForTimeout(5000);
      
      // Esperar específicamente por formularios o botones que puedan aparecer
      try {
        await page.waitForSelector('form, input[type="submit"], input[type="button"], button', { 
          timeout: 5000 
        });
        console.log('✓ Elementos de formulario detectados');
      } catch (err) {
        console.log('⚠️  No se detectaron formularios inmediatamente, continuando...');
      }
      
      // Esperar por posibles elementos con JavaScript dinámico
      try {
        await page.waitForFunction(() => {
          // Buscar cualquier elemento que contenga "csv" o "CSV"
          const elements = document.querySelectorAll('*');
          for (let el of elements) {
            if (el.textContent && el.textContent.toLowerCase().includes('csv')) {
              return true;
            }
            if ((el as HTMLInputElement).value && (el as HTMLInputElement).value.toLowerCase().includes('csv')) {
              return true;
            }
          }
          return false;
        }, { timeout: 15000 });
        console.log('✓ Elementos CSV detectados en la página');
      } catch (err) {
        console.log('⚠️  No se detectaron elementos CSV inmediatamente, pero continuando...');
      }

      // Verificar que la página se cargó correctamente
      const pageTitle = await page.title();
      console.log(`Título de la página: ${pageTitle}`);
      
      // Contar elementos en la página para verificar que cargó contenido
      const elementCount = await page.evaluate(() => document.querySelectorAll('*').length);
      console.log(`Elementos en la página: ${elementCount}`);

      // Buscar el botón CSV con enfoque mejorado para headless
      const csvButton = await this.findCsvButton(page);
      
      if (!csvButton) {
        // Guardar HTML para debugging
        const htmlContent = await page.content();
        const debugHtmlPath = path.join(this.downloadPath, 'debug_page.html');
        fs.writeFileSync(debugHtmlPath, htmlContent);
        console.log(`HTML de la página guardado en: ${debugHtmlPath}`);
        
        throw new Error('No se pudo encontrar el botón CSV en la página');
      }

      // Obtener archivos existentes antes de la descarga
      const beforeFiles = new Set(fs.readdirSync(this.downloadPath));
      console.log('Archivos antes de la descarga:', Array.from(beforeFiles));
      
      // Hacer clic en el botón CSV con método mejorado para headless
      console.log('Haciendo clic en el botón CSV...');
      await this.clickCsvButton(page, csvButton);
      
      // Esperar a que se complete la descarga
      const downloadedFile = await this.waitForDownload(beforeFiles);
      
      console.log(`✓ CSV descargado: ${downloadedFile}`);
      return downloadedFile;
      
    } finally {
      await page.close().catch(err => console.log('Error al cerrar la página:', err));
    }
  }

  private async findCsvButton(page: Page): Promise<any> {
    // Primero, esperar más tiempo para que la página se estabilice
    console.log('Esperando estabilización de la página...');
    await page.waitForTimeout(3000);
    
    // Selectores mejorados y más específicos
    const csvButtonSelectors = [
      'input[value="CSV"]',
      'input[value="csv"]',
      'button[value="CSV"]',
      'input[type="submit"][value="CSV"]',
      'input[type="button"][value="CSV"]',
      'a[href*="csv"]',
      'a[href*="CSV"]',
      'button:contains("CSV")',
      '*[onclick*="csv"]',
      '*[onclick*="CSV"]',
      'form[action*="csv"] input[type="submit"]',
      'input[name*="csv"]',
      'input[id*="csv"]',
      '[data-format="csv"]',
      '[data-export="csv"]'
    ];

    let csvButton = null;
    const maxButtonRetries = parseInt(process.env.MAX_RETRIES || '5', 10); // Aumentar reintentos
    
    for (let retry = 0; retry < maxButtonRetries && !csvButton; retry++) {
      if (retry > 0) {
        console.log(`Reintento ${retry} para encontrar el botón CSV...`);
        
        // Esperar más tiempo entre reintentos
        await page.waitForTimeout(5000);
        
        // Intentar hacer scroll para activar lazy loading
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
          window.scrollTo(0, 0);
        });
        
        await page.waitForTimeout(2000);
      }
      
      // Intentar con cada selector
      for (const selector of csvButtonSelectors) {
        try {
          // Esperar a que el elemento sea visible con más tiempo
          await page.waitForSelector(selector, { timeout: 5000, visible: true }).catch(() => {});
          
          csvButton = await page.$(selector);
          if (csvButton) {
            // Verificar que el elemento sea interactuable
            const isVisible = await page.evaluate(el => {
              const rect = (el as Element).getBoundingClientRect();
              const styles = window.getComputedStyle(el as Element);
              return rect.width > 0 && rect.height > 0 && 
                     styles.visibility !== 'hidden' &&
                     styles.display !== 'none' &&
                     styles.opacity !== '0';
            }, csvButton);
            
            if (isVisible) {
              console.log(`✓ Botón CSV encontrado y visible con selector: ${selector}`);
              return csvButton; // Retornar inmediatamente cuando encontremos uno válido
            } else {
              console.log(`Elemento encontrado con ${selector} pero no es visible`);
              csvButton = null;
            }
          }
        } catch (error) {
          // Continuar con el siguiente selector
        }
      }
      
      // Si no encontramos con selectores, buscar por texto usando XPath
      if (!csvButton) {
        try {
          console.log("Buscando botón por XPath con texto 'CSV'...");
          
          const xpathSelectors = [
            "//input[@type='submit' and contains(translate(@value, 'CSV', 'csv'), 'csv')]",
            "//input[@type='button' and contains(translate(@value, 'CSV', 'csv'), 'csv')]",
            "//button[contains(translate(text(), 'CSV', 'csv'), 'csv')]",
            "//a[contains(translate(text(), 'CSV', 'csv'), 'csv')]",
            "//input[contains(translate(@value, 'CSV', 'csv'), 'csv')]",
            "//button[contains(translate(text(), 'CSV', 'csv'), 'csv')]"
          ];
          
          for (const xpath of xpathSelectors) {
            try {
              await page.waitForXPath(xpath, { timeout: 3000, visible: true }).catch(() => {});
              const elements = await page.$x(xpath);
              if (elements.length > 0) {
                // Verificar visibilidad
                for (const element of elements) {
                  const isVisible = await page.evaluate(el => {
                    const rect = (el as Element).getBoundingClientRect();
                    const styles = window.getComputedStyle(el as Element);
                    return rect.width > 0 && rect.height > 0 && 
                           styles.visibility !== 'hidden' &&
                           styles.display !== 'none' &&
                           styles.opacity !== '0';
                  }, element);
                  
                  if (isVisible) {
                    csvButton = element;
                    console.log(`✓ Botón CSV encontrado con XPath: ${xpath}`);
                    return csvButton;
                  }
                }
              }
            } catch (err) {
              // Continuar con el siguiente XPath
            }
          }
        } catch (error) {
          console.log("Error al buscar por XPath:", error);
        }
      }
      
      // Buscar usando evaluación de JavaScript más avanzada
      if (!csvButton) {
        try {
          console.log("Buscando con JavaScript personalizado...");
          csvButton = await page.evaluateHandle(() => {
            // Buscar en todos los elementos
            const allElements = document.querySelectorAll('*');
            for (let el of allElements) {
              // Verificar por valor, texto o atributos
              const text = (el.textContent || '').toLowerCase();
              const value = ('value' in el && typeof (el as HTMLInputElement).value === 'string') ? (el as HTMLInputElement).value.toLowerCase() : '';
              const onclick = ('onclick' in el && typeof (el as HTMLElement).onclick === 'function')
                ? ((el as HTMLElement).onclick!.toString().toLowerCase())
                : '';
              const href = el.tagName.toLowerCase() === 'a' ? ((el as HTMLAnchorElement).href || '').toLowerCase() : '';
              
              if (text.includes('csv') || value.includes('csv') || onclick.includes('csv') || href.includes('csv')) {
                // Verificar que sea un elemento clickeable
                const tagName = el.tagName.toLowerCase();
                if (tagName === 'button' || tagName === 'a' || 
                   (tagName === 'input' && ['submit', 'button'].includes((el as HTMLInputElement).type))) {
                  
                  // Verificar visibilidad
                  const rect = el.getBoundingClientRect();
                  const styles = window.getComputedStyle(el);
                  if (rect.width > 0 && rect.height > 0 && 
                      styles.visibility !== 'hidden' &&
                      styles.display !== 'none' &&
                      styles.opacity !== '0') {
                    return el;
                  }
                }
              }
            }
            return null;
          });
          
          if (csvButton) {
            const isValidElement = await page.evaluate(el => el !== null, csvButton);
            if (isValidElement) {
              console.log('✓ Botón CSV encontrado con JavaScript personalizado');
              return csvButton;
            } else {
              csvButton = null;
            }
          }
        } catch (error) {
          console.log("Error en búsqueda con JavaScript:", error);
        }
      }
    }

    return csvButton;
  }

  private async clickCsvButton(page: Page, csvButton: any): Promise<void> {
    try {
      // Método 1: Scroll hasta el elemento y hacer click
      await page.evaluate(el => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, csvButton);
      
      await page.waitForTimeout(1000);
      
      // Intentar click normal primero
      try {
        await csvButton.click();
        console.log('Click realizado exitosamente');
        return;
      } catch (clickError) {
        console.log('Click normal falló, intentando método alternativo...');
      }
      
      // Método 2: Click usando JavaScript
      await page.evaluate(el => {
        if (el.click) {
          el.click();
        } else if (el.onclick) {
          el.onclick();
        } else {
          // Crear y disparar evento de click
          const event = new MouseEvent('click', {
            view: window,
            bubbles: true,
            cancelable: true
          });
          el.dispatchEvent(event);
        }
      }, csvButton);
      
      console.log('Click realizado usando JavaScript');
      
    } catch (error) {
      console.error('Error al hacer click en el botón CSV:', error);
      throw new Error('No se pudo hacer clic en el botón CSV');
    }
  }

  private async waitForDownload(beforeFiles: Set<string>): Promise<string> {
    const timeoutMs = parseInt(process.env.DOWNLOAD_TIMEOUT || '90000', 10);
    const startTime = Date.now();
    
    console.log('Esperando la descarga del archivo...');
    
    // Esperar tiempo inicial para que la descarga comience
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const findDownloadedFile = (): string | null => {
      try {
        const currentFiles = fs.readdirSync(this.downloadPath);
        
        // Buscar archivos nuevos que terminen en .csv
        for (const file of currentFiles) {
          if (!beforeFiles.has(file) && file.endsWith('.csv') && !file.endsWith('.crdownload')) {
            const filePath = path.join(this.downloadPath, file);
            try {
              const stats = fs.statSync(filePath);
              if (stats.size > 100) { // Archivo con contenido
                return filePath;
              }
            } catch (err) {
              // Archivo puede estar siendo escrito
            }
          }
        }
        
        // Buscar archivos .csv modificados recientemente
        const recentTime = Date.now() - 60000; // Último minuto
        for (const file of currentFiles) {
          if (file.endsWith('.csv') && !file.endsWith('.crdownload')) {
            const filePath = path.join(this.downloadPath, file);
            try {
              const stats = fs.statSync(filePath);
              if (stats.mtime.getTime() > recentTime && stats.size > 100) {
                console.log(`Archivo CSV modificado recientemente: ${file}`);
                return filePath;
              }
            } catch (err) {
              // Ignorar errores
            }
          }
        }
        
        return null;
      } catch (err) {
        console.log('Error al verificar archivos:', err);
        return null;
      }
    };
    
    // Verificar cada 3 segundos
    const checkInterval = 3000;
    let downloadedFile: string | null = null;
    
    while (Date.now() - startTime < timeoutMs) {
      downloadedFile = findDownloadedFile();
      
      if (downloadedFile) {
        console.log(`✓ Archivo descargado: ${path.basename(downloadedFile)}`);
        // Esperar un poco más para asegurar que la descarga terminó
        await new Promise(resolve => setTimeout(resolve, 2000));
        return downloadedFile;
      }
      
      const elapsed = Date.now() - startTime;
      console.log(`Verificando descarga... (${Math.round(elapsed/1000)}s transcurridos)`);
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    // Si no encontramos archivo descargado, buscar el más reciente
    try {
      const currentFiles = fs.readdirSync(this.downloadPath);
      const csvFiles = currentFiles
        .filter(file => file.endsWith('.csv') && !file.endsWith('.crdownload'))
        .map(file => ({
          name: file,
          path: path.join(this.downloadPath, file),
          mtime: fs.statSync(path.join(this.downloadPath, file)).mtime.getTime()
        }))
        .sort((a, b) => b.mtime - a.mtime);
      
      if (csvFiles.length > 0) {
        console.log(`Usando archivo CSV más reciente: ${csvFiles[0].name}`);
        return csvFiles[0].path;
      }
    } catch (err) {
      console.log('Error al buscar archivos CSV:', err);
    }
    
    throw new Error(`Timeout esperando la descarga después de ${timeoutMs / 1000} segundos`);
  }
}