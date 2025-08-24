// Información sobre la última actualización
export let lastUpdate: Date | null = null;
export let isUpdating = false;

/**
 * Registra el momento de la última actualización
 */
export function setLastUpdate(date: Date): void {
  lastUpdate = date;
}

/**
 * Establece el estado de actualización
 */
export function setIsUpdating(status: boolean): void {
  isUpdating = status;
}
