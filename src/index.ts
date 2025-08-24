import { DgiiCsvScraper } from './models/DgiiCsvScraper';
import { loadEnv } from './utils/env-loader';

// Cargar variables de entorno
loadEnv();

async function main(): Promise<void> {
  const scraper = new DgiiCsvScraper();
  
  try {
    await scraper.run();
    
    // Mostrar algunos datos como ejemplo
    console.log('\n📋 Primeros 5 registros guardados:');
    const sampleData = await scraper.queryData(5);
    console.table(sampleData);
    
  } catch (error) {
    console.error('Error en la aplicación:', error);
    process.exit(1);
  }
}

// Ejecutar la aplicación si este es el archivo principal
if (require.main === module) {
  main();
}

export default DgiiCsvScraper;
