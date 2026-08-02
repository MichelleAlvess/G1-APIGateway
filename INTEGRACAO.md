# README de Integração — Sistema de Votação Eletrônica na AWS

Este documento explica como integrar as partes dos quatro integrantes sem duplicar recursos ou alterar os contratos já implementados.

A arquitetura final esperada é:

```text
Frontend no S3
      |
      v
Amazon API Gateway
      |
      +--> Lambda Login --> gera JWT
      |
      +--> Lambda Authorizer --> valida JWT
      |
      +--> Lambda Candidatos
      |
      +--> Lambda Voto
                |
                v
           Amazon SQS
                |
                v
           Lambda Worker
                |
                v
          Amazon DynamoDB
```

---

## 1. Regra principal da integração

O arquivo central da infraestrutura é:

```text
aws/template.yaml
```

Todos devem integrar seus recursos nesse mesmo arquivo.

Não criar separadamente:

- outro Amazon API Gateway;
- outra fila principal de votos;
- outro projeto SAM;
- outra stack para a mesma aplicação;
- funções com nomes que já existem no template.

A fila principal já existe no template com o recurso lógico:

```yaml
VoteQueue
```

A função que recebe o voto já publica nessa fila por meio da variável:

```text
VOTE_QUEUE_URL
```

---

## 2. O que já está implementado

A implementação AWS está dentro da pasta:

```text
aws/
```

### Recursos existentes em `aws/template.yaml`

| Recurso | Identificador no template | Situação |
|---|---|---|
| Amazon API Gateway | `VotingApi` | Pronto |
| Lambda Authorizer JWT | `JwtAuthorizerFunction` | Pronto |
| Lambda de login | `LoginFunction` | Pronto |
| Lambda de validação do token | `ValidateTokenFunction` | Pronto |
| Lambda de listagem de candidatos | `CandidatesFunction` | Pronto com dados fixos |
| Lambda de recebimento do voto | `VoteFunction` | Pronto |
| Amazon SQS de votos | `VoteQueue` | Criada no template |

### Rotas disponíveis

| Método | Rota | Proteção |
|---|---|---|
| `GET` | `/health` | Pública |
| `POST` | `/auth/login` | Pública |
| `GET` | `/auth/validate` | JWT |
| `GET` | `/api/v1/voting/candidatos` | JWT |
| `POST` | `/api/v1/voting/votar` | JWT |

### Credenciais locais de demonstração

```text
E-mail: eleitor@votacao.local
Senha:  Voto@123
```

Essas credenciais servem apenas para desenvolvimento e apresentação.

---

## 3. Contratos que não devem ser alterados sem acordo do grupo

### 3.1 Cabeçalho de autenticação

As rotas protegidas recebem:

```http
Authorization: Bearer <JWT>
```

O Lambda Authorizer valida o token e envia os seguintes dados para as Lambdas:

```text
userId
email
name
role
tokenId
```

O identificador confiável do eleitor vem do JWT. O frontend não deve enviar `eleitor_id` no corpo do voto.

### 3.2 Corpo da requisição de voto

```json
{
  "candidato_id": 1
}
```

O campo `candidato_id` deve ser um número inteiro positivo.

### 3.3 Mensagem publicada no SQS

A Lambda `VoteFunction` envia para a fila uma mensagem com este formato:

```json
{
  "eventId": "identificador-unico-do-evento",
  "type": "VOTE_SUBMITTED",
  "candidato_id": 1,
  "eleitor_id": "usr-eleitor-001",
  "role": "VOTER",
  "request_id": "identificador-da-requisicao",
  "created_at": "2026-08-02T00:00:00.000Z"
}
```

A mensagem também possui o atributo:

```text
eventType = VOTE_SUBMITTED
```

O worker deve aceitar exatamente esse contrato. Campos novos podem ser adicionados, mas os campos existentes não devem ser removidos ou renomeados.

### 3.4 Resposta da rota de candidatos

Atualmente a função retorna:

```json
{
  "candidatos": [
    {
      "id": 1,
      "nome": "Candidato A",
      "partido": "Partido Sol",
      "votos": 0
    }
  ]
}
```

A Pessoa 4 pode trocar a fonte fixa pelo DynamoDB, mas deve manter o campo principal `candidatos` e os nomes `id`, `nome`, `partido` e `votos` para não quebrar o frontend.

---

## 4. Integração da Pessoa 1 — Frontend e hospedagem no S3

