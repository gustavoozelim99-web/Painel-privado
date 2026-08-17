/**
 * Servidor local do painel — só para desenvolver e testar na máquina.
 * Em produção quem faz este papel é a função do Cloudflare (functions/api).
 *
 * Os dois falam o MESMO contrato:
 *   GET  /api/dados          -> { versao, colecoes... }
 *   PUT  /api/dados/:grupo   -> { versao, dados } -> 200 { versao } | 409 { versao, dados }
 *
 * Sem dependência nenhuma: só o que vem com o Node.
 * Rodar:  node server.js
 */
"use strict";
const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const RAIZ = __dirname;
const PUBLICO = path.join(RAIZ, "public");   /* o mesmo que a Cloudflare serve */
const DADOS = path.join(RAIZ, "dados");      /* fora do público de propósito */
const PORTA = Number(process.env.PORTA || 4310);

/** grupo de arquivo -> coleções que moram dentro dele */
const GRUPOS = {
  financas: ["cartoes", "gastos", "entradas", "dividas"],
  dia:      ["habitos", "tarefas", "notas"],
  treino:   ["cargas", "sessoes"],
  estudo:   ["entregas"],
  negocios: ["funil", "pedidos", "receitaVanetto", "vanettoSessoes"],
  metas:    ["objetivos"]
};

const TIPOS = {
  ".html":"text/html; charset=utf-8", ".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8", ".json":"application/json; charset=utf-8",
  ".svg":"image/svg+xml", ".png":"image/png", ".ico":"image/x-icon", ".md":"text/plain; charset=utf-8"
};

/* Alguns editores do Windows deixam uma marca invisível no começo do arquivo
   (BOM). Ela é legítima, mas o JSON.parse morre nela — então some com ela. */
const lerJSON = async f => {
  const texto = await fsp.readFile(path.join(DADOS, f + ".json"), "utf8");
  return JSON.parse(texto.replace(/^﻿/, ""));
};

/** escrita atômica: grava num temporário e só então troca, pra nunca deixar arquivo pela metade */
async function gravarJSON(f, obj){
  const alvo = path.join(DADOS, f + ".json");
  const tmp = alvo + ".tmp";
  await fsp.writeFile(tmp, JSON.stringify(obj, null, 2) + "\n", "utf8");
  await fsp.rename(tmp, alvo);
}

const responder = (res, code, obj) => {
  const corpo = JSON.stringify(obj);
  res.writeHead(code, {"content-type":"application/json; charset=utf-8","cache-control":"no-store"});
  res.end(corpo);
};

/* Junta os pedaços como BYTES e só converte no fim. Concatenar como texto
   quebra caractere acentuado que caia na emenda de dois pedaços. */
const lerCorpo = req => new Promise((ok, erro) => {
  const partes = []; let n = 0;
  req.on("data", c => { n += c.length; if(n > 4e6){ erro(new Error("corpo grande demais")); req.destroy(); return; } partes.push(c); });
  req.on("end", () => {
    try{
      const texto = Buffer.concat(partes).toString("utf8");
      ok(texto ? JSON.parse(texto) : {});
    }catch(e){ erro(e); }
  });
  req.on("error", erro);
});

/**
 * A versão é a data da última mexida em QUALQUER arquivo de dados.
 * Vale para os dois lados: se a tela grava, muda; se eu editar o arquivo
 * na mão daqui, muda igual — e a página aberta percebe sozinha.
 * Para o cliente é só um texto opaco: ele devolve o mesmo que recebeu.
 */
async function versaoAtual(){
  const arquivos = ["_estado", ...Object.keys(GRUPOS)];
  let maior = 0;
  for(const f of arquivos){
    const s = await fsp.stat(path.join(DADOS, f + ".json"));
    if(s.mtimeMs > maior) maior = s.mtimeMs;
  }
  return String(Math.round(maior));
}

async function tudo(){
  const estado = await lerJSON("_estado");
  const saida = {versao: await versaoAtual(), focoDoDia: estado.focoDoDia, analiseFinanceira: estado.analiseFinanceira};
  for(const g of Object.keys(GRUPOS)) Object.assign(saida, await lerJSON(g));
  return saida;
}

const servidor = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const rota = decodeURIComponent(url.pathname);

  try{
    /* ---------- API ---------- */
    if(rota === "/api/dados" && req.method === "GET"){
      return responder(res, 200, await tudo());
    }

    if(rota.startsWith("/api/dados/") && req.method === "PUT"){
      const grupo = rota.slice("/api/dados/".length);
      if(!GRUPOS[grupo]) return responder(res, 404, {erro:`grupo desconhecido: ${grupo}`});

      const corpo = await lerCorpo(req);

      /* versão velha = mexeram nos arquivos no meio do caminho.
         Devolve o estado atual pro cliente refazer e tentar de novo. */
      if(String(corpo.versao) !== await versaoAtual()){
        return responder(res, 409, {erro:"versao-defasada", ...(await tudo())});
      }

      const atual = await lerJSON(grupo);
      for(const col of GRUPOS[grupo]){
        if(corpo.dados && Array.isArray(corpo.dados[col])) atual[col] = corpo.dados[col];
      }
      await gravarJSON(grupo, atual);

      const estado = await lerJSON("_estado");
      estado.atualizadoEm = new Date().toISOString();
      if(corpo.focoDoDia) estado.focoDoDia = corpo.focoDoDia;
      await gravarJSON("_estado", estado);

      const versao = await versaoAtual();
      console.log(`  gravado ${grupo}.json  -> versao ${versao}`);
      return responder(res, 200, {versao});
    }

    if(rota.startsWith("/api/")) return responder(res, 405, {erro:"método não aceito nesta rota"});

    /* ---------- arquivos ---------- */
    let arquivo = rota === "/" ? "/index.html" : rota;
    const caminho = path.join(PUBLICO, arquivo);
    if(!caminho.startsWith(PUBLICO)) return responder(res, 403, {erro:"fora da pasta"});
    if(!fs.existsSync(caminho) || fs.statSync(caminho).isDirectory()){
      res.writeHead(404, {"content-type":"text/plain; charset=utf-8"});
      return res.end("não encontrado");
    }
    res.writeHead(200, {"content-type": TIPOS[path.extname(caminho)] || "application/octet-stream","cache-control":"no-store"});
    fs.createReadStream(caminho).pipe(res);

  }catch(e){
    console.error("erro:", e.message);
    responder(res, 500, {erro: e.message});
  }
});

servidor.listen(PORTA, () => {
  console.log(`\n  neste PC     http://localhost:${PORTA}`);

  /* No celular, "localhost" é o próprio celular — tem que ser o IP do PC.
     E ainda assim só passa se o firewall do Windows deixar. */
  const redes = Object.values(require("os").networkInterfaces()).flat()
    .filter(i => i && i.family === "IPv4" && !i.internal);
  for(const r of redes) console.log(`  na rede      http://${r.address}:${PORTA}`);
  if(redes.length) console.log(`               (só funciona se o firewall liberar a porta ${PORTA})`);

  console.log(`  dados em     ${DADOS}`);
  console.log(`  parar        Ctrl+C\n`);
});
