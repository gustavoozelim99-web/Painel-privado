/**
 * Fala com o repositório pela API do GitHub.
 * O banco do painel são os arquivos em dados/ — este módulo é a única porta
 * até eles em produção. Arquivo com _ na frente não vira rota.
 *
 * Variáveis de ambiente exigidas (ficam no painel do Cloudflare, NUNCA aqui):
 *   GH_TOKEN   token de acesso fino, só com permissão de Conteúdo: leitura e escrita
 *   GH_REPO    "usuario/painel"
 *   GH_BRANCH  "main"
 */

const API = "https://api.github.com";

const paraB64 = s => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
};

const deB64 = s => {
  const bin = atob(String(s).replace(/\s/g, ""));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const cabecalhos = env => ({
  "authorization": `Bearer ${env.GH_TOKEN}`,
  "accept": "application/vnd.github+json",
  "user-agent": "painel-do-brain",
  "x-github-api-version": "2022-11-28"
});

export async function lerArquivo(env, nome){
  const r = await fetch(`${API}/repos/${env.GH_REPO}/contents/dados/${nome}.json?ref=${env.GH_BRANCH || "main"}`, {
    headers: cabecalhos(env),
    cf: {cacheTtl: 0}
  });
  if(!r.ok) throw new Error(`não consegui ler ${nome}.json (${r.status})`);
  const j = await r.json();
  return {dados: JSON.parse(deB64(j.content)), sha: j.sha};
}

export async function gravarArquivo(env, nome, obj, sha, mensagem){
  const r = await fetch(`${API}/repos/${env.GH_REPO}/contents/dados/${nome}.json`, {
    method: "PUT",
    headers: {...cabecalhos(env), "content-type": "application/json"},
    body: JSON.stringify({
      message: mensagem,
      content: paraB64(JSON.stringify(obj, null, 2) + "\n"),
      sha,
      branch: env.GH_BRANCH || "main"
    })
  });
  if(!r.ok) throw new Error(`não consegui gravar ${nome}.json (${r.status})`);
  return r.json();
}

export const GRUPOS = {
  financas: ["cartoes", "gastos", "entradas", "dividas"],
  dia:      ["habitos", "tarefas", "notas"],
  treino:   ["cargas", "sessoes"],
  estudo:   ["entregas"],
  negocios: ["funil", "pedidos", "receitaVanetto", "vanettoSessoes"],
  metas:    ["objetivos"]
};

export const json = (obj, code = 200) => new Response(JSON.stringify(obj), {
  status: code,
  headers: {"content-type": "application/json; charset=utf-8", "cache-control": "no-store"}
});

/**
 * A versão é a impressão digital dos arquivos de dados — as assinaturas que
 * o GitHub dá a cada arquivo, juntas. Muda se a tela gravar E muda se eu
 * mexer nos arquivos por fora; é o mesmo papel que a data de modificação
 * faz no servidor local. Para o cliente é texto opaco: ele só devolve.
 * Uma chamada só, listando a pasta.
 */
export async function versaoAtual(env){
  const r = await fetch(`${API}/repos/${env.GH_REPO}/contents/dados?ref=${env.GH_BRANCH || "main"}`, {
    headers: cabecalhos(env)
  });
  if(!r.ok) throw new Error(`não consegui listar dados/ (${r.status})`);
  const lista = await r.json();
  return lista
    .filter(x => x.name.endsWith(".json"))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(x => String(x.sha).slice(0, 8))
    .join(".");
}

export async function tudo(env){
  const estado = await lerArquivo(env, "_estado");
  const saida = {versao: await versaoAtual(env), focoDoDia: estado.dados.focoDoDia};
  for(const g of Object.keys(GRUPOS)){
    Object.assign(saida, (await lerArquivo(env, g)).dados);
  }
  return saida;
}