A Pessoa 1 deve consumir a API existente. Não deve implementar autenticação novamente no frontend.

### Endereço da API

Durante o desenvolvimento local:

```text
http://127.0.0.1:3000
```

Depois do deploy, usar o valor do output:

```text
ApiBaseUrl
```

Sugestão de configuração no frontend:

```js
const API_BASE_URL = 'http://127.0.0.1:3000';
```

Depois do deploy, trocar apenas o valor da URL.

### Login

```js
const response = await fetch(`${API_BASE_URL}/auth/login`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'eleitor@votacao.local',
    password: 'Voto@123'
  })
});

const data = await response.json();
sessionStorage.setItem('accessToken', data.accessToken);
```

### Listar candidatos

```js
const token = sessionStorage.getItem('accessToken');

const response = await fetch(
  `${API_BASE_URL}/api/v1/voting/candidatos`,
  {
    headers: {
      Authorization: `Bearer ${token}`
    }
  }
);

const data = await response.json();
console.log(data.candidatos);
```

### Registrar voto

```js
const token = sessionStorage.getItem('accessToken');

const response = await fetch(
  `${API_BASE_URL}/api/v1/voting/votar`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      candidato_id: 1
    })
  }
);

const data = await response.json();
```

### O que a Pessoa 1 deve entregar para integração

- arquivos do frontend;
- código usando as rotas listadas neste documento;
- configuração da URL da API em um único arquivo ou variável;
- instruções de hospedagem no S3;
- tela de erro para token inválido ou expirado;
- tela de confirmação quando a API responder com HTTP `202`.

### Atenção

O CORS atual permite qualquer origem para facilitar os testes. Na versão final, ele pode ser limitado ao endereço do site hospedado no S3.

---

## 5. Integração da Pessoa 3 — Amazon SQS, worker e tolerância a falhas

A fila principal já foi criada. A Pessoa 3 não deve criar outra fila de votos com a mesma finalidade.

### Fila existente

```yaml
VoteQueue
```

O worker deve consumir mensagens dessa fila.

### Arquivo recomendado

```text
aws/lambdas/worker.js
```

### Estrutura mínima do worker

```js
'use strict';

exports.handler = async (event) => {
  for (const record of event.Records) {
    const vote = JSON.parse(record.body);

    if (vote.type !== 'VOTE_SUBMITTED') {
      throw new Error('Tipo de evento não suportado.');
    }

    console.log('Voto recebido pelo worker:', vote);

    // A gravação no DynamoDB será integrada aqui.
  }
};
```

### Recurso a adicionar no `template.yaml`

```yaml
VoteWorkerFunction:
  Type: AWS::Serverless::Function
  Properties:
    FunctionName: g1-voting-worker
    CodeUri: .
    Handler: lambdas/worker.handler
    Description: Consome votos da fila SQS e encaminha para persistência.
    Timeout: 15
    Events:
      VoteQueueEvent:
        Type: SQS
        Properties:
          Queue: !GetAtt VoteQueue.Arn
          BatchSize: 10
```

Quando a tabela da Pessoa 4 estiver definida, devem ser adicionados ao worker:

- variável com o nome da tabela;
- permissão de escrita no DynamoDB;
- código de persistência.

### Tolerância a falhas

A opção simples recomendada é adicionar uma fila de mensagens com falha, chamada DLQ.

Exemplo:

```yaml
VoteDeadLetterQueue:
  Type: AWS::SQS::Queue
  Properties:
    QueueName: g1-voting-votes-dlq
    MessageRetentionPeriod: 1209600
    SqsManagedSseEnabled: true
```

Depois, incluir na `VoteQueue`:

```yaml
RedrivePolicy:
  deadLetterTargetArn: !GetAtt VoteDeadLetterQueue.Arn
  maxReceiveCount: 3
```

### Regras do worker

- processar todos os registros presentes em `event.Records`;
- usar `JSON.parse(record.body)`;
- lançar erro quando não conseguir processar a mensagem;
- não remover mensagens manualmente;
- usar `eventId` como identificador único da operação;
- não alterar os nomes dos campos recebidos;
- não confiar em um `eleitor_id` vindo de outra origem.

### Teste local isolado do worker

A API local usa `LOCAL_DEMO_MODE=true`, portanto ela simula o envio e não utiliza uma fila real.

Para testar o worker localmente, criar:

```text
aws/events/sqs-vote.json
```

