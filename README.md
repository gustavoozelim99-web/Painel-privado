# Painel — Gustavo

Site privado de uso pessoal. Substitui o Notion como interface do brain.

O desenho e as regras estão em `brain/painel-design-brief.md`.
A spec da fase 2 está em `brain/painel-spec.md`.

## Como está montado

```
index.html                     a interface inteira, um arquivo só
dados/*.json                   o banco — é isto que o Claude lê e escreve
server.js                      servidor local, só pra desenvolver
functions/api/dados/           o mesmo papel, em produção (Cloudflare)
```

**O banco são os arquivos em `dados/`.** Não tem serviço de banco, não tem
conta em lugar nenhum: é JSON versionado no git. Quem mexe:

- **o Claude**, direto no disco, nas nossas conversas
- **a tela**, pela API

Os dois enxergam a mesma coisa. É esse o ponto do desenho.

## A única porta: o módulo `store`

Dentro do `index.html`, nenhuma tela lê arquivo nem chama API. Todas falam
com `store`, que tem seis funções: `all`, `add`, `update`, `remove`, `on`,
`iniciar`. Trocar o que guarda os dados não obriga a mexer em tela nenhuma
— foi assim que ele saiu do navegador e foi pros arquivos.

O `store` grava na tela **na hora** e manda pro arquivo logo atrás, então
marcar um hábito nunca fica esperando rede.

## O contrato, igual nos dois lados

```
GET  /api/dados          -> { versao, focoDoDia, ...todas as coleções }
PUT  /api/dados/:grupo   -> { versao, dados } -> 200 { versao }
                                               -> 409 { versao, ...tudo }
```

`versao` é um texto opaco: o cliente devolve o mesmo que recebeu. No
servidor local ela é a data da última mexida nos arquivos; em produção, as
assinaturas que o GitHub dá a eles. Nos dois casos ela muda **também**
quando o Claude edita um arquivo por fora — é isso que faz a página aberta
no celular perceber sozinha.

O 409 é o caso "mexeram nos arquivos com a página aberta": o servidor
devolve o estado atual, a tela junta com o que você acabou de fazer e
reenvia. Já está tratado.

## Rodar na máquina

```
node server.js
```
Abre em <http://localhost:4310>. Sem dependência nenhuma, só o Node.

## Publicar (Cloudflare Pages)

Decidido em 16/08/2026: Cloudflare, não Vercel — no plano grátis da Vercel
o domínio de produção fica público, e aqui vai dado real.

1. Repositório **privado** `painel` no GitHub
2. Cloudflare Pages → Connect to Git → este repositório
3. Sem build. Output directory: `/`
4. Variáveis de ambiente (Settings → Environment variables):
   - `GH_TOKEN` — token fino do GitHub, só Contents: read and write, só neste repo
   - `GH_REPO` — `usuario/painel`
   - `GH_BRANCH` — `main`
5. Zero Trust → Access → Add application → Self-hosted → login por PIN no e-mail

**Nunca** commitar token aqui. Ele vive só na variável de ambiente.

## O que ainda não está feito

- As funções do Cloudflare (`functions/`) foram escritas mas **nunca
  rodaram** — só dá pra testar depois do primeiro deploy.
- Login: nada ligado ainda. Enquanto não estiver, não entra dado real.
- O `SEED` dentro do `index.html` é a cópia de emergência, usada quando não
  há servidor (por exemplo no link do artifact). Os arquivos em `dados/`
  é que mandam.
