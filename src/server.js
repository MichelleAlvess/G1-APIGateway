import { createApp } from './app.js';
import { loadConfig } from './config/env.js';

try {
  const config = loadConfig();
  const app = createApp(config);

  const server = app.listen(config.port, () => {
    console.log(`API Gateway executando em http://localhost:${config.port}`);
    console.log(`Swagger em http://localhost:${config.port}/docs`);
  });

  function shutdown(signal) {
    console.log(`${signal} recebido. Encerrando o servidor...`);
    server.close((error) => {
      if (error) {
        console.error('Erro ao encerrar o servidor:', error);
        process.exit(1);
      }
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
} catch (error) {
  console.error('Falha ao iniciar a aplicação:', error.message);
  process.exit(1);
}
