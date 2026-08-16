# Painel — Gustavo

Site privado de uso pessoal. Substitui o Notion como interface do brain.

**Estado atual: fase 1.** Só interface. Um arquivo (`index.html`), sem
servidor, sem banco, sem chave. O que você marca ou cadastra fica salvo no
próprio navegador (`localStorage`) — some se limpar os dados do navegador,
e não vai de um aparelho pro outro. Isso é de propósito: dado de verdade é
a fase 2.

O desenho e as regras estão em `brain/painel-design-brief.md`.
A fase 2 (dados, escrita, login) está em `brain/painel-spec.md`.

## Por que este repositório existe separado do brain

O brain é o segundo cérebro inteiro — notas, finanças, clientes. Ele nunca
sobe pra máquina de build de ninguém. Aqui mora só o painel.

**Caminho único:** o painel mora AQUI, não no brain. Se você achar um
`painel-prototipo.html` no brain de novo, é cópia velha — apaga.

## Publicar

Nada pra rodar. É um arquivo estático: a Vercel serve `index.html` na raiz
sem nenhuma configuração.

1. Repositório **privado** no GitHub chamado `painel`
2. Na Vercel: *Add New → Project → Import* este repositório
3. Framework Preset: **Other**. Não mexer em build nem em output.
4. Deploy

A partir daí, todo push publica sozinho em ~30 segundos.

## Antes de entrar dado de verdade

O link da Vercel é **público por padrão**. Enquanto o conteúdo for exemplo,
tudo bem. Antes do primeiro dado real:

- ligar login (Vercel Authentication ou Cloudflare Access)
- nunca colocar token, senha ou chave neste repositório — vive em variável
  de ambiente do servidor
