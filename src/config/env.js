import 'dotenv/config';

const DEFAULT_DEMO_HASH =
  'scrypt$e2502977b87a0788b6edf0ff8dad584d$bcae24882310491931349a0e92353f8274c297d9637143b5b183983f96de897dd74b55a2be6d0d47d8081964cf45cff98f8ffdfe98fd7e3d964379e94ae98168';

export function loadConfig(overrides = {}) {
  const baseConfig = {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3000),

    // Configurações do Proxy Reverso (Pessoa 2)
    backendServiceUrl: (process.env.BACKEND_SERVICE_URL ?? 'http://localhost:8000').replace(/\/$/, ''),
    httpProxyTimeoutMs: Number(process.env.HTTP_PROXY_TIMEOUT_MS ?? 5000),

    jwt: {
      secret: process.env.JWT_SECRET,
      issuer: process.env.JWT_ISSUER ?? 'voting-api-gateway',
      audience: process.env.JWT_AUDIENCE ?? 'voting-services',
      expiresIn: process.env.JWT_EXPIRES_IN ?? '15m'
    },
    demoUser: {
      id: process.env.DEMO_USER_ID ?? 'usr-eleitor-001',
      name: process.env.DEMO_USER_NAME ?? 'Eleitor de Demonstração',
      email: process.env.DEMO_USER_EMAIL ?? 'eleitor@votacao.local',
      role: process.env.DEMO_USER_ROLE ?? 'VOTER',
      passwordHash: process.env.DEMO_USER_PASSWORD_HASH ?? DEFAULT_DEMO_HASH
    }
  };

  // Aplica overrides garantindo mesclagem correta dos objetos internos
  const config = {
    ...baseConfig,
    ...overrides,
    backendServiceUrl: overrides.backendServiceUrl ?? baseConfig.backendServiceUrl,
    httpProxyTimeoutMs: overrides.httpProxyTimeoutMs ?? baseConfig.httpProxyTimeoutMs,
    jwt: {
      ...baseConfig.jwt,
      ...overrides.jwt
    },
    demoUser: {
      ...baseConfig.demoUser,
      ...overrides.demoUser
    }
  };

  validateConfig(config);
  return config;
}

function validateConfig(config) {
  if (!Number.isInteger(config.port) || config.port <= 0 || config.port > 65535) {
    throw new Error('PORT deve ser um número inteiro entre 1 e 65535.');
  }

  if (typeof config.backendServiceUrl !== 'string' || !config.backendServiceUrl.startsWith('http')) {
    throw new Error('BACKEND_SERVICE_URL deve ser uma URL válida (ex: http://localhost:8000).');
  }

  if (!Number.isInteger(config.httpProxyTimeoutMs) || config.httpProxyTimeoutMs <= 0) {
    throw new Error('HTTP_PROXY_TIMEOUT_MS deve ser um número inteiro positivo em milissegundos.');
  }

  if (typeof config.jwt.secret !== 'string' || config.jwt.secret.length < 32) {
    throw new Error('JWT_SECRET deve possuir no mínimo 32 caracteres.');
  }

  if (!config.jwt.issuer || !config.jwt.audience || !config.jwt.expiresIn) {
    throw new Error('JWT_ISSUER, JWT_AUDIENCE e JWT_EXPIRES_IN são obrigatórios.');
  }
}