Com o conteúdo:

```json
{
  "Records": [
    {
      "messageId": "mensagem-teste-001",
      "body": "{\"eventId\":\"evento-teste-001\",\"type\":\"VOTE_SUBMITTED\",\"candidato_id\":1,\"eleitor_id\":\"usr-eleitor-001\",\"role\":\"VOTER\",\"request_id\":\"req-teste-001\",\"created_at\":\"2026-08-02T00:00:00.000Z\"}"
    }
  ]
}
```

Depois executar:

```powershell
sam build
sam local invoke VoteWorkerFunction -e events/sqs-vote.json --env-vars env.local.json
```

O fluxo completo API → SQS → Worker será validado depois do deploy de integração.

---

## 6. Integração da Pessoa 4 — DynamoDB, infraestrutura, testes e monitoramento

A Pessoa 4 deve adicionar o DynamoDB no mesmo `aws/template.yaml`.

### Modelo simples recomendado

Criar uma tabela de votos na qual `event_id` seja a chave primária. Isso permite identificar o evento processado e evita que a mesma mensagem seja gravada duas vezes.

Exemplo:

```yaml
VotesTable:
  Type: AWS::DynamoDB::Table
  Properties:
    TableName: g1-voting-votes
    BillingMode: PAY_PER_REQUEST
    AttributeDefinitions:
      - AttributeName: event_id
        AttributeType: S
    KeySchema:
      - AttributeName: event_id
        KeyType: HASH
    SSESpecification:
      SSEEnabled: true
```

### Integração com o worker

Adicionar ao `VoteWorkerFunction`:

```yaml
Environment:
  Variables:
    VOTES_TABLE_NAME: !Ref VotesTable
Policies:
  - DynamoDBCrudPolicy:
      TableName: !Ref VotesTable
```

O item gravado pode seguir este formato:

```json
{
  "event_id": "evento-teste-001",
  "candidato_id": 1,
  "eleitor_id": "usr-eleitor-001",
  "created_at": "2026-08-02T00:00:00.000Z",
  "request_id": "req-teste-001"
}
```

### Regra para evitar duplicidade

O worker deve usar uma escrita condicional, recusando a gravação quando `event_id` já existir.

A duplicidade deve ser tratada como voto já processado, e não como um novo voto.

### Integração da lista de candidatos

A função atual está em:

```text
aws/lambdas/candidates.js
```

Ela usa dados fixos. A Pessoa 4 pode:

1. manter a lista fixa para a demonstração; ou
2. criar uma tabela de candidatos e alterar essa função para consultar o DynamoDB.

Ao trocar a fonte, manter o contrato descrito na seção 3.4.

### Monitoramento mínimo

Usar os logs automáticos do CloudWatch para verificar:

- logins realizados;
- tokens negados;
- votos enviados para a fila;
- mensagens processadas pelo worker;
- erros de gravação no DynamoDB;
- quantidade de mensagens na DLQ.

Não é necessário criar uma estrutura de monitoramento complexa. Para o projeto, logs das Lambdas e uma DLQ já demonstram o tratamento básico de falhas.

### Testes esperados

- gravação de um voto válido;
- rejeição de mensagem malformada;
- tentativa de processar o mesmo `eventId` duas vezes;
- falha temporária no banco e nova tentativa pela fila;
- envio para a DLQ após exceder as tentativas;
- consulta da lista de candidatos, caso seja migrada para o banco.

---

## 7. Ordem recomendada para integrar

### Etapa 1 — Manter a versão atual funcionando

Executar:

```powershell
cd aws
$env:AWS_DEFAULT_REGION = 'sa-east-1'
sam validate
sam build
sam local start-api --env-vars env.local.json
```

Testar:

```text
GET http://127.0.0.1:3000/health
```

### Etapa 2 — Pessoa 4 adiciona a tabela

Primeiro deve ser definido o nome lógico da tabela no template:

```text
VotesTable
```

### Etapa 3 — Pessoa 3 adiciona o worker

O worker passa a usar:

```text
VoteQueue
VotesTable
```

### Etapa 4 — Pessoa 1 integra o frontend

O frontend pode ser desenvolvido localmente antes do deploy, usando:

```text
http://127.0.0.1:3000
```

### Etapa 5 — Fazer merge e testar

Depois que as três partes estiverem no mesmo projeto:

```powershell
sam validate
sam build
npm test
```

