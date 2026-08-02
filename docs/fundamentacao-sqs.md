# Fundamentação Científica — SQS, Workers e Tolerância a Falhas

> Parte da documentação referente ao componente **Amazon SQS + Worker +
> Tolerância a Falhas**, mapeado ao Slide 6 ("Fundamentação Científica") do
> modelo de apresentação da disciplina.

## 1. Problema que motiva esta parte da arquitetura

Em um sistema de votação eletrônica com picos de tráfego, gravar cada voto
de forma síncrona (o cliente espera o backend confirmar a escrita no banco
antes de responder) cria um gargalo: se muitos eleitores votarem ao mesmo
tempo, o backend pode ficar sobrecarregado, aumentar a latência de resposta
ou até derrubar o serviço. O desafio central é: **como aceitar um grande
volume de votos rapidamente, sem perder nenhum e sem travar o sistema.**

## 2. Conceito central: comunicação indireta via fila de mensagens

A solução adotada segue o padrão de **comunicação indireta** (indirect
communication), descrito por Coulouris, Dollimore, Kindberg e Blair em
*Distributed Systems: Concepts and Design* como uma alternativa à
comunicação direta cliente-servidor. Em vez do produtor (quem gera o voto)
falar diretamente com o consumidor (quem processa o voto), um intermediário
— a fila — fica entre os dois.

Isso proporciona dois tipos de **desacoplamento**, também discutidos por
Tanenbaum e Van Steen em *Distributed Systems: Principles and Paradigms*:

- **Desacoplamento espacial (de referência):** o produtor não precisa
  conhecer o endereço, a identidade ou a quantidade de consumidores.
- **Desacoplamento temporal (de sincronização):** o produtor não precisa
  que o consumidor esteja ativo no momento do envio; a mensagem espera na
  fila até ser processada.

Esse padrão também aparece na literatura de arquitetura de software como
**Enterprise Integration Patterns** (Hohpe & Woolf), que descreve o
*Message Queue* como mecanismo para obter escalabilidade e resiliência ao
separar a etapa de recepção da etapa de processamento de uma requisição.

## 3. Amazon SQS: o que ele garante (e o que ele não garante)

O Amazon SQS é um serviço gerenciado de fila de mensagens. Duas
características do seu modelo de entrega guiam as decisões de projeto do
worker:

- **Entrega "at-least-once" (pelo menos uma vez):** o SQS garante que toda
  mensagem publicada será entregue a algum consumidor pelo menos uma vez,
  mas em cenários de falha de rede ou timeout ela pode ser entregue **mais
  de uma vez**. Isso é uma escolha de projeto do próprio SQS em favor da
  disponibilidade — coerente com o Teorema CAP (Brewer), que descreve o
  trade-off entre consistência forte e disponibilidade em sistemas
  distribuídos.
- **Visibility Timeout:** quando um consumidor recebe uma mensagem, ela
  fica temporariamente invisível para os demais consumidores por um
  período configurável. Se o consumidor não confirmar o processamento
  dentro desse período (por exemplo, porque caiu), a mensagem volta a
  ficar visível e é entregue novamente — um mecanismo de detecção de falha
  por *timeout*, um dos padrões clássicos discutidos por Kurose & Ross em
  *Computer Networking: A Top-Down Approach* para lidar com perda ou
  atraso de mensagens em redes não confiáveis.

Como consequência direta da entrega "at-least-once", o worker **precisa**
ser idempotente: processar a mesma mensagem duas vezes não pode gerar dois
votos.

## 4. Idempotência

Idempotência é a propriedade de uma operação poder ser aplicada múltiplas
vezes sem alterar o resultado além da primeira aplicação — um requisito
comum em sistemas que assumem falhas e reentregas de mensagens (RFC 7231
define esse conceito para o contexto de métodos HTTP, mas o princípio é o
mesmo aplicado aqui a mensagens de fila).

