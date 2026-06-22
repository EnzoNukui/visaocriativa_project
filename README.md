# Visão Criativa | Sistema de Gestão de Uniformes

Sistema web desenvolvido para gerenciar pedidos, produtos, lotes de produção, usuários, repasses financeiros e processos administrativos relacionados à venda e distribuição de uniformes escolares.

O projeto foi criado a partir de uma necessidade real: substituir controles manuais, planilhas e registros descentralizados por uma plataforma digital mais organizada, segura e eficiente.

## Acesse o projeto

🔗 **Deploy:** https://vision-uniform-flow.vercel.app/

---

## Índice

* [Sobre o projeto](#sobre-o-projeto)
* [Problema identificado](#problema-identificado)
* [Solução proposta](#solução-proposta)
* [Funcionalidades](#funcionalidades)
* [Perfis de acesso](#perfis-de-acesso)
* [Fluxo principal do sistema](#fluxo-principal-do-sistema)
* [Tecnologias utilizadas](#tecnologias-utilizadas)
* [Arquitetura do projeto](#arquitetura-do-projeto)
* [Estrutura de pastas](#estrutura-de-pastas)
* [Principais páginas](#principais-páginas)
* [Modelo de dados](#modelo-de-dados)
* [Regras de negócio principais](#regras-de-negócio-principais)
* [Importação de pedidos](#importação-de-pedidos)
* [Dashboard](#dashboard)
* [Autenticação e autorização](#autenticação-e-autorização)
* [Deploy](#deploy)
* [Aprendizados](#aprendizados)
* [Melhorias futuras](#melhorias-futuras)
* [Autor](#autor)

---

## Sobre o projeto

O **Visão Criativa** é uma aplicação web voltada para a gestão de uniformes escolares, permitindo que a administração tenha maior controle sobre pedidos, produtos, valores, fornecedores, lotes de produção e repasses.

A plataforma centraliza informações que normalmente seriam controladas de forma manual, facilitando a organização dos dados e reduzindo falhas no acompanhamento dos pedidos.

O sistema possui autenticação de usuários, controle de permissões, dashboard administrativo, cadastro de produtos, registro de pedidos, importação de planilhas, organização por lotes, acompanhamento de produção, controle de trocas e visualização de informações financeiras.

---

## Problema identificado

Antes da digitalização do processo, o controle de uniformes podia depender de planilhas, anotações manuais ou informações espalhadas entre diferentes pessoas.

Esse tipo de controle pode gerar problemas como:

* dificuldade para localizar pedidos;
* falhas na conferência de produtos e tamanhos;
* falta de clareza sobre o status de cada pedido;
* dificuldade para calcular valores de venda, custos e margens;
* retrabalho na comunicação com fornecedores;
* baixa rastreabilidade de lotes, trocas e repasses;
* risco de perda de informações importantes.

---

## Solução proposta

A solução desenvolvida busca organizar o processo em uma plataforma única, onde a administração consegue cadastrar produtos, controlar pedidos, acompanhar lotes, visualizar dados financeiros e disponibilizar informações específicas para fornecedores.

Com isso, o sistema torna o processo mais claro, padronizado e fácil de acompanhar, desde o cadastro do pedido até a produção, entrega e repasse financeiro.

---

## Funcionalidades

### Gestão de usuários

* Cadastro de usuários no sistema;
* autenticação com e-mail e senha;
* aprovação de novos usuários;
* rejeição, suspensão e reativação de contas;
* controle de permissões por perfil;
* suporte aos perfis de administrador e fornecedor.

### Gestão de produtos

* Cadastro de produtos;
* edição e exclusão de produtos;
* cadastro de tamanhos;
* definição de preço de venda;
* definição de custo do fornecedor;
* cálculo de margem por produto e tamanho.

### Gestão de pedidos

* Registro manual de pedidos;
* listagem de pedidos cadastrados;
* busca por aluno ou número do pedido;
* filtros por status e turma;
* ordenação de registros;
* visualização detalhada dos pedidos;
* alteração de status;
* exclusão de pedidos;
* controle de prazo de entrega;
* acompanhamento de repasse financeiro.

### Importação de planilhas

* Importação de arquivos `.xlsx` e `.csv`;
* leitura de abas específicas da planilha;
* agrupamento de pedidos por aluno;
* validação de produtos, tamanhos e quantidades;
* identificação de erros e avisos antes da importação;
* criação automática de lotes;
* cálculo automático de venda, custo e lucro;
* registro de histórico de importação.

### Gestão de lotes

* Organização de pedidos por lote;
* geração automática de número de lote;
* acompanhamento dos pedidos importados;
* visualização de totais por lote;
* controle de status em massa;
* exclusão de lotes;
* acompanhamento de datas previstas de entrega.

### Produção para fornecedor

* Visualização dos pedidos destinados à produção;
* acesso às informações necessárias para confecção dos uniformes;
* acompanhamento de trocas solicitadas;
* controle de itens por aluno, produto, tamanho e quantidade.

### Controle financeiro

* Cálculo de receita total;
* cálculo de custo com fornecedor;
* cálculo de lucro;
* controle de repasses pendentes;
* confirmação de repasses;
* acompanhamento de repasses complementares;
* visualização de lucro repassado e lucro pendente.

### Backups e relatórios

* Área administrativa para exportações;
* geração de registros administrativos;
* apoio ao controle histórico de dados;
* suporte à organização financeira e operacional.

---

## Perfis de acesso

O sistema trabalha com controle de acesso baseado em perfis.

| Perfil        | Descrição                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------- |
| Administrador | Responsável por gerenciar usuários, produtos, pedidos, lotes, repasses, backups e relatórios. |
| Fornecedor    | Responsável por visualizar pedidos e informações relacionadas à produção dos uniformes.       |

Usuários recém-cadastrados ficam com acesso pendente até a aprovação de um administrador autorizado.

---

## Fluxo principal do sistema

1. O usuário realiza o cadastro na plataforma.
2. O administrador analisa e aprova o acesso.
3. Após a aprovação, o usuário acessa o sistema conforme seu perfil.
4. O administrador cadastra produtos, tamanhos e valores.
5. Os pedidos podem ser cadastrados manualmente ou importados por planilha.
6. Os pedidos importados são organizados em lotes.
7. O sistema calcula valores de venda, custos e lucro.
8. O fornecedor acompanha os itens destinados à produção.
9. A administração acompanha status, prazos, trocas e repasses.
10. Os dados podem ser consultados em dashboards, tabelas e relatórios.

---

## Tecnologias utilizadas

### Front-end

* React
* TypeScript
* Vite
* Tailwind CSS
* React Router DOM
* TanStack React Query
* Radix UI
* Lucide React
* Recharts

### Back-end e banco de dados

* Supabase
* Supabase Auth
* PostgreSQL
* Row Level Security
* Migrations SQL

### Manipulação de dados

* XLSX
* date-fns
* Zod

### Qualidade e desenvolvimento

* ESLint
* Vitest
* Testing Library
* TypeScript ESLint

---

## Arquitetura do projeto

O projeto segue uma arquitetura baseada em front-end React integrado ao Supabase.

```text
Usuário
  ↓
Interface React + TypeScript
  ↓
Rotas protegidas e controle de sessão
  ↓
Hooks, contextos e componentes reutilizáveis
  ↓
Supabase Client
  ↓
Supabase Auth + Banco PostgreSQL
```

A aplicação utiliza componentes reutilizáveis, hooks personalizados e contexto de autenticação para controlar a sessão do usuário e suas permissões dentro do sistema.

O Supabase é responsável pela autenticação, armazenamento dos dados e regras de acesso ao banco.

---

## Estrutura de pastas

```bash
visaocriativa_project/
├── public/
├── src/
│   ├── components/
│   │   ├── ui/
│   │   ├── BatchCalendar.tsx
│   │   ├── ExchangeRequestModal.tsx
│   │   ├── ImportOrdersDialog.tsx
│   │   ├── Layout.tsx
│   │   ├── NavLink.tsx
│   │   ├── OrderDetailModal.tsx
│   │   └── SupplierComplementarWarning.tsx
│   ├── contexts/
│   │   └── AuthContext.tsx
│   ├── data/
│   ├── hooks/
│   ├── integrations/
│   │   └── supabase/
│   ├── lib/
│   ├── pages/
│   │   ├── Backups.tsx
│   │   ├── Batches.tsx
│   │   ├── Dashboard.tsx
│   │   ├── ForgotPassword.tsx
│   │   ├── Index.tsx
│   │   ├── Login.tsx
│   │   ├── NewOrder.tsx
│   │   ├── Orders.tsx
│   │   ├── Products.tsx
│   │   ├── ResetPassword.tsx
│   │   ├── SupplierProduction.tsx
│   │   └── Users.tsx
│   ├── test/
│   ├── types/
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── supabase/
│   ├── functions/
│   ├── migrations/
│   └── config.toml
├── components.json
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## Principais páginas

| Página               | Descrição                                                                      |
| -------------------- | ------------------------------------------------------------------------------ |
| Login                | Tela de autenticação e cadastro de usuários.                                   |
| Dashboard            | Painel com resumo de pedidos, receitas, custos, lucros, prazos e alertas.      |
| Produtos             | Área para cadastro, edição e exclusão de produtos, tamanhos e preços.          |
| Novo Pedido          | Tela para registro manual de pedidos.                                          |
| Pedidos              | Listagem, busca, filtros, controle de status, repasses e detalhes dos pedidos. |
| Lotes                | Organização de pedidos importados em lotes de produção.                        |
| Produção Fornecedor  | Visualização dos itens que precisam ser produzidos pelo fornecedor.            |
| Usuários             | Gerenciamento de aprovações, papéis, suspensões e reativações de usuários.     |
| Backups              | Área voltada à exportação, registros e apoio administrativo.                   |
| Recuperação de senha | Fluxo para solicitação e redefinição de senha.                                 |

---

## Modelo de dados

O banco de dados foi estruturado para representar os principais processos do sistema.

| Tabela                 | Finalidade                                              |
| ---------------------- | ------------------------------------------------------- |
| `profiles`             | Armazena informações dos usuários cadastrados.          |
| `user_roles`           | Controla os papéis de acesso dos usuários.              |
| `products`             | Armazena os produtos disponíveis no catálogo.           |
| `product_variants`     | Armazena tamanhos, preços e custos dos produtos.        |
| `orders`               | Registra os pedidos realizados.                         |
| `order_items`          | Armazena os itens pertencentes a cada pedido.           |
| `import_batches`       | Registra os lotes gerados a partir de importações.      |
| `import_logs`          | Mantém histórico das importações realizadas.            |
| `order_adjustments`    | Registra solicitações de troca e ajustes em pedidos.    |
| `repasse_complementar` | Controla ajustes financeiros complementares.            |
| `backup_history`       | Armazena registros de backups gerados.                  |
| `audit_log`            | Registra ações administrativas e alterações relevantes. |

---

## Regras de negócio principais

* Apenas usuários aprovados conseguem acessar o sistema.
* Usuários podem possuir perfil de administrador ou fornecedor.
* O administrador tem acesso às áreas de gestão.
* O fornecedor visualiza informações relacionadas à produção.
* Produtos possuem variações por tamanho.
* Cada variação pode ter preço de venda e custo de fornecedor.
* Pedidos podem ser criados manualmente ou por importação de planilha.
* Lotes agrupam pedidos importados.
* O sistema calcula automaticamente receita, custo e lucro.
* Pedidos cancelados não devem impactar os cálculos financeiros principais.
* Trocas podem gerar ajustes e repasses complementares.
* Repasses podem ser controlados individualmente ou por lote.

---

## Importação de pedidos

A importação de pedidos foi desenvolvida para facilitar o cadastro em massa a partir de planilhas.

O sistema realiza etapas como:

1. leitura do arquivo;
2. identificação das abas válidas;
3. validação dos produtos;
4. validação dos tamanhos;
5. validação das quantidades;
6. agrupamento dos itens por aluno;
7. cálculo dos totais de venda, custo e lucro;
8. geração de lote;
9. criação dos pedidos;
10. registro do histórico da importação.

Caso sejam encontrados erros ou avisos, o sistema apresenta essas informações antes da confirmação da importação.

---

## Dashboard

O dashboard apresenta uma visão geral do sistema, incluindo:

* total de pedidos;
* receita;
* custo do fornecedor;
* lucro total;
* lucro pendente;
* lucro repassado;
* pedidos pendentes;
* pedidos em produção;
* pedidos recentes;
* alertas de repasse complementar;
* avisos de trocas pendentes para fornecedores;
* datas previstas de entrega dos lotes.

Essa página funciona como ponto central para acompanhamento administrativo.

---

## Autenticação e autorização

A autenticação é realizada pelo Supabase Auth.

O sistema utiliza um contexto de autenticação para manter a sessão do usuário e controlar o acesso às páginas protegidas.

As rotas são protegidas de acordo com o perfil ativo do usuário:

* usuários não autenticados são redirecionados para a tela de login;
* usuários sem permissão administrativa não acessam áreas restritas;
* fornecedores acessam apenas as funcionalidades relacionadas ao seu perfil;
* contas pendentes, rejeitadas ou suspensas não conseguem acessar o sistema.

---

## Deploy

O projeto está publicado na Vercel e pode ser acessado pelo link abaixo:

🔗 **https://vision-uniform-flow.vercel.app/**

---

## Aprendizados

Durante o desenvolvimento deste projeto, foram aplicados conceitos importantes de desenvolvimento web, como:

* criação de interfaces com React;
* uso de TypeScript em aplicações front-end;
* organização de componentes reutilizáveis;
* criação de rotas protegidas;
* autenticação e controle de sessão;
* integração com Supabase;
* modelagem de dados relacionais;
* uso de hooks personalizados;
* consumo e manipulação de dados do banco;
* importação e processamento de planilhas;
* cálculo de valores financeiros;
* separação de responsabilidades no front-end;
* construção de uma solução baseada em um problema real.

---

## Melhorias futuras

Algumas melhorias que podem ser implementadas em versões futuras:

* melhorar a responsividade em dispositivos móveis;
* adicionar filtros mais avançados para pedidos e lotes;
* criar gráficos financeiros mais detalhados;
* implementar notificações para mudanças de status;
* melhorar a experiência do fornecedor;
* adicionar exportações mais completas;
* criar documentação técnica específica do banco de dados;
* ampliar os testes automatizados;
* implementar logs visuais para auditoria administrativa;
* melhorar a tela inicial e a experiência de onboarding.

---

## Considerações finais

O **Visão Criativa** representa uma solução prática para um problema administrativo real, aplicando tecnologia para tornar o processo de gestão de uniformes mais organizado, rastreável e eficiente.

Além de atender a uma necessidade operacional, o projeto também demonstra a aplicação de conceitos modernos de desenvolvimento web, integração com banco de dados, autenticação, permissões, manipulação de planilhas e organização de fluxos administrativos.

---

## Autor

Desenvolvido por **Enzo Nukui**.

Projeto criado com foco em aprendizado, organização de processos internos e desenvolvimento de uma aplicação web funcional baseada em uma necessidade real.
