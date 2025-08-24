# DGII Emisores API

Aplicación para obtener y consultar información de emisores electrónicos autorizados por la Dirección General de Impuestos Internos (DGII) de República Dominicana.

## Descripción

Esta aplicación descarga automáticamente el listado de contribuyentes autorizados como emisores electrónicos desde el portal de la DGII, lo procesa y almacena en una base de datos SQLite. Proporciona una API REST para consultar estos datos de manera eficiente.

## Características

- **Actualización Automática**: Descarga periódicamente la información desde el portal de la DGII.
- **Base de Datos Eficiente**: Almacenamiento en SQLite para consultas rápidas.
- **API REST**: Endpoints para buscar y filtrar emisores.
- **Configuración Flexible**: Variables de entorno para personalizar comportamiento.
- **Programación de Actualizaciones**: Configura actualizaciones automáticas mediante CRON.
- **Robustez**: Manejo de errores y reintentos automáticos.

## Tecnologías

- **Backend**: Node.js + TypeScript + Express.js
- **Web Scraping**: Puppeteer
- **Base de Datos**: SQLite3
- **Programación de Tareas**: Node-cron

## Prerrequisitos

- Node.js (v16.0.0 o superior)
- NPM o Yarn
- Navegador Chromium (para Puppeteer)

## Instalación

1. Clonar el repositorio:
   ```bash
   git clone <url-del-repositorio>
   cd DGII_Emisores
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Configurar variables de entorno:
   ```bash
   cp .env.example .env
   ```

4. Editar `.env` con la configuración deseada.

5. Compilar el proyecto:
   ```bash
   npm run build
   ```

## Uso

### Ejecutar el servidor

```bash
npm start
```

### Ejecutar solo el scraper (sin API)

```bash
npm run start:scraper
```

### Ejecutar en modo desarrollo

```bash
npm run dev
```

## API Endpoints

### Obtener todos los emisores (paginado)
```
GET /api/v1/emisores?page=1&limit=50
```

### Buscar emisor por RNC
```
GET /api/v1/emisores/{rnc}
```

### Buscar emisores por nombre o razón social
```
GET /api/v1/emisores/buscar?q={término}
```

### Obtener estado del servicio
```
GET /api/v1/status
```

### Forzar actualización de datos
```
POST /api/v1/actualizar
```

## Configuración

La aplicación se configura mediante variables de entorno:

| Variable | Descripción | Valor por defecto |
| --- | --- | --- |
| `DGII_URL` | URL de la página DGII para descargar el CSV | https://dgii.gov.do/app/WebApps/Misc/VerLista/?doc=EEC160525 |
| `DB_PATH` | Ruta de la base de datos | ./dgii_data.db |
| `DOWNLOAD_PATH` | Carpeta para descargas temporales | ./downloads |
| `PUPPETEER_HEADLESS` | Modo sin interfaz gráfica para Puppeteer | true |
| `PUPPETEER_TIMEOUT` | Tiempo máximo de espera (ms) | 60000 |
| `DOWNLOAD_TIMEOUT` | Tiempo máximo para descargas (ms) | 60000 |
| `MAX_RETRIES` | Número de reintentos para operaciones | 3 |
| `PORT` | Puerto del servidor Express | 3000 |
| `NODE_ENV` | Entorno (development/production) | development |
| `UPDATE_SCHEDULE` | Programación de actualizaciones (formato cron) | 0 3 * * * |
| `FORCE_UPDATE_ON_START` | Forzar actualización al iniciar | true |

## Estructura del Proyecto

```
DGII_Emisores/
├── dist/            # Código compilado
├── downloads/       # Descargas temporales
├── src/             # Código fuente
│   ├── api/         # API REST
│   │   ├── controllers/  # Controladores
│   │   ├── routes/       # Rutas
│   │   ├── services/     # Servicios de API
│   │   └── server.ts     # Configuración del servidor
│   ├── models/      # Modelos de dominio
│   ├── services/    # Servicios principales
│   ├── types/       # Definiciones de tipos
│   ├── utils/       # Utilidades
│   ├── index.ts     # Punto de entrada del scraper
│   └── server.ts    # Punto de entrada del servidor
├── .env             # Variables de entorno (local)
├── .env.example     # Plantilla de variables de entorno
├── package.json     # Dependencias y scripts
└── tsconfig.json    # Configuración de TypeScript
```

## Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## Contribuciones

Las contribuciones son bienvenidas. Por favor, envía un Pull Request o abre un Issue para discutir los cambios propuestos.
