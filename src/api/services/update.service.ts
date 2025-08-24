import { DgiiCsvScraper } from '../../models/DgiiCsvScraper';
import { setIsUpdating, setLastUpdate, isUpdating } from '../services/update-state.service';

// Instancia global del scraper
const dgiiScraper = new DgiiCsvScraper();

/**
 * Función para actualizar los datos de DGII
 */
export async function updateDgiiData(): Promise<void> {
  if (isUpdating) {
    console.log('Ya hay una actualización en progreso. Omitiendo...');
    return;
  }
  
  setIsUpdating(true);
  console.log('Iniciando actualización de datos DGII...');
  
  try {
    await dgiiScraper.run();
    setLastUpdate(new Date());
    console.log(`Actualización completada: ${new Date().toISOString()}`);
  } catch (error) {
    console.error('Error durante la actualización:', error);
    throw error;
  } finally {
    setIsUpdating(false);
  }
}
