/**
 * Lê feeds RSS de verdade e devolve notícia com link, resumo e imagem.
 *
 * Sem dependência: só fetch e expressão regular. RSS é XML previsível o
 * bastante pra isso, e um parser completo não cabe num Worker por causa de
 * quatro campos.
 *
 * Usado pelos DOIS lados — o server.js importa este mesmo arquivo.
 */

export const FONTES = [
  {nome:"G1 Economia",    url:"https://g1.globo.com/rss/g1/economia/",                  assunto:"Economia",  area:"pessoal"},
  {nome:"Exame Invest",   url:"https://exame.com/invest/feed/",                         assunto:"Mercado",   area:"academico"},
  {nome:"Agência Brasil", url:"https://agenciabrasil.ebc.com.br/rss/economia/feed.xml", assunto:"Brasil",    area:"pessoal"},
  {nome:"InfoMoney",      url:"https://www.infomoney.com.br/feed/",                     assunto:"Finanças",  area:"academico"},
  {nome:"G1 Tecnologia",  url:"https://g1.globo.com/rss/g1/tecnologia/",                assunto:"Tecnologia",area:"loja"}
];

/* O feed do InfoMoney é geral e vem cheio de política; o do G1 traz de
   tudo. Corta o que não tem nada a ver com o que ele acompanha. */
const FORA = /\/(politica|esporte|esportes|futebol|pop-arte|famosos|celebridades|carnaval|eleicoes|mundo|saude|educacao|turismo|planeta-bizarro|viagem)\//i;

const ENTIDADES = {"&amp;":"&","&lt;":"<","&gt;":">","&quot;":'"',"&#39;":"'","&apos;":"'","&nbsp;":" ","&#8217;":"'","&#8216;":"'","&#8220;":'"',"&#8221;":'"',"&#8211;":"–","&#8230;":"…"};

function limpar(s){
  if(!s) return "";
  return String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_,n)=>String.fromCharCode(Number(n)))
    .replace(/&[a-z#0-9]+;/gi, e => ENTIDADES[e] ?? " ")
    .replace(/\s+/g, " ")
    .trim();
}

const pegar = (bloco, tag) => {
  const m = bloco.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m ? m[1] : "";
};

function imagemDe(bloco){
  /* a capa aparece em três lugares diferentes conforme o jornal */
  const m1 = bloco.match(/<media:content[^>]+url=["']([^"']+)["']/i);
  if(m1) return m1[1];
  const m2 = bloco.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
  if(m2 && /\.(jpe?g|png|webp|avif)/i.test(m2[1])) return m2[1];
  const m3 = bloco.match(/<img[^>]+src=["']([^"']+)["']/i);
  if(m3) return m3[1];
  return "";
}

function cortar(txt, n){
  if(txt.length <= n) return txt;
  const corte = txt.slice(0, n);
  return corte.slice(0, corte.lastIndexOf(" ")) + "…";
}

async function umaFonte(f){
  const r = await fetch(f.url, {
    headers: {"user-agent":"Mozilla/5.0 (painel-do-brain)", "accept":"application/rss+xml, application/xml, text/xml, */*"},
    cf: {cacheTtl: 900, cacheEverything: true}
  });
  if(!r.ok) throw new Error(`${f.nome}: ${r.status}`);
  const xml = await r.text();

  const itens = [];
  const re = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let m, i = 0;
  while((m = re.exec(xml)) !== null && i < 10){
    const b = m[1];
    const link = limpar(pegar(b, "link")) || (b.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1] ?? "").trim();
    if(!/^https?:/i.test(link)) continue;
    if(FORA.test(link)) continue;

    const resumo = limpar(pegar(b, "atom:subtitle")) || limpar(pegar(b, "description"));
    itens.push({
      id: link,
      titulo: limpar(pegar(b, "title")),
      link,
      resumo: cortar(resumo, 260),
      imagem: imagemDe(b),
      fonte: f.nome,
      assunto: f.assunto,
      area: f.area,
      data: limpar(pegar(b, "pubDate")) || limpar(pegar(b, "dc:date"))
    });
    i++;
  }
  return itens;
}

export async function noticias(){
  const lotes = await Promise.allSettled(FONTES.map(umaFonte));
  const tudo = [];
  const falhas = [];
  lotes.forEach((l, idx) => {
    if(l.status === "fulfilled") tudo.push(...l.value);
    else falhas.push(FONTES[idx].nome);
  });

  /* mesma notícia sindicada em duas fontes vira uma só */
  const vistos = new Set();
  const unicas = tudo.filter(n => {
    const chave = n.titulo.toLowerCase().slice(0, 60);
    if(!n.titulo || vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });

  unicas.sort((a, b) => {
    const da = Date.parse(a.data) || 0, db = Date.parse(b.data) || 0;
    return db - da;
  });

  return {itens: unicas.slice(0, 24), falhas};
}
