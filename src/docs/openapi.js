export function createOpenApiDocument(config) {
  return {
    openapi: '3.0.3',
    info: {
      title: 'API Gateway — Votação Eletrônica Escalável',
      version: '1.0.0',
      description: 'Endpoint de login e validação JWT do grupo G1.'
    },
    servers: [{ url: `http://localhost:${config.port}` }],
    tags: [
      { name: 'Autenticação' },
      { name: 'Protegido' },
      { name: 'Infraestrutura' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        LoginRequest: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', example: 'eleitor@votacao.local' },
            password: { type: 'string', format: 'password', example: 'Voto@123' }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            tokenType: { type: 'string', example: 'Bearer' },
            expiresAt: { type: 'string', format: 'date-time' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' },
                role: { type: 'string' }
              }
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                timestamp: { type: 'string', format: 'date-time' },
                requestId: { type: 'string' }
              }
            }
          }
        }
      }
    },
    paths: {
      '/health': {
        get: {
          tags: ['Infraestrutura'],
          summary: 'Verifica se o gateway está ativo',
          responses: {
            200: { description: 'Serviço ativo' }
          }
        }
      },
      '/auth/login': {
        post: {
          tags: ['Autenticação'],
          summary: 'Autentica o usuário e emite um JWT',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoginRequest' }
              }
            }
          },
          responses: {
            200: {
              description: 'Login realizado',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/LoginResponse' }
                }
              }
            },
            400: {
              description: 'Dados inválidos',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/Error' } }
              }
            },
            401: {
              description: 'Credenciais inválidas',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/Error' } }
              }
            }
          }
        }
      },
      '/auth/validate': {
        get: {
          tags: ['Autenticação'],
          summary: 'Valida o JWT recebido',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Token válido' },
            401: {
              description: 'Token ausente, expirado ou inválido',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/Error' } }
              }
            }
          }
        }
      },
      '/api/me': {
        get: {
          tags: ['Protegido'],
          summary: 'Exemplo de rota protegida pelo middleware JWT',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Dados extraídos do token' },
            401: { description: 'Não autenticado' }
          }
        }
      }
    }
  };
}
