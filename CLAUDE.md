# Painel — regras deste repositório

Interface pessoal do Gustavo. Substitui o Notion como painel; o banco são os
arquivos deste repo. A especificação de desenho e a de dados vivem no outro
repositório (`brain/painel-design-brief.md` e `brain/painel-spec.md`) —
**este arquivo é o que vale na hora de mexer no código.**

## Como está montado

```
public/index.html     a interface inteira, um arquivo só
dados/*.json          o banco
src/worker.js         a API em produção (Cloudflare)
src/gh.js             lê e escreve no repo pela API do GitHub
src/noticias.js       leitor de RSS, usado pelos dois lados
server.js             servidor local, só pra desenvolver
```

No ar: <https://painel-privado.gustavoozelim99.workers.dev>, protegido por
Cloudflare Access (só a conta Cloudflare dele entra).

## Comandos

- Rodar local: `node server.js` → <http://localhost:4310>
- Publicar código: `npx wrangler deploy`
- **Dado não precisa de deploy.** O Worker lê do GitHub na hora do pedido:
  editou `dados/*.json`, commitou e deu push, já está valendo.
- Conferir sintaxe do painel antes de publicar:
  extrair o `<script>` e rodar `node --check`. Ele é um arquivo só — erro de
  sintaxe derruba a página inteira.

## Regras que já custaram caro

1. **`git pull` ANTES de ler ou escrever em `dados/`.** O que ele marca no
   celular vira commit aqui. Escrever sem puxar apaga o que ele fez.
2. **Nunca editar arquivo com acento pelo PowerShell.** O PS 5.1 lê arquivo
   sem BOM como ANSI e destrói todo caractere acentuado no `Get-Content` ou
   em regex. Já corrompi o `index.html` inteiro assim (16/08) e tive que
   restaurar do git. Usar a ferramenta de edição, ou `[System.IO.File]` com
   encoding explícito nos dois lados.
3. **Nunca inventar número.** Todo dado aqui é a vida real dele. Se não
   souber, deixe vazio — o painel tem estado vazio pra isso, e vazio honesto
   vale mais que número inventado. Já errei feio nisso: pus receita de
   US$ 1.940 na Vanetto quando a receita real é zero.
4. **Antes de mexer em notícias, ler `brain/notion.md`.** Os 6 assuntos e as
   fontes foram escolhidos por ele e estão escritos lá, com a observação
   "não inventar outros". Eu ignorei uma vez e cortei política, que ele quer.
5. **O `GH_TOKEN` nunca entra neste repositório.** Vive só na variável de
   ambiente do Cloudflare.
6. **`dados/` fora de `public/`.** Se entrar, `/dados/financas.json` abre no
   navegador de quem tiver o link.

## A porta única: `store`

Nenhuma tela lê arquivo nem chama API. Todas falam com `store`:
`all` · `add` · `update` · `remove` · `on` · `iniciar` · `avulso`.

Trocar o que guarda os dados não deve obrigar a mexer em tela nenhuma — foi
assim que ele saiu do navegador e foi pros arquivos. **Se você precisar
furar essa porta, o desenho está errado.**

`store` grava na tela na hora e manda pro arquivo logo atrás: marcar hábito
nunca espera rede.

## Contrato da API, igual nos dois lados

```
GET  /api/dados          -> { versao, focoDoDia, analiseFinanceira, ...coleções }
PUT  /api/dados/:grupo   -> 200 { versao } | 409 { versao, ...tudo }
GET  /api/noticias       -> { grupos, falhas, semNoticiaBoa }
```

`versao` é texto opaco: o cliente devolve o que recebeu. Local é a data de
modificação dos arquivos; em produção, as assinaturas do GitHub. Muda também
quando o Claude edita por fora — é isso que faz a página aberta perceber.

O 409 é "mexeram nos arquivos com a página aberta": o cliente junta e
reenvia. Já está tratado, não reimplemente.

## Escrita e tom

Português do Brasil, informal, **sem exclamação e sem motivação vazia**.
Rótulo que rotula, botão que diz o que acontece, vazio que convida a agir,
erro que explica o que fazer. Ele tem TDAH: uma coisa em destaque, nunca dez.

## Desenho — decidido, não redecidir

Monocromático. Cor só para identidade de área e para estado.

| Área | Hex |
|---|---|
| pessoal | `#3E9E76` |
| acadêmico | `#5B8DEF` |
| vendas (Barns) | `#C97A2E` |
| loja (Vanetto) | `#A97BD6` |

Estado tem cor própria e reservada, nunca reutilizada como cor de área, e
sempre acompanhada de palavra ou forma. Hierarquia de raio: cartão 14px,
controle 8px, marca de dado 3px, pílula redonda só para estado.

**Ordem do dashboard ditada por ele — não reordenar sem ele pedir:**
briefing → o dia por horário → notícias → financeiro → objetivos → trilhas,
e depois gargalo, bloqueios e captura.

## Limites do ambiente

- O sandbox das rotinas de nuvem **bloqueia saída HTTP** para domínio de
  notícia (403 no proxy). RSS funciona no Cloudflare e não em rotina.
- A API está atrás do Access: não dá pra testar `/api/*` de fora sem login.
  Teste pelo `server.js` local.
- Na máquina dele o PowerShell bloqueia `npx`; ele precisa usar `npx.cmd`.
