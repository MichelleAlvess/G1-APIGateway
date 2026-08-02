# Implementação AWS - API Gateway, JWT e Lambda

Esta pasta contém a segunda parte do projeto em uma versão simples, didática e pronta para implantação com **AWS SAM**.

## Arquitetura implementada

```text
Cliente
  |
  | POST /auth/login
  v
Amazon API Gateway ------> Lambda Login ------> devolve JWT
  |
  | Authorization: Bearer <JWT>
  v
Lambda Authorizer valida assinatura, expiração, emissor e audiência
  |
  +------> Lambda Candidatos
  |
  +------> Lambda Voto ------> Amazon SQS
  |
  +------> Lambda Validação

Amazon SQS ------> Lambda Worker ------> Amazon DynamoDB
                          |
                          v (falha repetida)
                   Dead-Letter Queue (DLQ)
```

A Lambda Worker (`vote-worker.js`) consome as mensagens da fila `VoteQueue`,
grava a contagem de votos no DynamoDB e garante que reentregas da mesma
mensagem (comportamento normal do SQS) não contem o voto duas vezes.
Mensagens que falham repetidamente são desviadas para a Dead-Letter Queue
(`VoteQueueDLQ`) em vez de travar o processamento das demais.

## Endpoints

| Método | Rota | Proteção | Função |
|---|---|---|---|
| `GET` | `/health` | Pública | Verifica se a API está ativa |
| `POST` | `/auth/login` | Pública | Valida as credenciais e gera o JWT |
| `GET` | `/auth/validate` | JWT | Mostra os dados extraídos do token |
| `GET` | `/api/v1/voting/candidatos` | JWT | Lista candidatos de demonstração |
| `POST` | `/api/v1/voting/votar` | JWT | Envia o voto para o Amazon SQS (processado depois, de forma assíncrona, pela Lambda Worker) |

Credenciais de demonstração:

```text
E-mail: eleitor@votacao.local
Senha:  Voto@123
```

## Arquivos principais

```text
aws/
├── template.yaml                 # Infraestrutura AWS SAM
├── env.local.json                # Variáveis para teste local
├── package.json                  # Script dos testes locais
├── lambdas/
│   ├── login.js                  # Geração do JWT
│   ├── authorizer.js             # Validação do JWT no API Gateway
│   ├── health.js
│   ├── validate.js
│   ├── candidates.js
│   ├── vote.js                   # Publica voto no SQS
│   ├── vote-worker.js            # Consome o SQS e grava no DynamoDB (idempotente)
│   └── common/                   # Código compartilhado
├── events/
│   └── sqs-vote.json             # Evento de exemplo para testar o worker localmente
└── test/
    ├── aws-auth.test.js          # Testes da autenticação
    ├── aws-api.test.js           # Testes das rotas da API
    └── aws-worker.test.js        # Testes do worker (lote, duplicata, mensagem inválida, falha)
```

## Pré-requisitos

- Conta AWS com permissão para CloudFormation, Lambda, API Gateway, IAM e SQS.
- AWS CLI configurada com `aws configure`.
- AWS SAM CLI.
- Docker Desktop apenas para executar `sam local`.

## Testar o código da autenticação sem subir para a AWS

No PowerShell:

```powershell
cd aws
npm test
```

O script de teste também pode ser executado diretamente:

```powershell
node --test test/aws-auth.test.js
```

## Testar com API Gateway e Lambda simulados localmente

```powershell
cd aws
sam build
sam local start-api --env-vars env.local.json
```

A API local normalmente ficará em `http://127.0.0.1:3000`.

Login:

```powershell
$login = Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:3000/auth/login `
  -ContentType 'application/json' `
  -Body '{"email":"eleitor@votacao.local","password":"Voto@123"}'

$token = $login.accessToken
$token
```

Validar JWT:

```powershell
Invoke-RestMethod `
  -Method Get `
  -Uri http://127.0.0.1:3000/auth/validate `
  -Headers @{ Authorization = "Bearer $token" }
```

Enviar voto:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:3000/api/v1/voting/votar `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType 'application/json' `
  -Body '{"candidato_id":1}'
```

No teste local, `LOCAL_DEMO_MODE=true` evita a necessidade de uma fila real. Na implantação AWS, a função usa a fila criada pelo `template.yaml`.

## Implantar na AWS

### 1. Validar e construir

```powershell
cd aws
sam validate
sam build
```

### 2. Gerar uma chave JWT

```powershell
$bytes = New-Object byte[] 48
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
$jwtSecret = [Convert]::ToBase64String($bytes)
```

### 3. Primeiro deploy

```powershell
sam deploy --guided
```

Durante as perguntas do comando:

- Informe um nome como `g1-voting-aws` para a stack.
- Escolha a região usada pelo grupo.
- Em `JwtSecret`, cole o valor de `$jwtSecret`.
- Aceite a criação de papéis IAM pelo SAM.
- Salve as configurações quando o SAM perguntar.

Ao final, copie o valor de `ApiBaseUrl` exibido em **Outputs**.

## Testar depois do deploy

```powershell
$baseUrl = 'COLE_AQUI_O_ApiBaseUrl'

$login = Invoke-RestMethod `
  -Method Post `
  -Uri "$baseUrl/auth/login" `
  -ContentType 'application/json' `
  -Body '{"email":"eleitor@votacao.local","password":"Voto@123"}'

$token = $login.accessToken

Invoke-RestMethod `
  -Method Get `
  -Uri "$baseUrl/api/v1/voting/candidatos" `
  -Headers @{ Authorization = "Bearer $token" }

Invoke-RestMethod `
  -Method Post `
  -Uri "$baseUrl/api/v1/voting/votar" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType 'application/json' `
  -Body '{"candidato_id":1}'
```

## Responsabilidade de cada componente

- **Amazon API Gateway:** expõe as rotas HTTP e chama as Lambdas.
- **Lambda Login:** verifica a conta de demonstração e assina o JWT.
- **Lambda Authorizer:** impede o acesso quando o token está ausente, adulterado ou expirado.
- **Lambda Candidatos:** representa uma consulta simples da API.
- **Lambda Voto:** valida a entrada, recupera o ID do eleitor do JWT e envia o evento ao SQS.
- **Amazon SQS:** desacopla a recepção do voto do processamento e da persistência.
- **Lambda Worker:** consome a fila em lote, garante idempotência (não conta o mesmo voto duas vezes) e grava o resultado no DynamoDB. Reporta apenas as mensagens que falharam (`ReportBatchItemFailures`), para não reprocessar o lote inteiro por causa de uma mensagem só.
- **Dead-Letter Queue (DLQ):** recebe as mensagens que falharam 3 vezes seguidas, evitando que uma mensagem "envenenada" trave a fila indefinidamente.

## Testar o worker localmente

```powershell
cd aws
node --test test/aws-worker.test.js
```

Também é possível simular a invocação real via SAM, usando o evento de exemplo:

```powershell
cd aws
sam build
sam local invoke VoteWorkerFunction --event events/sqs-vote.json --env-vars events/env.worker.local.json
```

## Limite proposital desta versão

Para manter o projeto simples, há apenas um usuário de demonstração configurado por variáveis de ambiente e a lista de candidatos é fixa. Em uma versão maior, esses dados podem vir do Amazon Cognito e do DynamoDB. A estrutura das rotas e o Lambda Authorizer não precisam ser refeitos para que o grupo integre essas partes.
