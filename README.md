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

Consulte `INTEGRACAO.md` para juntar esta parte com o proxy, backend, banco e Docker Compose.
