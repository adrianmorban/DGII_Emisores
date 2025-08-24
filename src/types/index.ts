export interface DgiiDataRecord {
  orden: string;
  rnc: string;
  razon_social: string;
  nombre_comercial: string;
  fecha_autorizacion: string;
  fecha_limite: string;
  created_at?: string;
  id?: number;
}

export interface CsvRecord {
  [key: string]: string;
}
