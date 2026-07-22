# Integração com as demais partes do grupo

## 2 — Roteador proxy

O middleware `jwtMiddleware` deve ser executado antes das rotas encaminhadas ao backend:

```js
app.use('/api/votes', jwtMiddleware, votesProxy);
```

Depois da validação, os dados confiáveis ficam em `req.auth`. O proxy pode encaminhar apenas os campos necessários em cabeçalhos internos, por exemplo:

```js
proxyReq.setHeader('x-user-id', req.auth.userId);
proxyReq.setHeader('x-user-role', req.auth.role);
```

O backend não deve confiar em valores `x-user-*` enviados diretamente pelo cliente. O gateway deve remover os cabeçalhos recebidos e recriá-los após validar o JWT.

## 3 — Backend e banco de dados

A classe `InMemoryUserRepository` é apenas uma substituição temporária. Ela deve ser trocada por um repositório que consulte o serviço de usuários ou o banco de dados.

Contrato esperado pelo `AuthService`:

```js
const user = await userRepository.findByEmail(email);
// Retorno: { id, name, email, role, passwordHash, active }
```

A senha nunca deve ser salva em texto puro. O valor persistido deve ser um hash com salt.

## 4 — Docker Compose, GitHub e AWS

No Docker Compose, o segredo JWT deve ser fornecido por variável de ambiente ou secret, nunca gravado no repositório. Todas as instâncias do gateway que usam HS256 precisam do mesmo segredo para validar os tokens.

Para a arquitetura futura na AWS, o fluxo pode ser migrado para Amazon API Gateway com um Lambda Authorizer ou Amazon Cognito. Nesta atividade local, o middleware Express representa o componente de autorização do gateway.
