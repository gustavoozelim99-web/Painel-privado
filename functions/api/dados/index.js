import { tudo, json } from "../../_gh.js";

/** GET /api/dados — devolve tudo que o painel precisa numa chamada só. */
export async function onRequestGet({ env }) {
  try {
    return json(await tudo(env));
  } catch (e) {
    return json({ erro: e.message }, 502);
  }
}
