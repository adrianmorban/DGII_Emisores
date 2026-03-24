export const openApiSpec = {
    openapi: '3.0.3',
    info: {
        title: 'DGII Emisores API',
        version: '1.0.0',
        description:
            'API para consultar contribuyentes autorizados como emisores electronicos en Republica Dominicana.'
    },
    servers: [
        {
            url: 'http://localhost:3000',
            description: 'Servidor local'
        }
    ],
    tags: [
        { name: 'Emisores', description: 'Consultas de emisores DGII' },
        { name: 'Sistema', description: 'Estado y salud del servicio' }
    ],
    paths: {
        '/api/v1/emisores': {
            get: {
                tags: ['Emisores'],
                summary: 'Obtener emisores con paginacion',
                parameters: [
                    {
                        in: 'query',
                        name: 'page',
                        schema: { type: 'integer', minimum: 1, default: 1 }
                    },
                    {
                        in: 'query',
                        name: 'limit',
                        schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 }
                    }
                ],
                responses: {
                    '200': {
                        description: 'Listado de emisores',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        data: {
                                            type: 'array',
                                            items: { $ref: '#/components/schemas/Emisor' }
                                        },
                                        pagination: {
                                            type: 'object',
                                            properties: {
                                                page: { type: 'integer' },
                                                limit: { type: 'integer' },
                                                totalItems: { type: 'integer' },
                                                totalPages: { type: 'integer' }
                                            }
                                        },
                                        lastUpdate: { type: 'string', nullable: true }
                                    }
                                }
                            }
                        }
                    },
                    '400': { $ref: '#/components/responses/BadRequest' },
                    '500': { $ref: '#/components/responses/InternalError' }
                }
            }
        },
        '/api/v1/emisores/{rnc}': {
            get: {
                tags: ['Emisores'],
                summary: 'Obtener emisor por RNC',
                parameters: [
                    {
                        in: 'path',
                        name: 'rnc',
                        required: true,
                        schema: { type: 'string', minLength: 9, maxLength: 11 }
                    }
                ],
                responses: {
                    '200': {
                        description: 'Emisor encontrado',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        data: { $ref: '#/components/schemas/Emisor' },
                                        lastUpdate: { type: 'string', nullable: true }
                                    }
                                }
                            }
                        }
                    },
                    '400': { $ref: '#/components/responses/BadRequest' },
                    '404': { $ref: '#/components/responses/NotFound' },
                    '500': { $ref: '#/components/responses/InternalError' }
                }
            }
        },
        '/api/v1/emisores/buscar': {
            get: {
                tags: ['Emisores'],
                summary: 'Buscar emisores por razon social o nombre comercial',
                parameters: [
                    {
                        in: 'query',
                        name: 'q',
                        required: true,
                        schema: { type: 'string', minLength: 3 }
                    }
                ],
                responses: {
                    '200': {
                        description: 'Resultados de busqueda',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        data: {
                                            type: 'array',
                                            items: { $ref: '#/components/schemas/Emisor' }
                                        },
                                        count: { type: 'integer' },
                                        query: { type: 'string' },
                                        lastUpdate: { type: 'string', nullable: true }
                                    }
                                }
                            }
                        }
                    },
                    '400': { $ref: '#/components/responses/BadRequest' },
                    '500': { $ref: '#/components/responses/InternalError' }
                }
            }
        },
        '/api/v1/status': {
            get: {
                tags: ['Sistema'],
                summary: 'Estado de la aplicacion y ultima actualizacion',
                responses: {
                    '200': {
                        description: 'Estado del servicio'
                    },
                    '500': { $ref: '#/components/responses/InternalError' }
                }
            }
        },
        '/api/v1/actualizar': {
            post: {
                tags: ['Sistema'],
                summary: 'Forzar actualizacion de datos',
                responses: {
                    '200': { description: 'Actualizacion iniciada' },
                    '409': { description: 'Ya hay una actualizacion en progreso' },
                    '500': { $ref: '#/components/responses/InternalError' }
                }
            }
        },
        '/health': {
            get: {
                tags: ['Sistema'],
                summary: 'Health check del servicio',
                responses: {
                    '200': { description: 'Servicio disponible' }
                }
            }
        }
    },
    components: {
        schemas: {
            Emisor: {
                type: 'object',
                properties: {
                    rnc: { type: 'string', example: '131188691' },
                    razon_social: { type: 'string', example: 'EMPRESA DEMO SRL' },
                    nombre_comercial: { type: 'string', example: 'EMPRESA DEMO' },
                    estado: { type: 'string', example: 'ACTIVO' }
                },
                additionalProperties: true
            }
        },
        responses: {
            BadRequest: {
                description: 'Solicitud invalida',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                error: { type: 'string' }
                            }
                        }
                    }
                }
            },
            NotFound: {
                description: 'Recurso no encontrado',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                error: { type: 'string' }
                            }
                        }
                    }
                }
            },
            InternalError: {
                description: 'Error interno del servidor',
                content: {
                    'application/json': {
                        schema: {
                            type: 'object',
                            properties: {
                                error: { type: 'string' }
                            }
                        }
                    }
                }
            }
        }
    }
};
