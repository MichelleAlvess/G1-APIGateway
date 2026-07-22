import 'dotenv/config';

const DEFAULT_DEMO_HASH =
  'scrypt$e2502977b87a0788b6edf0ff8dad584d$bcae24882310491931349a0e92353f8274c297d9637143b5b183983f96de897dd74b55a2be6d0d47d8081964cf45cff98f8ffdfe98fd7e3d964379e94ae98168';

export function loadConfig(overrides = {}) {
  const config = {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3000),
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
    },
    ...overrides
  };

  config.jwt = {
    secret: overrides.jwt?.secret ?? config.jwt.secret,
    issuer: overrides.jwt?.issuer ?? config.jwt.issuer,
    audience: overrides.jwt?.audience ?? config.jwt.audience,
    expiresIn: overrides.jwt?.expiresIn ?? config.jwt.expiresIn
  };

  config.demoUser = {
    ...config.demoUser,
    ...overrides.demoUser
  };

  validateConfig(config);
  return config;
}

function validateConfig(config) {
  if (!Number.isInteger(config.port) || config.port <= 0 || config.port > 65535) {
    throw new Error('PORT deve ser um número inteiro entre 1 e 65535.');
  }

  if (typeof config.jwt.secret !== 'string' || config.jwt.secret.length < 32) {
    throw new Error('JWT_SECRET deve possuir no mínimo 32 caracteres.');
  }

  if (!config.jwt.issuer || !config.jwt.audience || !config.jwt.expiresIn) {
    throw new Error('JWT_ISSUER, JWT_AUDIENCE e JWT_EXPIRES_IN são obrigatórios.');
  }
}