Na implementação, a idempotência é garantida gravando o `eventId` de cada
voto em uma tabela do DynamoDB com uma escrita condicional
(`ConditionExpression: attribute_not_exists(eventId)`), **antes** de
incrementar a contagem de votos. Se o mesmo `eventId` chegar de novo (por
uma reentrega do SQS), a escrita condicional falha e o worker sabe que deve
ignorar aquela mensagem, sem contar o voto de novo.

## 5. Tolerância a falhas: retries e Dead-Letter Queue (DLQ)

Falhas em sistemas distribuídos são a regra, não a exceção — premissa
central da disciplina, discutida no encontro sobre "Tolerância a Falhas e
Consenso" do cronograma. Duas falhas diferentes exigem tratamentos
diferentes:

- **Falhas transitórias** (ex: o DynamoDB fica momentaneamente
  indisponível): o ideal é tentar de novo depois de um tempo. É exatamente
  o que o *Visibility Timeout* + as tentativas automáticas do SQS
  proporcionam.
- **Falhas permanentes / "poison pill"** (ex: uma mensagem malformada, que
  nunca vai processar com sucesso não importa quantas vezes seja
  tentada): reprocessar para sempre desperdiça recursos e pode travar o
  processamento das mensagens boas atrás dela na fila.

A **Dead-Letter Queue (DLQ)** resolve o segundo caso: depois de um número
máximo de tentativas (`maxReceiveCount`), a mensagem é automaticamente
movida para uma fila separada, disponível para inspeção manual, sem
bloquear o fluxo principal. Esse padrão é equivalente, em espírito, aos
mecanismos de *fail-fast* e isolamento de falhas discutidos em arquiteturas
tolerantes a falhas (ex: o padrão *Circuit Breaker* de Nygard, em
*Release It!*), aplicado aqui no nível de mensageria em vez de chamadas de
rede síncronas.

Além disso, como o Lambda processa mensagens em lote (*batch*), o worker
usa o recurso `ReportBatchItemFailures` do Lambda para reportar
**individualmente** apenas as mensagens que falharam, em vez de falhar o
lote inteiro — evitando que uma única mensagem problemática force o
reprocessamento de mensagens que já tinham sido computadas com sucesso.

## 6. Relação com os conceitos vistos na disciplina

| Conceito da disciplina (cronograma) | Onde aparece nesta parte |
|---|---|
| Paradigmas de Interação / filas de mensagens (Encontro 04) | Uso do Amazon SQS como comunicação indireta produtor-consumidor |
| Tolerância a Falhas (Encontro 08) | Visibility Timeout, retries automáticos e Dead-Letter Queue |
| Consistência e Replicação / Teorema CAP (Encontro 07) | Entrega "at-least-once" do SQS como escolha de disponibilidade sobre consistência forte |

## 7. Referências

- COULOURIS, G.; DOLLIMORE, J.; KINDBERG, T.; BLAIR, G. **Distributed
  Systems: Concepts and Design**. 5th ed. Addison-Wesley, 2011.
- TANENBAUM, A. S.; VAN STEEN, M. **Distributed Systems: Principles and
  Paradigms**. 2nd ed. Pearson, 2007.
- KUROSE, J. F.; ROSS, K. W. **Computer Networking: A Top-Down Approach**.
  8th ed. Pearson, 2020.
- HOHPE, G.; WOOLF, B. **Enterprise Integration Patterns: Designing,
  Building, and Deploying Messaging Solutions**. Addison-Wesley, 2003.
- NYGARD, M. T. **Release It!: Design and Deploy Production-Ready
  Software**. 2nd ed. Pragmatic Bookshelf, 2018.
- BREWER, E. A. Towards Robust Distributed Systems (CAP Theorem,
  keynote). *PODC*, 2000.
- Amazon Web Services. **Amazon SQS Developer Guide** — seções sobre
  *Visibility Timeout* e *Dead-Letter Queues*. Documentação oficial da AWS.
