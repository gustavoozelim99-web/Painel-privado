/**
 * O painel em produção.
 *
 * Arquivo estático que existir em public/ é servido pela Cloudflare sem
 * passar por aqui. Este código só é chamado no que sobra — na prática,
 * /api/*. O resto cai no ASSETS por segurança.
 *
 * Fala o MESMO contrato do server.js que roda na máquina:
 *   GET  /api/dados          -> { versao, focoDoDia, ...coleções }
 *   PUT  /api/dados/:grupo   -> 200 { versao } | 409 { versao, ...tudo }
 */
import { lerArquivo, gravarArquivo, tudo, versaoAtual, GRUPOS, json } from "./gh.js";
import { noticias } from "./noticias.js";

const FALTA = ["GH_TOKEN", "GH_REPO"];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    /* notícias não dependem do GitHub — vêm dos jornais direto */
    if (url.pathname === "/api/noticias" && request.method === "GET") {
      try {
        const r = json(await noticias());
        r.headers.set("cache-control", "public, max-age=600");
        return r;
      } catch (e) {
        return json({ erro: e.message, itens: [] }, 502);
      }
    }

    const semConfig = FALTA.filter(k => !env[k]);
    if (semConfig.length) {
      return json({ erro: `falta configurar no Cloudflare: ${semConfig.join(", ")}` }, 500);
    }

    try {
      if (url.pathname === "/api/dados" && request.method === "GET") {
        return json(await tudo(env));
      }

      const m = url.pathname.match(/^\/api\/dados\/([a-zA-Z]+)$/);
      if (m && request.method === "PUT") return gravar(request, env, m[1]);

      return json({ erro: "rota não existe" }, 404);
    } catch (e) {
      return json({ erro: e.message }, 502);
    }
  }
};

async function gravar(request, env, grupo) {
  if (!GRUPOS[grupo]) return json({ erro: `grupo desconhecido: ${grupo}` }, 404);

  const corpo = await request.json();

  /* versão defasada = mexeram nos arquivos com a página aberta.
     Devolve o estado atual; o cliente junta com o que fez e reenvia. */
  if (String(corpo.versao) !== await versaoAtual(env)) {
    return json({ erro: "versao-defasada", ...(await tudo(env)) }, 409);
  }

  const atual = await lerArquivo(env, grupo);
  for (const col of GRUPOS[grupo]) {
    if (corpo.dados && Array.isArray(corpo.dados[col])) atual.dados[col] = corpo.dados[col];
  }
  await gravarArquivo(env, grupo, atual.dados, atual.sha, `painel: ${grupo} atualizado pela tela`);

  const estado = await lerArquivo(env, "_estado");
  estado.dados.atualizadoEm = new Date().toISOString();
  if (corpo.focoDoDia) estado.dados.focoDoDia = corpo.focoDoDia;
  await gravarArquivo(env, "_estado", estado.dados, estado.sha, "painel: carimbo de hora");

  return json({ versao: await versaoAtual(env) });
}
