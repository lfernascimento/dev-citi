# 🌿 API da Folhagem & Cia

## Visão geral

API REST que substitui a planilha da loja de plantas: cadastra e edita plantas, controla o estoque, registra vendas sem deixar o estoque ficar negativo e calcula o valor total em estoque.

**Stack:** Node.js · Express · TypeScript · Prisma · PostgreSQL · Docker

O código segue as camadas do CRUD de usuários:

```
Requisição → routes.ts → PlantaController → PlantaRepository → PostgreSQL
```

- `PlantaController` lê os dados, valida, decide o status HTTP e responde.
- `PlantaRepository` é a única camada que fala com o Prisma.

## Como rodar

Com o Docker Desktop aberto, na raiz do projeto:

```bash
cp .env.example .env          # no PowerShell: copy .env.example .env
yarn
docker compose up -d --build
yarn migration                # aplica as migrations (inclui create_planta_model)
yarn seed                     # opcional: cadastra plantas de exemplo
```

A API responde em `http://localhost:3001`. Detalhes e solução de problemas estão no [README](README.md).

## Modelo de dados

| Campo | Tipo | Regra |
|---|---|---|
| `id` | Int | Gerado pelo banco (autoincrement) |
| `nome` | String | Nome popular; texto não vazio |
| `especie` | String | Nome científico; texto não vazio |
| `preco` | Int | Em **centavos** (`8990` = R$ 89,90); inteiro de 1 a 2147483647 |
| `estoque` | Int | Vasos disponíveis; inteiro de 0 a 2147483647 (zero = esgotada) |
| `luminosidade` | Enum `Luminosidade` | `SOMBRA`, `MEIA_SOMBRA` ou `SOL_PLENO` |
| `petFriendly` | Boolean | `true` ou `false` (JSON, sem aspas) |
| `regaACadaDias` | Int | Inteiro de 1 a 2147483647 |
| `createdAt` / `updatedAt` | DateTime | Preenchidos automaticamente |

## Rotas

Exemplo de planta nas respostas:

```json
{
  "id": 1,
  "nome": "Costela-de-adão",
  "especie": "Monstera deliciosa",
  "preco": 8990,
  "estoque": 12,
  "luminosidade": "MEIA_SOMBRA",
  "petFriendly": false,
  "regaACadaDias": 3,
  "createdAt": "2026-10-27T23:10:00.000Z",
  "updatedAt": "2026-10-27T23:10:00.000Z"
}
```

### `POST /plantas` — cadastra uma planta

Todos os campos, menos `id`, `createdAt` e `updatedAt`, são obrigatórios.

```json
{
  "nome": "Costela-de-adão",
  "especie": "Monstera deliciosa",
  "preco": 8990,
  "estoque": 12,
  "luminosidade": "MEIA_SOMBRA",
  "petFriendly": false,
  "regaACadaDias": 3
}
```

Sucesso: `201` com a planta criada.

### `GET /plantas` — lista as plantas

Filtros opcionais, sozinhos ou combinados:

| Parâmetro | Valores aceitos | Efeito |
|---|---|---|
| `luminosidade` | `SOMBRA`, `MEIA_SOMBRA`, `SOL_PLENO` | Só plantas dessa luminosidade |
| `petFriendly` | `true` ou `false` | Só plantas seguras (ou não) para pets |
| `nome` *(bônus)* | qualquer texto | Nome que contém o texto, sem diferenciar maiúsculas |
| `ordem` *(bônus)* | `preco` ou `nome` | Ordem crescente; sem `ordem`, vem por `id` |

Exemplo: `GET /plantas?luminosidade=SOMBRA&petFriendly=true&ordem=preco`

Sucesso: `200` com uma lista. Um filtro válido sem resultado devolve `200` com `[]`, nunca `404`.

### `GET /plantas/esgotadas` *(bônus)* — plantas com estoque zero

Sucesso: `200` com uma lista (`[]` se não houver nenhuma).

### `GET /plantas/estoque/valor-total` — valor do estoque

Soma `preco × estoque` de todas as plantas e o total de vasos.

```json
{ "valorTotalEmCentavos": 154300, "totalDeVasos": 37 }
```

Sucesso: `200`. Com a loja vazia, devolve os dois valores zerados.

### `GET /plantas/:id` — busca uma planta

Sucesso: `200` com a planta.

### `PATCH /plantas/:id` — edita só os campos enviados

```json
{ "preco": 9990 }
```

Os campos enviados passam pelas mesmas regras do cadastro; os demais não mudam. Campos que não pertencem à planta (como `id`) são ignorados. Um corpo vazio `{}` não altera nada e devolve `200` com a planta como está.

Sucesso: `200` com a planta atualizada.

### `DELETE /plantas/:id` — remove uma planta

Sucesso: `204`, sem corpo.

### `POST /plantas/:id/venda` — registra uma venda

```json
{ "quantidade": 2 }
```

Sucesso: `200` com a planta já com o estoque reduzido.

## Erros e status HTTP

Toda resposta de erro tem o formato `{ "message": "..." }`.

| Status | Quando acontece |
|---|---|
| `400` | `id` que não é inteiro maior que zero (`abc`, `0`, `-1`, `1.5`) |
| `400` | Campo obrigatório ausente no cadastro |
| `400` | Valor inválido no cadastro, na edição ou na venda: texto vazio, número que não é inteiro, `preco` ≤ 0, `estoque` negativo, `regaACadaDias` < 1, `luminosidade` fora do enum, `petFriendly` que não é booleano, número acima de 2147483647, tipo errado (`"preco": "8990"`) |
| `400` | Filtro inválido: `luminosidade` fora do enum, `petFriendly` diferente de `true`/`false`, `ordem` diferente de `preco`/`nome`, parâmetro repetido na URL |
| `400` | Venda com `quantidade` que não é inteiro maior que zero, ou maior que o estoque (o estoque não é alterado) |
| `404` | `id` válido que não existe (busca, edição, remoção e venda) |
| `404` | Rota que não existe |
| `500` | Erro inesperado do servidor; os detalhes ficam nos logs (`docker compose logs -f server`) |

Quando mais de um campo está inválido, a mensagem aponta o primeiro problema encontrado.

## Decisões e bônus

**Bônus implementados:** busca por nome sem diferenciar maiúsculas (`?nome=`), ordenação (`?ordem=`), rota `GET /plantas/esgotadas` e script de seed (`yarn seed`).

**Duas vendas simultâneas do último vaso.** O controller confere o estoque para dar uma mensagem clara, mas isso sozinho não basta: duas requisições poderiam passar pela conferência ao mesmo tempo e deixar o estoque negativo. Por isso a subtração é feita numa única instrução no banco, que só altera a planta se `estoque >= quantidade` (`updateMany` com `where: { estoque: { gte: quantidade } }` e `decrement`). O PostgreSQL executa as duas atualizações em sequência: a primeira vence e a segunda não encontra estoque (`count = 0`) e recebe `400`, sem alterar nada.

**Outras decisões:**

- `nome` e `especie` são gravados sem espaços nas pontas (`trim`).
- Números acima de 2147483647 (limite do `INTEGER` do PostgreSQL) retornam `400`; sem isso o Prisma lançaria erro e a API responderia `500` por um erro do cliente.
- `id` na URL aceita só dígitos: `1e3` e `1.0` são recusados com `400`.
- O `PATCH` busca a planta antes de editar, para devolver `404` em vez de deixar o erro do Prisma virar `500`.
- Sem `ordem`, a listagem vem ordenada por `id`, para a resposta ser previsível.