### Etapa 6 — Fazer o deploy conjunto

Somente depois de o código estar integrado e revisado:

```powershell
sam deploy --guided
```

---

## 8. Organização recomendada do projeto

```text
G1-APIGateway-AWS-implementado/
├── frontend/                         # Pessoa 1
│   ├── index.html
│   ├── app.js
│   └── styles.css
│
├── aws/
│   ├── template.yaml                # Arquivo central de infraestrutura
│   ├── env.local.json
│   ├── events/
│   │   └── sqs-vote.json
│   ├── lambdas/
│   │   ├── login.js                 # Pessoa 2
│   │   ├── authorizer.js            # Pessoa 2
│   │   ├── validate.js              # Pessoa 2
│   │   ├── candidates.js            # Pessoa 2 / Pessoa 4
│   │   ├── vote.js                  # Pessoa 2
│   │   ├── worker.js                # Pessoa 3
│   │   └── common/
│   └── test/
│
├── README.md
└── README_INTEGRACAO.md
```

---

## 9. Organização no GitHub

Sugestão de branches:

```text
feature/frontend-s3
feature/sqs-worker
feature/dynamodb-infra
```

Antes de começar uma alteração:

```powershell
git checkout main
git pull origin main
git checkout -b feature/nome-da-parte
```

Depois de concluir:

```powershell
git add .
git commit -m "Integra parte X ao projeto AWS"
git push -u origin feature/nome-da-parte
```

Cada integrante deve abrir um Pull Request e avisar quais arquivos foram alterados.

### Não enviar para o GitHub

- chaves da AWS;
- `AWS Access Key ID`;
- `AWS Secret Access Key`;
- segredo real do JWT;
- conteúdo de `.aws-sam/`;
- arquivos `.env` com informações privadas;
- `samconfig.toml` caso contenha o segredo JWT em `parameter_overrides`.

---

## 10. Arquivos que exigem cuidado

### `aws/template.yaml`

Todos podem precisar alterá-lo. Antes de editar, executar `git pull` e verificar se outro integrante também está trabalhando nele.

### `aws/lambdas/vote.js`

Já define o contrato enviado à fila. A Pessoa 3 deve adaptar o worker ao contrato, em vez de modificar a Lambda de voto sem necessidade.

### `aws/lambdas/authorizer.js`

Não alterar os nomes enviados em `context`, pois as outras funções usam esses dados.

### `aws/lambdas/common/jwt.js`

Não alterar a geração e validação do JWT durante a integração, salvo correção discutida com o grupo.

### `aws/env.local.json`

Quando novas Lambdas precisarem de variáveis locais, adicionar uma seção usando o identificador lógico do template.

Exemplo:

```json
{
  "VoteWorkerFunction": {
    "VOTES_TABLE_NAME": "g1-voting-votes-local"
  }
}
```

---

## 11. Checklist antes do deploy

- [ ] `sam validate` concluído sem erros.
- [ ] `sam build` concluído com `Build Succeeded`.
- [ ] `npm test` concluído sem falhas.
- [ ] Login gera um JWT.
- [ ] Token válido acessa as rotas protegidas.
- [ ] Token ausente ou inválido é rejeitado.
- [ ] Frontend envia somente `candidato_id` ao votar.
- [ ] Lambda de voto envia o contrato correto ao SQS.
- [ ] Worker consome a `VoteQueue` existente.
- [ ] Worker grava no DynamoDB.
- [ ] `eventId` impede processamento duplicado.
- [ ] Mensagens com falha chegam à DLQ.
- [ ] Lista de candidatos mantém o contrato esperado pelo frontend.
- [ ] Nenhum segredo foi enviado para o GitHub.
- [ ] O grupo definiu uma única região AWS.
- [ ] O grupo definiu um único nome de stack.

---

## 12. Responsabilidades resumidas

| Integrante | Integração esperada |
|---|---|
| Pessoa 1 | Consumir as rotas, armazenar o JWT durante a sessão e hospedar o frontend no S3 |
| Pessoa 2 | Manter API Gateway, login, JWT, authorizer, Lambdas da API e contrato da mensagem de voto |
| Pessoa 3 | Conectar um worker à `VoteQueue`, implementar repetição e DLQ |
| Pessoa 4 | Criar DynamoDB, integrar persistência, testes e monitoramento |

O objetivo é que cada parte seja adicionada à estrutura existente sem reimplementar componentes que já estão prontos.
