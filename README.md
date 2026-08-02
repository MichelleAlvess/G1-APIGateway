# G1 API Gateway — Sistema de Votação Eletrônica Escalável

Implementação da arquitetura distribuída para o **Sistema de Votação Eletrônica Escalável**.

---

## Frontend Web Client e Hospedagem S3

Implementação da parte **Frontend Web Client + Hospedagem S3** para a interface do eleitor e distribuição estática.

### O que está pronto
- **Interface Web Client**: Interface moderna em HTML5, CSS3 responsivo (Dark Glassmorphism) e JavaScript ES6+ localizada no diretório `/frontend`.
- **Autenticação e JWT**: Modal de login integrado ao endpoint `/auth/login`, salvamento de token no `localStorage` e envio automático do cabeçalho `Authorization: Bearer <TOKEN>`.
- **Apuração em Tempo Real**: Exibição dos candidatos e contagem dinâmica dos votos computados com gráfico de porcentagens.
- **Resiliência e UX**: Sistema de notificações Toast e tratamento amigável para falhas de conexão ou erros de gateway (`502 Bad Gateway`).
- **Arquivos para Hospedagem no Amazon S3**: Política de acesso público (`aws-s3-policy.json`), configuração de CORS (`cors-config.json`) e script de deploy (`deploy_s3.bat`).

---

## Endpoint de Login + Validador JWT

Implementação da parte **Endpoint de Login + Validador JWT**.

### Fluxo implementado
```text
Cliente
  | POST /auth/login (e-mail e senha)
  v
API Gateway
  | verifica o hash da senha
  | emite JWT assinado e com expiração
  v
Cliente armazena o token
  | Authorization: Bearer <JWT>
  v
Middleware authenticate
  | valida assinatura, expiração, emissor e audiência
  | preenche req.auth
  v
Rota protegida ou roteador proxy
```

### O que está pronto
- `POST /auth/login`: valida as credenciais e emite um token JWT.
- `GET /auth/validate`: informa se um token é válido.
- Middleware `authenticate`: protege qualquer rota do gateway.
- Middleware `authorizeRoles`: permite autorização por perfil.
- Hash de senha com `scrypt` e comparação em tempo constante.
- JWT com `sub`, `role`, `iss`, `aud`, `iat`, `exp` e `jti`.
- Logs estruturados, timestamp e `x-request-id`.
- Tratamento centralizado de exceções.
- Swagger/OpenAPI em `/docs`.
- Testes funcionais do login e do validador.
- Dockerfile e trecho de Docker Compose.

---

## Roteador Proxy + Logs + Timeout

Implementação da parte **Roteador Proxy + Logs + Timeout**.

### O que está pronto
- **Roteador Proxy Dinâmico**: Captura e retransmite qualquer sub-rota direcionada a `/api/v1/voting/*`.
- **Encaminhamento Transparente**: Redirecionamento automático das requisições para o backend interno (`http://localhost:8000`).
- **Header Scrubbing**: Limpeza preventiva de cabeçalhos sensíveis (`x-user-*`) enviados por clientes externos.
- **Injeção de Identidade**: Repasse seguro dos cabeçalhos de confiança `x-user-id` e `x-user-role` extraídos do token JWT autenticado.
- **Resiliência e Timeout**: Controle do tempo limite de resposta via `AbortSignal.timeout`, gerando HTTP `504 (Gateway Timeout)` em caso de estouro de tempo.
- **Tratamento de Indisponibilidade**: Captura centralizada de falhas de conexão e queda do microserviço, gerando HTTP `502 (Bad Gateway)`.
- **Documentação OpenAPI**: Swagger interativo em `/docs` atualizado com as rotas do proxy.

---

## Executar Localmente

### Com Docker Compose (Recomendado)
```bash
docker compose up -d --build
```
Acesse a API em `http://localhost:3000` e abra o arquivo `frontend/index.html` no seu navegador.

### Sem Docker (Node.js + Python)
```bash
cp .env.example .env
npm install
npm start
```

Acesse:
- API Gateway: `http://localhost:3000`
- Swagger Docs: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/openapi.json`
- Frontend Web: Abra o arquivo `frontend/index.html` no navegador.

### Credenciais de Demonstração
```text
E-mail: eleitor@votacao.local
Senha:  Voto@123
Perfil: VOTER
```

---

## Testar pelo Terminal (cURL)

### 1. Autenticação (Login)
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"eleitor@votacao.local","password":"Voto@123"}'
```

### 2. Validar o Token JWT
```bash
curl http://localhost:3000/auth/validate \
  -H "Authorization: Bearer COLE_O_TOKEN_AQUI"
```

### 3. Consultar Candidatos via Proxy
```bash
curl -X GET http://localhost:3000/api/v1/voting/candidatos \
  -H "Authorization: Bearer COLE_O_TOKEN_AQUI"
```

### 4. Registrar Voto via Proxy
```bash
curl -X POST http://localhost:3000/api/v1/voting/votar \
  -H "Authorization: Bearer COLE_O_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{"candidato_id": 1}'
```
