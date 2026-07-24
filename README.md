# G1 API Gateway — Login e Validador JWT

Implementação da parte **Endpoint de Login + Validador JWT** para o cenário de **Sistema de Votação Eletrônica Escalável**.

## Fluxo implementado

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

## O que está pronto

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

## Executar localmente

Requisito: Node.js 20 ou superior.

```bash
cp .env.example .env
npm install
npm start
```

Acesse:

- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/openapi.json`

## Credenciais de demonstração

```text
E-mail: eleitor@votacao.local
Senha:  Voto@123
Perfil: VOTER
```

Essas credenciais existem apenas para a demonstração local. Na integração final, o usuário deve vir do backend e do banco de dados.

## Testar pelo terminal

### 1. Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"eleitor@votacao.local","password":"Voto@123"}'
```

Resposta esperada:

```json
{
  "accessToken": "eyJ...",
  "tokenType": "Bearer",
  "expiresAt": "2026-07-21T22:00:00.000Z",
  "user": {
    "id": "usr-eleitor-001",
    "name": "Eleitor de Demonstração",
    "email": "eleitor@votacao.local",
    "role": "VOTER"
  }
}
```

### 2. Validar o token

```bash
curl http://localhost:3000/auth/validate \
  -H "Authorization: Bearer COLE_O_TOKEN_AQUI"
```

### 3. Acessar rota protegida

```bash
curl http://localhost:3000/api/me \
  -H "Authorization: Bearer COLE_O_TOKEN_AQUI"
```

## Executar os testes

```bash
npm test
```

Os testes verificam login correto, credenciais incorretas, ausência de token, token válido, token adulterado e autorização por perfil.

Implementação da parte **Roteador Proxy + Logs + Timeout** para o cenário de **Sistema de Votação Eletrônica Escalável**.

## O que está pronto

- **Roteador Proxy Dinâmico**: Captura e retransmite qualquer sub-rota direcionada a `/api/v1/voting/*`.
- **Encaminhamento Transparente**: Redirecionamento automático das requisições para o backend interno (`http://localhost:8000`).
- **Header Scrubbing**: Limpeza preventiva de cabeçalhos sensíveis (`x-user-*`) enviados por clientes externos.
- **Injeção de Identidade**: Repasse seguro dos cabeçalhos de confiança `x-user-id` e `x-user-role` extraídos do token JWT autenticado.
- **Resiliência e Timeout**: Controle do tempo limite de resposta via `AbortSignal.timeout`, gerando HTTP `504 (Gateway Timeout)` em caso de estouro de tempo.
- **Tratamento de Indisponibilidade**: Captura centralizada de falhas de conexão e queda do microserviço, gerando HTTP `502 (Bad Gateway)`.
- **Documentação OpenAPI**: Swagger interativo em `/docs` atualizado com as rotas do proxy.

## 🚀 Executar Localmente

### Requisitos

- Node.js 20 ou superior
- Python 3.10+ (para o backend de votação)

### Passo a Passo

**1. Instale as dependências do Node.js:**

```bash
npm install
```

**2. Configure o arquivo de variáveis de ambiente (`.env`):**

```
PORT=3000
NODE_ENV=development
JWT_SECRET=uma_chave_secreta_com_mais_de_32_caracteres_aqui
BACKEND_SERVICE_URL=http://localhost:8000
HTTP_PROXY_TIMEOUT_MS=5000
```

**3. Inicie o API Gateway (Node.js):**

```bash
npm run dev
```

**4. Inicie o Backend de Votação (Python/FastAPI) em outro terminal:**

```bash
uvicorn main:app --reload --port 8000
```

## 🌐 Endpoints Principais

Acesse no navegador:

- API Gateway: `http://localhost:3000`
- Documentação Swagger: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/openapi.json`

### Credenciais de Demonstração

```
E-mail: eleitor@votacao.local
Senha:  Voto@123
Perfil: VOTER
```

## 🧪 Testar pelo Terminal (cURL)

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

### 3. Consultar Candidatos via Proxy (Pessoa 2)

```bash
curl -X GET http://localhost:3000/api/v1/voting/candidatos \
  -H "Authorization: Bearer COLE_O_TOKEN_AQUI"
```

### 4. Registrar Voto via Proxy (Pessoa 2)

```bash
curl -X POST http://localhost:3000/api/v1/voting/votar \
  -H "Authorization: Bearer COLE_O_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{"candidato_id": 1}'
```

> Atenção: o backend em Python (FastAPI) espera o campo em `snake_case` (`candidato_id`), não `camelCase`. Usar `candidatoId` faz o Pydantic rejeitar o corpo da requisição.

### 5. Teste de Resiliência — Backend Indisponível (502 Bad Gateway)

Caso o backend em Python seja desligado enquanto uma requisição é feita ao proxy:

```json
{
  "error": {
    "code": "BAD_GATEWAY",
    "message": "Serviço de backend indisponível em: http://localhost:8000/candidatos",
    "timestamp": "2026-07-23T19:30:00.000Z",
    "requestId": "req-12345"
  }
}
```

Consulte `INTEGRACAO.md` para juntar esta parte com o proxy, backend, banco e Docker Compose.
