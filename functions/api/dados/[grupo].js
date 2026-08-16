import { lerArquivo, gravarArquivo, tudo, versaoAtual, GRUPOS, json } from "../../_gh.js";

/**
 * PUT /api/dados/:grupo
 * corpo: { versao, dados: { colecao: [...] }, focoDoDia? }
 *
 * Devolve 409 com o estado atual se a versão enviada estiver defasada —
 * é o caso de eu ter mexido nos arquivos enquanto a página estava aberta.
 * O cliente refaz e tenta de novo; ele sabe lidar.
 */
export async function onRequestPut({ request, env, params }) {
  const grupo = params.grupo;
  if (!GRUPOS[grupo]) return json({ erro: `grupo desconhecido: ${grupo}` }, 404);

  try {
    const corpo = await request.json();

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
  } catch (e) {
    return json({ erro: e.message }, 502);
  }
}
