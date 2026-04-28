---
trigger: always_on
---

# Regra de Interação com o Banco de Dados (Parse / Back4App)

Ao gerar ou modificar código que interage com o banco de dados Parse, siga estritamente a estrutura das tabelas (Classes) e campos definidos abaixo.

## Estrutura das Tabelas (Classes)

### 1. `Item`
Representa um item físico no inventário.

| Campo (key)         | Tipo     | Descrição                                                              |
|---------------------|----------|------------------------------------------------------------------------|
| `nome_equipamento`  | `String` | **OBRIGATÓRIO**. Nome do ativo, sempre salvo em `UPPERCASE`.             |
| `quantidade`        | `Number` | **OBRIGATÓRIO**. Quantidade física disponível em estoque. Deve ser >= 0. |
| `modelo_detalhes`   | `String` | Modelo, cor, ou outra especificação do item.                           |
| `numero_serie`      | `String` | Número de série único do equipamento, se aplicável.                    |

### 2. `Emprestimo`
Representa o ato de um item ser emprestado.

| Campo (key)               | Tipo                | Descrição                                                                                             |
|---------------------------|---------------------|-------------------------------------------------------------------------------------------------------|
| `item`                    | `Pointer<Item>`     | **OBRIGATÓRIO**. Referência ao objeto da classe `Item` que foi emprestado.                            |
| `status_emprestimo`       | `String`            | **OBRIGATÓRIO**. Status atual. Valores comuns: `'Aberto'`, `'Fechado'`.                                |
| `quantidade_emprestada`   | `Number`            | Quantidade de unidades do item emprestadas nesta transação. Padrão é `1`.                             |
| `data_devolucao_prevista` | `Date`              | Data em que a devolução do item está agendada.                                                        |
| `nome_pessoa`             | `String`            | Nome da pessoa que pegou o item emprestado.                                                           |

### 3. `LogAuditoria`
Registra ações importantes. **Sempre crie um log para operações de CRUD em `Item` e `Emprestimo`**.

| Campo (key) | Tipo     | Descrição                                                              |
|-------------|----------|------------------------------------------------------------------------|
| `acao`      | `String` | Ação realizada, em `UPPERCASE`. Ex: `'CRIOU ITEM'`, `'EDITOU ITEM'`. |
| `item_nome` | `String` | Nome do item relacionado à ação.                                       |
| `detalhes`  | `String` | Descrição detalhada da mudança. Ex: `'Alterou quantidade de 5 para 3.'` |
| `tecnico`   | `String` | O `username` do `Parse.User.current()` que realizou a ação.            |

## Boas Práticas
- **Queries:** Use `.select()` para buscar apenas os campos necessários e `.limit()` para controlar a paginação.
- **Logs:** Seja verboso nos detalhes do `LogAuditoria`. É crucial para rastrear o histórico de um ativo.