/**
 * Lê feeds RSS e devolve notícia com link, resumo e imagem.
 *
 * ⚠️ Os assuntos e as fontes NÃO são escolha minha. Estão em
 * `brain/notion.md`: "Assuntos que ELE escolheu (não inventar outros):
 * notícia boa (humana, obrigatória 1/dia), IA e tecnologia, política
 * Brasil, política global, mercado e Bitcoin, ciência."
 * Mexer aqui sem ele pedir é reinventar o que já foi decidido.
 *
 * Cada URL abaixo foi testada em 16/08/2026. As que ele listou e não têm
 * feed que funcione estão anotadas na tabela.
 */

export const FONTES = [
  /* 🌱 obrigatória: 1 por dia, sempre */
  {nome:"Só Notícia Boa", url:"https://www.sonoticiaboa.com.br/feed",              assunto:"Notícia boa",      emoji:"🌱", area:"pessoal"},

  {nome:"Tecnoblog",      url:"https://tecnoblog.net/feed/",                        assunto:"IA e tecnologia",  emoji:"🤖", area:"loja"},
  {nome:"TechCrunch",     url:"https://techcrunch.com/feed/",                       assunto:"IA e tecnologia",  emoji:"🤖", area:"loja"},
  {nome:"MIT Tech Review",url:"https://www.technologyreview.com/feed/",             assunto:"IA e tecnologia",  emoji:"🤖", area:"loja"},

  {nome:"g1 Política",    url:"https://g1.globo.com/rss/g1/politica/",              assunto:"Política Brasil",  emoji:"🇧🇷", area:"academico"},
  {nome:"BBC Brasil",     url:"https://feeds.bbci.co.uk/portuguese/rss.xml",        assunto:"Política Brasil",  emoji:"🇧🇷", area:"academico"},

  {nome:"g1 Mundo",       url:"https://g1.globo.com/rss/g1/mundo/",                 assunto:"Política global",  emoji:"🌍", area:"academico"},
  {nome:"DW Brasil",      url:"https://rss.dw.com/rdf/rss-br-all",                  assunto:"Política global",  emoji:"🌍", area:"academico"},

  {nome:"InfoMoney",      url:"https://www.infomoney.com.br/feed/",                 assunto:"Mercado e Bitcoin",emoji:"📈", area:"vendas"},
  {nome:"Money Times",    url:"https://www.moneytimes.com.br/feed/",                assunto:"Mercado e Bitcoin",emoji:"📈", area:"vendas"},
  {nome:"g1 Economia",    url:"https://g1.globo.com/rss/g1/economia/",              assunto:"Mercado e Bitcoin",emoji:"📈", area:"vendas"},

  {nome:"g1 Ciência",     url:"https://g1.globo.com/rss/g1/ciencia-e-saude/",       assunto:"Ciência",          emoji:"🔬", area:"pessoal"},
  {nome:"Science Daily",  url:"https://www.sciencedaily.com/rss/all.xml",           assunto:"Ciência",          emoji:"🔬", area:"pessoal"}
];

export const ASSUNTOS = ["Notícia boa","Mercado e Bitcoin","Política Brasil","Política global","IA e tecnologia","Ciência"];

/* Fontes que ELE listou e que não têm feed utilizável (testado em 16/08):
   Razões para Acreditar (devolve HTML) · Revista Galileu (404/400) ·
   Agência FAPESP (feed vazio) · Reuters (feed público descontinuado) ·
   Valor Econômico (pago) · CNN Brasil (conexão recusada).
   Substituições feitas: g1 Ciência no lugar de Galileu/FAPESP. */

/**
 * Regra dura dele sobre política, palavras dele:
 * "não vai me jogar notícia do que o prefeito de Macapá fez que não me
 * importa. Só entra o que mexe com a economia, com o país inteiro, ou com
 * a vida dele."
 * Isto aqui é o corte grosso — política municipal e fait divers. O corte
 * fino é julgamento, e julgamento é trabalho de agente, não de regex.
 */
const LOCAL = /\b(prefeit[oa]|vereador|c[âa]mara municipal|assembleia legislativa|subprefeitura)\b/i;
const FAIT_DIVERS = /\b(mega-sena|quina|lotof[áa]cil|hor[óo]scopo|bbb|novela|celebridade)\b/i;
/* Tecnoblog e afins publicam muito "achado de promoção". É conteúdo de
   afiliado, não notícia de tecnologia. */
const PROMO = /(\b\d+% ?off\b|\bOFF\b|desconto|promo[çc][ãa]o|cupom|menor pre[çc]o|est[áa] em oferta|vale a pena comprar)/i;
const FORA_URL = /\/(esportes?|futebol|pop-arte|famosos|carnaval|celebridades|loterias)\//i;

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
  const m1 = bloco.match(/<media:(?:content|thumbnail)[^>]+url=["']([^"']+)["']/i);
  if(m1) return m1[1];
  const m2 = bloco.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
  if(m2 && /\.(jpe?g|png|webp|avif)/i.test(m2[1])) return m2[1];
  const m3 = bloco.match(/<img[^>]+src=["']([^"']+)["']/i);
  if(m3) return m3[1];
  return "";
}

function cortar(txt, n){
  if(!txt || txt.length <= n) return txt || "";
  const corte = txt.slice(0, n);
  return corte.slice(0, corte.lastIndexOf(" ")) + "…";
}

async function umaFonte(f){
  const r = await fetch(f.url, {
    redirect: "follow",
    headers: {"user-agent":"Mozilla/5.0 (painel-do-brain)", "accept":"application/rss+xml, application/xml, text/xml, */*"},
    cf: {cacheTtl: 900, cacheEverything: true}
  });
  if(!r.ok) throw new Error(`${f.nome}: HTTP ${r.status}`);
  const xml = await r.text();

  const itens = [];
  const re = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let m, i = 0;
  while((m = re.exec(xml)) !== null && i < 6){
    const b = m[1];
    const link = limpar(pegar(b, "link")) || (b.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1] ?? "").trim();
    if(!/^https?:/i.test(link)) continue;
    if(FORA_URL.test(link)) continue;
    /* O feed do InfoMoney é geral: matéria de política entrando debaixo de
       "Mercado e Bitcoin" é assunto errado, não conteúdo errado. */
    if(!f.assunto.startsWith("Política") && /\/politica\//i.test(link)) continue;

    const titulo = limpar(pegar(b, "title"));
    if(!titulo) continue;
    if(FAIT_DIVERS.test(titulo)) continue;
    if(f.assunto === "IA e tecnologia" && PROMO.test(titulo)) continue;
    /* o corte de política local vale só onde política entra */
    if(f.assunto.startsWith("Política") && LOCAL.test(titulo)) continue;

    itens.push({
      id: link,
      titulo,
      link,
      resumo: cortar(limpar(pegar(b, "atom:subtitle")) || limpar(pegar(b, "description")), 240),
      imagem: imagemDe(b),
      fonte: f.nome,
      assunto: f.assunto,
      emoji: f.emoji,
      area: f.area,
      data: limpar(pegar(b, "pubDate")) || limpar(pegar(b, "dc:date"))
    });
    i++;
  }
  return itens;
}

export async function noticias(){
  const lotes = await Promise.allSettled(FONTES.map(umaFonte));
  const tudo = [], falhas = [];
  lotes.forEach((l, i) => {
    if(l.status === "fulfilled") tudo.push(...l.value);
    else falhas.push(FONTES[i].nome);
  });

  const vistos = new Set();
  const unicas = tudo.filter(n => {
    const chave = n.titulo.toLowerCase().slice(0, 60);
    if(vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });

  const porData = (a, b) => (Date.parse(b.data) || 0) - (Date.parse(a.data) || 0);
  unicas.sort(porData);

  /* Agrupado pelos assuntos DELE, na ordem que faz sentido de manhã.
     A notícia boa vem primeiro e é obrigatória — decisão dele.
     Máximo 2 por fonte dentro de cada assunto: sem isso o TechCrunch e o
     Science Daily, que publicam muito e em inglês, tomam a seção inteira e
     expulsam o Tecnoblog e o g1. */
  const grupos = ASSUNTOS.map(a => {
    const teto = a === "Notícia boa" ? 2 : 4;
    const porFonte = {}, escolhidas = [];
    for(const n of unicas.filter(x => x.assunto === a)){
      porFonte[n.fonte] = (porFonte[n.fonte] || 0) + 1;
      if(porFonte[n.fonte] > 2) continue;
      escolhidas.push(n);
      if(escolhidas.length >= teto) break;
    }
    return {assunto: a, emoji: (FONTES.find(f => f.assunto === a) || {}).emoji || "", itens: escolhidas};
  }).filter(g => g.itens.length);

  const semNoticiaBoa = !grupos.some(g => g.assunto === "Notícia boa");
  return {grupos, falhas, semNoticiaBoa, total: grupos.reduce((s, g) => s + g.itens.length, 0)};
}
