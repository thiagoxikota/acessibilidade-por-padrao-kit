#!/usr/bin/env node
// Trava de acessibilidade: roda o axe-core em cada rota, em ate quatro modos de tela,
// e trava a mudanca so quando aparece falha NOVA e GRAVE. O que ja existia fica na
// linha de base, como tarefa com dono e prazo. Excecao precisa de motivo, de quem
// aprovou e de validade; vencida, trava de novo. O que a maquina nao consegue julgar
// sozinha vai para a lista "Para revisar a mao", com capturas de tela.
//
// Uso:
//   BASE_URL=http://localhost:4321 node trava.mjs
//   BASE_URL=http://localhost:4321 node trava.mjs --gerar-linha-de-base
//   BASE_URL=http://localhost:4321 node trava.mjs --limpar-resolvidos
//
// Codigos de saida: 0 passou, 1 travou, 2 configuracao ou execucao com erro.
// Variaveis: veja o README desta pasta.

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MODOS_VALIDOS = ['normal', 'cores-forcadas', 'texto-200', 'largura-320'];
const TELAS = { celular: { width: 390, height: 844 }, computador: { width: 1280, height: 800 } };
const IMPACTOS = ['minor', 'moderate', 'serious', 'critical'];
const ESPERAS = ['load', 'domcontentloaded', 'networkidle'];
const PENDENTE = '[definir]';

class ErroDeConfig extends Error {}

function lista(valor, padrao) {
  return (valor === undefined ? padrao : valor).split(',').map((x) => x.trim()).filter(Boolean);
}

// "//contato" seria lido como outro servidor (contato) e a trava testaria a pagina errada. A barra
// invertida vira barra no navegador, e o navegador apaga tab e quebra de linha: "/\t/contato" vira
// "//contato". Por isso a rota tambem passa pelo leitor de endereco e precisa ficar no mesmo servidor.
const rotaValida = (r) => {
  if (typeof r !== 'string' || !r.startsWith('/') || /[\t\n\r\\]/.test(r)) return false;
  try {
    return new URL(r, 'http://rota.invalid').host === 'rota.invalid';
  } catch {
    return false;
  }
};
const ROTA_INVALIDA = 'precisa comecar com uma so / e nao pode ter \\, tab nem quebra de linha';

function hojeLocal() {
  // Data no fuso da maquina (defina TZ=America/Sao_Paulo no CI). Evita vencer excecao as 21h.
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function dataValida(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const [a, m, d] = texto.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

// Junta o caminho de BASE_URL com a rota: http://x/app/ mais /contato da http://x/app/contato.
// new URL('/contato', 'http://x/app/') descartaria o /app e testaria outro endereco.
function montarUrl(baseUrl, rota) {
  const u = new URL(baseUrl);
  const r = new URL(rota, 'http://rota.invalid');
  u.pathname = u.pathname.replace(/\/+$/, '') + r.pathname;
  u.search = r.search;
  u.hash = r.hash;
  return u.toString();
}

function lerConfig(env, argv) {
  const cfg = {
    baseUrl: env.BASE_URL,
    rotas: lista(env.ROTAS, env.ROTEIRO ? '' : '/'),
    arqRoteiro: env.ROTEIRO || '',
    modos: lista(env.MODOS, MODOS_VALIDOS.join(',')),
    telas: lista(env.TELAS, 'celular'),
    impacto: lista(env.IMPACTO, 'critical,serious'),
    sempreTrava: lista(env.SEMPRE_TRAVA, 'meta-viewport'),
    regras: lista(env.REGRAS, 'wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa'),
    espera: env.ESPERA || 'load',
    estrito: (env.ESTRITO || '').trim(),
    arqBase: env.LINHA_DE_BASE || 'linha-de-base.json',
    arqExc: env.EXCECOES || 'excecoes.json',
    arqRel: env.RELATORIO || 'trava-relatorio.json',
    capturas: env.CAPTURAS === undefined ? 'trava-capturas' : env.CAPTURAS,
    hoje: env.HOJE || hojeLocal(),
    resumoGithub: env.GITHUB_STEP_SUMMARY || '',
    gerar: argv.includes('--gerar-linha-de-base'),
    limpar: argv.includes('--limpar-resolvidos'),
  };
  if (!cfg.baseUrl) throw new ErroDeConfig('defina BASE_URL, por exemplo BASE_URL=http://localhost:4321');
  let base;
  try {
    base = new URL(cfg.baseUrl);
  } catch {
    throw new ErroDeConfig(`BASE_URL invalida: "${cfg.baseUrl}".`);
  }
  if (!['http:', 'https:'].includes(base.protocol)) throw new ErroDeConfig(`BASE_URL precisa comecar com http:// ou https:// (veio "${cfg.baseUrl}").`);
  if (base.search || base.hash) throw new ErroDeConfig('BASE_URL nao pode ter ? nem #. Ponha isso na rota.');
  if (!cfg.rotas.length && !cfg.arqRoteiro) throw new ErroDeConfig('ROTAS esta vazia. Sem rota, nada e testado e o verde seria falso.');
  for (const r of cfg.rotas) {
    // ROTAS escrita uma por linha (bloco | do YAML) virava uma rota so, e a trava testava a pagina errada.
    if (!rotaValida(r)) throw new ErroDeConfig(`rota ${JSON.stringify(r)} ${ROTA_INVALIDA}.${/[\n\r]/.test(r) ? ' Separe as rotas com virgula, nao com quebra de linha.' : ''}`);
  }
  if (!cfg.modos.length) throw new ErroDeConfig('MODOS esta vazio.');
  for (const m of cfg.modos) if (!MODOS_VALIDOS.includes(m)) throw new ErroDeConfig(`modo desconhecido "${m}". Use ${MODOS_VALIDOS.join(', ')}.`);
  if (!cfg.telas.length) throw new ErroDeConfig('TELAS esta vazia.');
  for (const t of cfg.telas) if (!TELAS[t]) throw new ErroDeConfig(`tela desconhecida "${t}". Use ${Object.keys(TELAS).join(', ')}.`);
  if (!cfg.impacto.length) throw new ErroDeConfig('IMPACTO esta vazio. Sem impacto, nada trava e o verde seria falso.');
  for (const i of cfg.impacto) if (!IMPACTOS.includes(i)) throw new ErroDeConfig(`impacto desconhecido "${i}". Use ${IMPACTOS.join(', ')} (nomes do axe, em ingles).`);
  if (!cfg.regras.length) throw new ErroDeConfig('REGRAS esta vazia.');
  if (!ESPERAS.includes(cfg.espera)) throw new ErroDeConfig(`ESPERA desconhecida "${cfg.espera}". Use ${ESPERAS.join(', ')}.`);
  // ESTRITO=true ou ESTRITO=sim desligaria a regra calado.
  if (!['', '0', '1'].includes(cfg.estrito)) throw new ErroDeConfig(`ESTRITO="${cfg.estrito}" nao vale. Use ESTRITO=1 para travar ou deixe vazio.`);
  cfg.estrito = cfg.estrito === '1';
  if (!dataValida(cfg.hoje)) throw new ErroDeConfig(`HOJE invalido: "${cfg.hoje}". Use AAAA-MM-DD.`);
  if (cfg.gerar && cfg.limpar) throw new ErroDeConfig('use --gerar-linha-de-base ou --limpar-resolvidos, nao os dois.');
  return cfg;
}

function lerLista(arquivo, nome, camposObrigatorios) {
  if (!existsSync(arquivo)) return [];
  let dados;
  try {
    dados = JSON.parse(readFileSync(arquivo, 'utf8'));
  } catch (e) {
    throw new ErroDeConfig(`${arquivo} nao e um JSON valido (${e.message}).`);
  }
  if (!Array.isArray(dados)) throw new ErroDeConfig(`${arquivo} precisa ser uma lista ([...]) de ${nome}.`);
  dados.forEach((x, i) => {
    if (!x || typeof x !== 'object' || Array.isArray(x)) throw new ErroDeConfig(`${arquivo}, item ${i + 1}: precisa ser um objeto.`);
    for (const c of camposObrigatorios) {
      if (typeof x[c] !== 'string' || !x[c].trim()) throw new ErroDeConfig(`${arquivo}, item ${i + 1}: campo "${c}" faltando.`);
    }
  });
  return dados;
}

const ACOES = ['clicar', 'esperar', 'teclar', 'preencher'];

function lerRoteiro(arquivo) {
  if (!arquivo) return [];
  if (!existsSync(arquivo)) throw new ErroDeConfig(`ROTEIRO aponta para ${arquivo}, que nao existe.`);
  const lista = lerLista(arquivo, 'estados', ['rota', 'estado']);
  lista.forEach((e, i) => {
    if (!rotaValida(e.rota)) throw new ErroDeConfig(`${arquivo}, item ${i + 1}: rota ${ROTA_INVALIDA}.`);
    if (!Array.isArray(e.acoes) || !e.acoes.length) throw new ErroDeConfig(`${arquivo}, item ${i + 1}: "acoes" precisa ser uma lista com pelo menos uma acao.`);
    e.acoes.forEach((a, j) => {
      const onde = `${arquivo}, item ${i + 1}, acao ${j + 1}`;
      const campos = a && typeof a === 'object' && !Array.isArray(a) ? Object.keys(a) : [];
      const tipos = campos.filter((k) => ACOES.includes(k));
      if (tipos.length !== 1) throw new ErroDeConfig(`${onde}: use exatamente uma de ${ACOES.join(', ')}.`);
      // Campo com erro de digitacao ("espera") seria ignorado calado.
      const extras = campos.filter((k) => !ACOES.includes(k) && !(tipos[0] === 'preencher' && k === 'texto'));
      if (extras.length) throw new ErroDeConfig(`${onde}: campo desconhecido "${extras[0]}".`);
      // Seletor so de espacos nao acha nada; a tecla " " e o Espaco, e vale.
      const valor = a[tipos[0]];
      if (typeof valor !== 'string' || !(tipos[0] === 'teclar' ? valor.length : valor.trim())) throw new ErroDeConfig(`${onde}: "${tipos[0]}" precisa de ${tipos[0] === 'teclar' ? 'uma tecla, como "Escape"' : 'um seletor, como "#menu"'}, entre aspas.`);
      if (tipos[0] === 'preencher' && typeof a.texto !== 'string') throw new ErroDeConfig(`${onde}: "preencher" precisa de "texto".`);
    });
    if (!('esperar' in e.acoes[e.acoes.length - 1])) {
      throw new ErroDeConfig(`${arquivo}, item ${i + 1}: termine com "esperar" num elemento que so existe no estado pedido (o menu aberto, a mensagem de erro). Sem isso, um clique que nao fez nada passaria despercebido e o teste olharia a tela errada.`);
    }
  });
  const vistos = new Set();
  for (const e of lista) {
    const k = `${e.rota}|${e.estado}`;
    if (vistos.has(k)) throw new ErroDeConfig(`${arquivo}: estado repetido "${e.estado}" na rota ${e.rota}.`);
    vistos.add(k);
  }
  return lista;
}

async function executarAcoes(pagina, alvo) {
  for (const a of alvo.acoes) {
    const [tipo] = Object.keys(a).filter((k) => ACOES.includes(k));
    const valor = a[tipo];
    try {
      if (tipo === 'clicar') await pagina.click(valor, { timeout: 10000 });
      if (tipo === 'esperar') await pagina.waitForSelector(valor, { state: 'visible', timeout: 10000 });
      if (tipo === 'teclar') await pagina.keyboard.press(valor);
      if (tipo === 'preencher') await pagina.fill(valor, a.texto, { timeout: 10000 });
    } catch (e) {
      const dica = alvo.modo === 'texto-200' ? ' So falha com o texto ampliado? O problema pode ser do site: o alvo ficou coberto ou fora da tela.' : '';
      throw new ErroDeConfig(`roteiro "${alvo.estado}" em ${alvo.rota} (${alvo.tela}/${alvo.modo}): nao conseguiu ${tipo} "${valor}" (${e.message.split('\n')[0]}).${dica}`);
    }
  }
}

const chave = (x) => `${x.rota}|${x.estado || ''}|${x.regra}|${x.seletor}`;
const chaveXpath = (x) => `${x.rota}|${x.estado || ''}|${x.regra}|${x.xpath}`;
const lugar = (rota, estado, onde) => `${rota}|${estado || ''}|${onde}`;
const alvoDoNo = (no) => no.target.flat(Infinity).join(' ');
// Dentro de shadow DOM, o xpath do axe comeca na raiz da sombra: dois componentes iguais dao o mesmo
// xpath (/button). La, a posicao nao identifica o elemento, e o item e reconhecido so pelo seletor.
const xpathDoNo = (no) => (Array.isArray(no.xpath) && !no.target.some(Array.isArray) ? no.xpath.flat(Infinity).join(' ') : '');

const rotulo = (x) => `${x.rota}${x.estado ? ` [${x.estado}]` : ''}`;
const pior = (a, b) => (IMPACTOS.indexOf(a) >= IMPACTOS.indexOf(b) ? a : b);
const temOnde = (b) => Array.isArray(b.onde) && b.onde.length > 0;
// O impacto de cada achado em cada tela e modo. O campo "impacto" guarda o pior de todos.
const impactoEm = new WeakMap();
const impactoNoLugar = (a, onde) => impactoEm.get(a)?.get(onde) || a.impacto;

// Casa os achados de agora com a linha de base, lugar por lugar (tela e modo). Cada item da base vale
// nos lugares da sua lista "onde" (item sem "onde", da versao 1, vale em todos), e em cada lugar casa
// com um achado so.
// 1. Pelo seletor.
// 2. Nos lugares que sobraram, pela posicao na pagina (xpath). O seletor do axe muda quando um atributo
//    muda: no menu do DSGov, tirar role="treeitem" mudou o seletor de 21 links que continuavam com alvo
//    de toque pequeno. Sem o xpath, o conserto viraria 21 "resolvidos" falsos e 21 "novos" falsos, e
//    travaria. O passo 1 roda antes para todos os achados: um elemento novo que ocupa a posicao de um
//    antigo, que mudou de lugar e foi achado pelo seletor, continua novo.
//    Casar por lugar cobre tambem o mesmo elemento com um seletor em cada tela ou modo, e o seletor que
//    mudou so num modo: cada lugar casa com o item que vale ali, e o impacto e comparado com o dele.
// 3. Achado sem nenhum lugar casado, mas com o seletor ou o xpath na base, e conhecido: apareceu em
//    tela ou modo novo.
function casarComBase(achados, base) {
  const pares = new Map(achados.map((a) => [a, new Map()]));
  const tomados = new Map(base.map((b) => [b, new Set()]));
  const indice = (chaveDe, entra) => {
    const m = new Map();
    for (const b of base.filter(entra)) {
      if (!m.has(chaveDe(b))) m.set(chaveDe(b), []);
      m.get(chaveDe(b)).push(b);
    }
    return m;
  };
  const comXpath = (x) => Boolean(x.xpath);
  const porSeletor = indice(chave, () => true);
  const porXpath = indice(chaveXpath, comXpath);
  for (const [porChave, chaveDe, entra] of [[porSeletor, chave, () => true], [porXpath, chaveXpath, comXpath]]) {
    for (const a of achados.filter(entra)) {
      const candidatos = porChave.get(chaveDe(a)) || [];
      for (const o of a.onde) {
        if (pares.get(a).has(o)) continue;
        const b = candidatos.find((x) => (!temOnde(x) || x.onde.includes(o)) && !tomados.get(x).has(o));
        if (b) {
          pares.get(a).set(o, b);
          tomados.get(b).add(o);
        }
      }
    }
  }
  const conhecido = new Map();
  for (const a of achados) {
    if (pares.get(a).size) continue;
    const b = (porSeletor.get(chave(a)) || [])[0] || (a.xpath ? (porXpath.get(chaveXpath(a)) || [])[0] : undefined);
    if (b) conhecido.set(a, b);
  }
  const daBase = (a) => (pares.get(a).size ? [...new Set(pares.get(a).values())] : conhecido.has(a) ? [conhecido.get(a)] : []);
  const achadosDe = new Map();
  for (const a of achados) for (const b of new Set(pares.get(a).values())) achadosDe.set(b, (achadosDe.get(b) || 0) + 1);
  const usados = new Set([...achadosDe.keys(), ...conhecido.values()]);
  // O achado casa com um item so, e o item com esse achado so: o seletor de agora pode ir direto para o item.
  const umParaUm = (a) => {
    const d = daBase(a);
    return pares.get(a).size > 0 && d.length === 1 && achadosDe.get(d[0]) === 1;
  };
  return { pares, tomados, daBase, usados, umParaUm };
}

// Dono, prazo e nota de um achado que casou com mais de um item da base: o prazo mais curto (um prazo
// vencido continua vencido), o dono desse prazo (ou o primeiro dono preenchido) e as notas somadas.
const preenchido = (v) => typeof v === 'string' && Boolean(v.trim()) && v.trim() !== PENDENTE;
function governanca(itens) {
  const prazos = itens.map((b) => b.prazo).filter(preenchido);
  const prazo = prazos.filter(dataValida).sort()[0] || prazos[0];
  const dono = (prazo && itens.find((b) => b.prazo === prazo && preenchido(b.dono))?.dono) || itens.map((b) => b.dono).find(preenchido);
  const notas = [...new Set(itens.map((b) => b.nota).filter(preenchido))];
  return { dono: dono || PENDENTE, prazo: prazo || PENDENTE, ...(notas.length ? { nota: notas.join(' | ') } : {}) };
}
// Itens antigos com donos ou prazos diferentes que viraram um so: a escolha merece um olhar humano.
const governancaDivergente = (itens) => ['dono', 'prazo'].some((campo) => new Set(itens.map((b) => b[campo]).filter(preenchido).map((v) => v.trim())).size > 1);

function combinacoes(cfg, roteiro) {
  const alvos = [...cfg.rotas.map((rota) => ({ rota, estado: '', acoes: [] })), ...roteiro];
  const out = [];
  for (const alvo of alvos) {
    for (const tela of cfg.telas) {
      for (const modo of cfg.modos) {
        // largura-320 ja define a propria tela; roda uma vez por alvo.
        if (modo === 'largura-320' && tela !== cfg.telas[0]) continue;
        out.push({ rota: alvo.rota, estado: alvo.estado, acoes: alvo.acoes, tela: modo === 'largura-320' ? '320px' : tela, modo });
      }
    }
  }
  return out;
}

// Imita o zoom so do texto (no Firefox: Exibir, Zoom, Zoom so no texto). Cada elemento passa a ter
// o dobro do tamanho de fonte que o site da a ele, inclusive texto em px e campos de formulario; caixa
// com largura ou altura em px nao cresce. Roda de novo depois do roteiro, e a cada vez: (1) devolve
// cada elemento ao tamanho que o site da a ele agora (o roteiro pode ter trocado uma classe ou criado
// elementos); (2) mede sem ampliacao e anota o que ja cortava texto; (3) dobra. Assim nada dobra duas
// vezes, nada fica com o tamanho de antes do roteiro, e o sinal de "texto cortado" acusa so o que a
// ampliacao causou. A marca de cada elemento fica no proprio atributo style: o elemento que o site
// clona ou recria (innerHTML) leva a marca junto e tambem volta ao tamanho do site.
async function ampliarTexto(pagina) {
  await pagina.evaluate(() => {
    const estado = (window.__travaTexto200 ||= {});
    estado.coletar = () => {
      const todos = [];
      const visitar = (raiz) => {
        for (const el of raiz.querySelectorAll('*')) {
          todos.push(el);
          if (el.shadowRoot) visitar(el.shadowRoot);
        }
      };
      visitar(document);
      return todos;
    };
    estado.corta = (el) => {
      if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'HEAD', 'TITLE'].includes(el.tagName)) return false;
      const cs = getComputedStyle(el);
      const escondeX = ['hidden', 'clip'].includes(cs.overflowX);
      const escondeY = ['hidden', 'clip'].includes(cs.overflowY);
      if (!escondeX && !escondeY) return false;
      if (cs.visibility === 'hidden' || cs.display === 'none') return false;
      if (el.clientWidth <= 1 || el.clientHeight <= 1) return false; // texto so para leitor de tela
      if (cs.clip !== 'auto' && cs.clip !== '') return false;
      if (!el.textContent || !el.textContent.trim()) return false;
      return (escondeX && el.scrollWidth > el.clientWidth + 1) || (escondeY && el.scrollHeight > el.clientHeight + 1);
    };
    const MARCA = '--trava-texto200';
    const todos = estado.coletar().filter((el) => el.style);
    // Transicao de CSS (por exemplo, `transition: all` num ancestral) faria a medida pegar o valor de
    // partida, ainda ampliado, e a fonte iria a 4x. Cancelada, vale na hora o valor final.
    const semTransicao = () => {
      for (const el of todos) for (const an of el.getAnimations()) if (an instanceof CSSTransition) an.cancel();
    };
    // 1. Tira a ampliacao anterior e devolve o font-size que o proprio site tinha posto no atributo
    //    style. Se o site trocou esse valor depois da trava, fica o do site.
    for (const el of todos) {
      const marca = el.style.getPropertyValue(MARCA);
      if (!marca) continue;
      el.style.removeProperty(MARCA);
      let anterior;
      try {
        anterior = JSON.parse(marca);
      } catch {
        continue;
      }
      const [valor, prioridade, nosso] = anterior;
      if (el.style.getPropertyValue('font-size') === nosso && el.style.getPropertyPriority('font-size') === 'important') {
        if (valor) el.style.setProperty('font-size', valor, prioridade);
        else el.style.removeProperty('font-size');
      }
    }
    semTransicao();
    // 2. Mede sem ampliacao.
    const tamanhos = todos.map((el) => parseFloat(getComputedStyle(el).fontSize));
    estado.cortavaAntes = new WeakSet(todos.filter(estado.corta));
    // 3. Dobra, guardando na marca o que o site tinha no atributo style. O dobro vai escrito com calc():
    //    se o site gravar no style o mesmo tamanho em px, o passo 1 ainda separa a escrita dele da nossa.
    todos.forEach((el, i) => {
      if (!Number.isFinite(tamanhos[i])) return;
      const valor = el.style.getPropertyValue('font-size');
      const prioridade = el.style.getPropertyPriority('font-size');
      el.style.setProperty('font-size', `calc(${tamanhos[i] * 2}px)`, 'important');
      el.style.setProperty(MARCA, JSON.stringify([valor, prioridade, el.style.getPropertyValue('font-size')]));
    });
    semTransicao();
  });
}

// Sinais geometricos que o axe nao mede. Viram itens "para revisar a mao", nunca travam.
async function sinaisDeLayout(pagina, modo) {
  return pagina.evaluate((modoAtual) => {
    const seletor = (el) => {
      if (el.id) return `#${CSS.escape(el.id)}`;
      const partes = [];
      let atual = el;
      while (atual && atual.nodeType === 1 && partes.length < 4) {
        let parte = atual.tagName.toLowerCase();
        const classe = [...atual.classList].slice(0, 2).map((c) => `.${CSS.escape(c)}`).join('');
        parte += classe;
        partes.unshift(parte);
        if (atual.id) break;
        atual = atual.parentElement;
      }
      return partes.join(' > ');
    };
    const sinais = [];
    if (modoAtual === 'largura-320') {
      const largura = document.documentElement.clientWidth;
      if (document.documentElement.scrollWidth > largura + 1) {
        const culpados = [...document.body.querySelectorAll('*')]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.right > largura + 1 && getComputedStyle(el).position !== 'fixed';
          })
          .filter((el) => !el.parentElement || el.parentElement.getBoundingClientRect().right <= largura + 1)
          .slice(0, 5);
        sinais.push({
          sinal: 'rolagem-horizontal',
          criterio: 'WCAG 1.4.10 Reflow',
          descricao: `Em 320 px de largura a pagina rola na horizontal (${document.documentElement.scrollWidth} px de conteudo).`,
          seletores: culpados.map(seletor),
        });
      }
    }
    if (modoAtual === 'texto-200') {
      const t = window.__travaTexto200;
      if (!t) {
        sinais.push({
          sinal: 'texto-nao-ampliado',
          criterio: 'WCAG 1.4.4 Resize Text',
          descricao: 'A pagina recarregou depois da ampliacao e foi medida sem ela. Amplie o texto a mao (ficha 1).',
          seletores: [],
        });
      } else {
        // So o que passou a cortar com a ampliacao; e, entre caixas uma dentro da outra, a mais interna.
        const cortados = t.coletar().filter((el) => t.corta(el) && !t.cortavaAntes.has(el));
        const internos = cortados.filter((el) => !cortados.some((o) => o !== el && el.contains(o)));
        if (internos.length) {
          sinais.push({
            sinal: 'texto-cortado',
            criterio: 'WCAG 1.4.4 Resize Text',
            descricao: `Com o texto em 200%, ${internos.length} elemento(s) passam a cortar o texto que tem dentro (overflow escondido).`,
            seletores: internos.slice(0, 5).map(seletor),
          });
        }
      }
    }
    return sinais;
  }, modo);
}

async function auditar(cfg, roteiro) {
  let chromium;
  let AxeBuilder;
  let axe;
  try {
    ({ chromium } = await import('playwright'));
    ({ AxeBuilder } = await import('@axe-core/playwright'));
    axe = (await import('axe-core')).default;
  } catch (e) {
    throw new ErroDeConfig(`dependencias ausentes (${e.message}). Rode npm install e npx playwright install chromium.`);
  }
  // Tag com erro de digitacao seleciona zero regras e o axe nao reclama. Aqui reclama, antes de abrir o navegador.
  const regrasDoAxe = axe.getRules();
  const conhecidas = new Set(regrasDoAxe.flatMap((r) => r.tags));
  const desconhecidas = cfg.regras.filter((t) => !conhecidas.has(t));
  if (desconhecidas.length) {
    throw new ErroDeConfig(`REGRAS: ${desconhecidas.map((t) => `"${t}"`).join(', ')} nao e tag do axe-core ${axe.version}. Confira o nome (wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice).`);
  }
  // Regra de SEMPRE_TRAVA que REGRAS nao seleciona nunca roda, e o "sempre" seria falso.
  for (const id of cfg.sempreTrava) {
    const regra = regrasDoAxe.find((r) => r.ruleId === id);
    if (!regra) throw new ErroDeConfig(`SEMPRE_TRAVA: "${id}" nao e regra do axe-core ${axe.version}. Confira o nome (por exemplo, meta-viewport).`);
    // O axe so roda regra experimental ou obsoleta quando a etiqueta dela esta em REGRAS.
    for (const [etiqueta, nome] of [['experimental', 'experimental'], ['deprecated', 'obsoleta (deprecated)']]) {
      if (regra.tags.includes(etiqueta) && !cfg.regras.includes(etiqueta)) {
        throw new ErroDeConfig(`SEMPRE_TRAVA: "${id}" e regra ${nome} no axe-core ${axe.version} e so roda com "${etiqueta}" em REGRAS.`);
      }
    }
    if (!regra.tags.some((t) => cfg.regras.includes(t))) {
      const niveis = regra.tags.filter((t) => /^wcag\d*a+$/.test(t) || t === 'best-practice');
      throw new ErroDeConfig(`SEMPRE_TRAVA: "${id}" nao roda com REGRAS=${cfg.regras.join(',')}. Ponha ${niveis.length ? niveis.join(' ou ') : 'uma tag dela'} em REGRAS, ou esvazie SEMPRE_TRAVA (SEMPRE_TRAVA=).`);
    }
  }
  if (cfg.capturas && cfg.capturas !== '0') mkdirSync(cfg.capturas, { recursive: true });
  const navegador = await chromium.launch();
  const achados = new Map();
  const revisar = [];
  const capturas = [];
  const execucoes = [];
  // Por rota, estado, tela e modo: quais regras rodaram e quais nos o axe nao decidiu.
  // E o que permite dizer "resolvido" so quando o item foi procurado de novo de verdade.
  const rodadas = new Map();
  let versaoAxe = '';
  try {
    for (const c of combinacoes(cfg, roteiro)) {
      const viewport = c.modo === 'largura-320' ? { width: 320, height: 640 } : TELAS[c.tela];
      const contexto = await navegador.newContext({
        viewport,
        forcedColors: c.modo === 'cores-forcadas' ? 'active' : 'none',
      });
      try {
        const pagina = await contexto.newPage();
        const url = montarUrl(cfg.baseUrl, c.rota);
        let resp;
        try {
          resp = await pagina.goto(url, { waitUntil: cfg.espera, timeout: 45000 });
        } catch (e) {
          throw new ErroDeConfig(`nao abriu ${url} (${e.message.split('\n')[0]}).`);
        }
        if (!resp || !resp.ok()) throw new ErroDeConfig(`${url} respondeu ${resp ? resp.status() : 'sem resposta'}.`);
        // No texto-200, o roteiro roda com o texto ja ampliado, como faria quem usa zoom.
        if (c.modo === 'texto-200') await ampliarTexto(pagina);
        if (c.acoes.length) {
          await executarAcoes(pagina, c);
          if (c.modo === 'texto-200') await ampliarTexto(pagina);
        }
        // options() troca todas as opcoes de uma vez: tem que vir antes de withTags, senao as tags se perdem.
        const resultado = await new AxeBuilder({ page: pagina }).options({ xpath: true }).withTags(cfg.regras).analyze();
        const rodaram = [...resultado.passes, ...resultado.violations, ...resultado.incomplete, ...resultado.inapplicable];
        const foraDasTags = rodaram.filter((r) => !r.tags.some((t) => cfg.regras.includes(t))).map((r) => r.id);
        if (foraDasTags.length) throw new Error(`o axe rodou regras fora de REGRAS (${foraDasTags.slice(0, 5).join(', ')}). O resultado nao vale.`);
        if (!versaoAxe) {
          versaoAxe = resultado.testEngine.version;
          // Tag que existe mas so tem regra experimental (no axe 4.11, wcag21a sozinha) tambem nao testa nada.
          if (!rodaram.length) throw new ErroDeConfig(`REGRAS=${cfg.regras.join(',')} nao rodou nenhuma regra do axe-core ${versaoAxe}. Nada foi testado e o verde seria falso.`);
          const naoRodou = cfg.sempreTrava.filter((id) => !rodaram.some((r) => r.id === id));
          if (naoRodou.length) throw new ErroDeConfig(`SEMPRE_TRAVA: ${naoRodou.join(', ')} nao rodou no axe-core ${versaoAxe}. O "sempre" seria falso.`);
        }
        rodadas.set(lugar(c.rota, c.estado, `${c.tela}/${c.modo}`), {
          regras: new Set(rodaram.map((r) => r.id)),
          incertos: new Set(resultado.incomplete.flatMap((inc) => inc.nodes.flatMap((n) => [
            `${inc.id}|css|${alvoDoNo(n)}`, ...(xpathDoNo(n) ? [`${inc.id}|xpath|${xpathDoNo(n)}`] : []),
          ]))),
        });
        execucoes.push({ rota: c.rota, estado: c.estado, tela: c.tela, modo: c.modo, url });
        for (const v of resultado.violations) {
          for (const no of v.nodes) {
            const item = {
              rota: c.rota,
              estado: c.estado,
              regra: v.id,
              seletor: alvoDoNo(no),
              xpath: xpathDoNo(no),
              impacto: no.impact || v.impact || 'minor',
              ajuda: v.helpUrl,
              descricao: v.help,
            };
            const k = chave(item);
            const atual = achados.get(k);
            const onde = `${c.tela}/${c.modo}`;
            if (atual) {
              if (!atual.onde.includes(onde)) atual.onde.push(onde);
              atual.impacto = pior(atual.impacto, item.impacto);
              const noLugar = impactoEm.get(atual);
              noLugar.set(onde, noLugar.has(onde) ? pior(noLugar.get(onde), item.impacto) : item.impacto);
            } else {
              const novo = { ...item, onde: [onde] };
              achados.set(k, novo);
              impactoEm.set(novo, new Map([[onde, item.impacto]]));
            }
          }
        }
        for (const inc of resultado.incomplete) {
          revisar.push({
            rota: c.rota, estado: c.estado, onde: `${c.tela}/${c.modo}`, tipo: 'axe-incompleto', regra: inc.id,
            descricao: `${inc.help} (o axe nao conseguiu decidir)`, seletores: inc.nodes.slice(0, 5).map(alvoDoNo),
            total: inc.nodes.length, ajuda: inc.helpUrl,
          });
        }
        for (const s of await sinaisDeLayout(pagina, c.modo)) {
          revisar.push({ rota: c.rota, estado: c.estado, onde: `${c.tela}/${c.modo}`, tipo: s.sinal, regra: s.criterio, descricao: s.descricao, seletores: s.seletores, total: s.seletores.length });
        }
        if (cfg.capturas && cfg.capturas !== '0') {
          const slug = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
          const nome = `${slug(c.rota) || 'inicio'}${c.estado ? `--${slug(c.estado)}` : ''}--${c.tela}--${c.modo}.jpg`;
          const caminho = join(cfg.capturas, nome);
          await pagina.screenshot({ path: caminho, fullPage: true, type: 'jpeg', quality: 60 });
          capturas.push(caminho);
        }
      } finally {
        await contexto.close();
      }
    }
  } finally {
    await navegador.close();
  }
  return { achados: [...achados.values()], revisar, capturas, execucoes, rodadas, versaoAxe };
}

function validarExcecao(e) {
  const faltando = ['regra', 'seletor', 'motivo', 'aprovado_por', 'validade'].filter((c) => typeof e[c] !== 'string' || !e[c].trim());
  if (faltando.length) return `faltam campos: ${faltando.join(', ')}`;
  if (!dataValida(e.validade)) return `validade "${e.validade}" nao e uma data real no formato AAAA-MM-DD`;
  if (e.rota !== undefined && !rotaValida(e.rota)) return `rota "${e.rota}" ${ROTA_INVALIDA}`;
  if (e.estado !== undefined && typeof e.estado !== 'string') return 'estado precisa ser texto';
  return null;
}

const cobre = (e, item) => e.regra === item.regra && e.seletor === item.seletor
  && (!e.rota || e.rota === item.rota) && (e.estado === undefined || e.estado === (item.estado || ''));

function pendenciasDaBase(base, hoje) {
  const out = [];
  for (const b of base) {
    const problemas = [];
    const vazio = (v) => typeof v !== 'string' || !v.trim() || v.trim() === PENDENTE;
    if (vazio(b.dono)) problemas.push('sem dono');
    if (vazio(b.prazo)) problemas.push('sem prazo');
    else if (!dataValida(b.prazo)) problemas.push(`prazo invalido "${b.prazo}" (use AAAA-MM-DD)`);
    else if (b.prazo < hoje) problemas.push(`prazo vencido em ${b.prazo}`);
    if (problemas.length) out.push({ item: b, problemas });
  }
  return out;
}

// O item foi procurado de novo naquela tela e modo: a mesma regra rodou e o axe decidiu.
// "Nao consegui decidir" (incomplete) nao e conserto.
function retestadoEm(b, onde, rodadas) {
  const r = rodadas.get(lugar(b.rota, b.estado, onde));
  if (!r || !r.regras.has(b.regra)) return false;
  return !r.incertos.has(`${b.regra}|css|${b.seletor}`) && !(b.xpath && r.incertos.has(`${b.regra}|xpath|${b.xpath}`));
}

// So da para dizer "resolvido" quando o item foi retestado assim em cada tela e modo onde aparecia.
// Item da versao 1, sem "onde", nao diz em que modo aparecia: so sai numa rodada com os quatro modos,
// e retestado em todo lugar que rodou naquela rota e estado.
function retestadoPorInteiro(b, rodadas) {
  if (temOnde(b)) return b.onde.every((o) => retestadoEm(b, o, rodadas));
  const prefixo = lugar(b.rota, b.estado, '');
  const lugares = [...rodadas.keys()].filter((k) => k.startsWith(prefixo)).map((k) => k.slice(prefixo.length));
  const modos = new Set(lugares.map((o) => o.slice(o.indexOf('/') + 1)));
  return MODOS_VALIDOS.every((m) => modos.has(m)) && lugares.every((o) => retestadoEm(b, o, rodadas));
}

function classificar(cfg, achados, base, excecoes, rodadas) {
  const travas = [];
  const avisos = [];
  const jaExistiam = [];
  const excecoesUsadas = [];
  const usadas = new Set();
  // Casa todos os achados, inclusive os cobertos por excecao: o que tem excecao nao some da base.
  const m = casarComBase(achados, base);
  const grave = (impacto, regra) => cfg.impacto.includes(impacto) || cfg.sempreTrava.includes(regra);
  let mudaramDeSeletor = 0;
  let soComGerar = 0;

  excecoes.forEach((e, i) => {
    const problema = validarExcecao(e);
    if (problema) travas.push({ tipo: 'excecao-invalida', excecao: e, motivo: `item ${i + 1}: ${problema}` });
  });
  const validas = excecoes.filter((e) => !validarExcecao(e));

  for (const item of achados) {
    const daBase = m.daBase(item);
    // Excecao vem primeiro: uma excecao vencida trava mesmo que o item esteja na linha de base.
    // Vale pelo seletor de agora e pelo que a linha de base guardou para o mesmo elemento: mudar
    // o seletor nao tira o item de baixo de uma excecao vencida.
    const identidades = [item, ...daBase];
    const casadas = validas.filter((e) => identidades.some((x) => cobre(e, x)));
    if (casadas.length) {
      const exc = casadas.reduce((a, b) => (a.validade <= b.validade ? a : b));
      casadas.forEach((e) => usadas.add(e));
      if (casadas.length > 1) avisos.push({ tipo: 'excecao-duplicada', item, motivo: `${casadas.length} excecoes cobrem o mesmo problema; vale a de validade mais curta.` });
      if (!cobre(exc, item)) avisos.push({ tipo: 'excecao-com-seletor-antigo', item, motivo: `a excecao usa o seletor antigo (${exc.seletor}); troque pelo de agora.` });
      if (exc.validade < cfg.hoje) travas.push({ tipo: 'excecao-vencida', item, excecao: exc });
      else excecoesUsadas.push({ item, excecao: exc });
      continue;
    }
    if (daBase.length) {
      const pares = m.pares.get(item);
      // Piorou: em alguma tela ou modo, o impacto de agora passou do que o item da base registrou ali.
      let antes = '';
      for (const [o, b] of pares) {
        const agora = impactoNoLugar(item, o);
        if (!IMPACTOS.includes(b.impacto) || !grave(agora, item.regra) || IMPACTOS.indexOf(agora) <= IMPACTOS.indexOf(b.impacto)) continue;
        if (!antes || IMPACTOS.indexOf(b.impacto) < IMPACTOS.indexOf(antes)) antes = b.impacto;
      }
      // O problema conhecido so e conhecido onde foi registrado. Em tela ou modo novo, e regressao.
      const lugaresNovos = item.onde.filter((o) => !pares.has(o) && grave(impactoNoLugar(item, o), item.regra));
      if (antes) {
        travas.push({ tipo: 'piorou', item, antes });
      } else if (lugaresNovos.length) {
        travas.push({ tipo: 'espalhou', item, lugaresNovos, lugaresAntes: [...new Set(daBase.flatMap((b) => (temOnde(b) ? b.onde : [])))] });
      } else {
        const antigos = [...new Set(daBase.map((b) => b.seletor))].filter((s) => s !== item.seletor);
        if (antigos.length) {
          mudaramDeSeletor += 1;
          if (!m.umParaUm(item)) soComGerar += 1;
        }
        jaExistiam.push({ ...item, ...governanca(daBase), ...(antigos.length ? { seletor_na_base: antigos.join(' | ') } : {}) });
      }
      continue;
    }
    if (grave(item.impacto, item.regra)) travas.push({ tipo: 'nova', item });
    else avisos.push({ tipo: 'abaixo-do-impacto', item });
  }

  for (const e of validas) {
    if (!usadas.has(e)) avisos.push({ tipo: 'excecao-sem-uso', excecao: e, motivo: 'nao cobre nenhum problema encontrado agora; pode sair do arquivo.' });
  }

  const resolvidos = base.filter((b) => !m.usados.has(b) && retestadoPorInteiro(b, rodadas));
  // O que foi resolvido agora nao cobra dono nem prazo: o prazo vencido nao pode travar o proprio conserto.
  const pendencias = pendenciasDaBase(base.filter((b) => !resolvidos.includes(b)), cfg.hoje);
  if (cfg.estrito) for (const p of pendencias) travas.push({ tipo: 'base-sem-governanca', item: p.item, motivo: p.problemas.join(', ') });

  return { travas, avisos, jaExistiam, excecoesUsadas, resolvidos, pendencias, mudaramDeSeletor, soComGerar };
}

const fmt = (i) => `  ${rotulo(i)}  ${i.regra}  ${i.seletor}  (${i.impacto}; em ${(i.onde || []).join(', ')})`;

function imprimir(cfg, r, revisar, capturas, nExec, nRoteiro) {
  const L = [];
  L.push(`Trava de acessibilidade: ${cfg.rotas.length} rota(s), ${nRoteiro} estado(s) de roteiro, ${nExec} execucao(oes), modos ${cfg.modos.join(', ')}, telas ${cfg.telas.join(', ')}.`);
  L.push(`Trava em: impacto ${cfg.impacto.join(', ')}${cfg.sempreTrava.length ? `, e sempre em ${cfg.sempreTrava.join(', ')}` : ''}. Regras: ${cfg.regras.join(', ')}.`);
  L.push(`Ja existiam (na linha de base): ${r.jaExistiam.length}.`);
  if (r.mudaramDeSeletor) {
    const como = r.soComGerar ? '--gerar-linha-de-base (o mesmo elemento tem um seletor em cada tela ou modo)' : '--limpar-resolvidos';
    L.push(`  ${r.mudaramDeSeletor} deles mudaram de seletor e foram reconhecidos pela posicao na pagina (xpath). Rode ${como} para gravar o seletor de agora na linha de base: dono e prazo ficam.`);
  }
  if (r.pendencias.length) {
    L.push(`Linha de base com pendencia de dono ou prazo: ${r.pendencias.length}${cfg.estrito ? ' (ESTRITO=1: trava)' : ' (use ESTRITO=1 para travar)'}.`);
    for (const p of r.pendencias.slice(0, 10)) L.push(`  ${rotulo(p.item)}  ${p.item.regra}  ${p.item.seletor}: ${p.problemas.join(', ')}`);
    if (r.pendencias.length > 10) L.push(`  ... e mais ${r.pendencias.length - 10} no relatorio.`);
  }
  if (r.excecoesUsadas.length) {
    L.push(`Excecoes em vigor: ${r.excecoesUsadas.length}.`);
    for (const u of r.excecoesUsadas) L.push(`${fmt(u.item)}\n    aprovada por ${u.excecao.aprovado_por} ate ${u.excecao.validade}: ${u.excecao.motivo}`);
  }
  if (r.avisos.length) {
    L.push(`Avisos: ${r.avisos.length}.`);
    for (const a of r.avisos) L.push(a.item ? `${fmt(a.item)}${a.motivo ? `\n    ${a.motivo}` : ''}` : `  excecao ${a.excecao.regra} ${a.excecao.seletor}: ${a.motivo}`);
  }
  if (r.resolvidos.length) {
    L.push(`Resolvidos (rode --limpar-resolvidos para tirar da linha de base): ${r.resolvidos.length}.`);
    for (const x of r.resolvidos.slice(0, 15)) L.push(`  ${rotulo(x)}  ${x.regra}  ${x.seletor}`);
    if (r.resolvidos.length > 15) L.push(`  ... e mais ${r.resolvidos.length - 15} no relatorio.`);
  }
  if (revisar.length) {
    L.push(`Para revisar a mao (nao trava): ${revisar.length}.`);
    for (const x of revisar.slice(0, 15)) L.push(`  ${rotulo(x)} (${x.onde}) ${x.regra}: ${x.descricao}${x.seletores.length ? `\n    ${x.seletores.join(' | ')}` : ''}`);
    if (revisar.length > 15) L.push(`  ... e mais ${revisar.length - 15} no relatorio.`);
  }
  if (capturas.length) L.push(`Capturas de tela: ${capturas.length}, em ${cfg.capturas}/.`);
  if (r.travas.length) {
    L.push('', `TRAVOU: ${r.travas.length} problema(s).`);
    for (const t of r.travas) {
      if (t.tipo === 'nova') L.push(`Novo e grave:\n${fmt(t.item)}\n    ${t.item.descricao}\n    ${t.item.ajuda}`);
      if (t.tipo === 'piorou') L.push(`Piorou (era ${t.antes} na linha de base):\n${fmt(t.item)}`);
      if (t.tipo === 'espalhou') L.push(`Apareceu em tela ou modo novo (${t.lugaresNovos.join(', ')}; na linha de base, so em ${t.lugaresAntes.join(', ')}):\n${fmt(t.item)}\n    Se a linha de base foi gerada sem essa tela ou modo, gere de novo: dono e prazo ficam.`);
      if (t.tipo === 'excecao-vencida') L.push(`Excecao vencida em ${t.excecao.validade}:\n${fmt(t.item)}`);
      if (t.tipo === 'excecao-invalida') L.push(`Excecao invalida (${t.motivo}): ${JSON.stringify(t.excecao)}`);
      if (t.tipo === 'base-sem-governanca') L.push(`Linha de base sem dono ou prazo valido (${t.motivo}):\n  ${rotulo(t.item)}  ${t.item.regra}  ${t.item.seletor}`);
    }
    L.push('', `Relatorio completo em ${cfg.arqRel}.`);
  } else {
    L.push('', `Passou: nenhuma falha nova de impacto ${cfg.impacto.join(' ou ')} nas rotas e modos testados.`);
    L.push('A maquina nao pega tudo. Teclado, leitor de tela e teste com gente continuam.');
  }
  console.log(L.join('\n'));
}

function resumoMarkdown(cfg, r, revisar) {
  const linhas = [
    '## Trava de acessibilidade',
    '',
    r.travas.length ? `**Travou: ${r.travas.length} problema(s).**` : '**Passou.** Nenhuma falha nova bloqueante nas rotas e modos testados.',
    '',
    '| Situacao | Quantidade |',
    '|---|---|',
    `| Trava | ${r.travas.length} |`,
    `| Ja existiam (linha de base) | ${r.jaExistiam.length} |`,
    `| Excecoes em vigor | ${r.excecoesUsadas.length} |`,
    `| Avisos | ${r.avisos.length} |`,
    `| Para revisar a mao | ${revisar.length} |`,
    `| Resolvidos | ${r.resolvidos.length} |`,
    '',
  ];
  if (r.travas.length) {
    linhas.push('| Rota | Regra | Seletor | Motivo |', '|---|---|---|---|');
    for (const t of r.travas) {
      const i = t.item || t.excecao || {};
      linhas.push(`| ${i.rota ? rotulo(i) : ''} | ${i.regra || ''} | \`${(i.seletor || '').replace(/\|/g, '\\|')}\` | ${t.tipo} |`);
    }
    linhas.push('');
  }
  linhas.push(`Impacto que trava: ${cfg.impacto.join(', ')}. Verde nao quer dizer acessivel: quer dizer que a maquina nao achou falha nova.`, '');
  return linhas.join('\n');
}

// Seletor antigo que uma excecao usa e o achado de agora nao: se ele sumisse da linha de base, a
// excecao deixaria de valer, mesmo vencida, e o item passaria calado.
const presoPorExcecao = (b, a, excecoes) => b.seletor !== a.seletor && excecoes.some((e) => cobre(e, b) && !cobre(e, a));

function gerarBase(achados, baseAtual, rodadas, excecoes) {
  // Achado que casou com a base ganha um item so, com o seletor de agora, e guarda dono, prazo e nota.
  const m = casarComBase(achados, baseAtual);
  const ocupadas = new Set(achados.map(chave));
  let presos = 0;
  const nova = achados.map((a) => {
    const velhos = m.daBase(a);
    // Tela ou modo antigo onde o problema nao apareceu agora so sai da lista se foi procurado de novo
    // ali (a regra rodou e o axe decidiu, pelo seletor antigo e pelo de agora) ou se outro achado casou
    // com ele ali. Senao, continua anotado.
    const antigos = [...new Set(velhos.flatMap((b) => (temOnde(b) ? b.onde : [])
      .filter((o) => !a.onde.includes(o) && !m.tomados.get(b).has(o) && !(retestadoEm(b, o, rodadas) && retestadoEm(a, o, rodadas)))))];
    let seletor = a.seletor;
    const preso = velhos.find((b) => presoPorExcecao(b, a, excecoes));
    if (preso && !ocupadas.has(chave({ ...a, seletor: preso.seletor }))) {
      seletor = preso.seletor;
      ocupadas.add(chave({ ...a, seletor }));
      presos += 1;
    }
    return {
      rota: a.rota, ...(a.estado ? { estado: a.estado } : {}), regra: a.regra, seletor, ...(a.xpath ? { xpath: a.xpath } : {}),
      impacto: a.impacto, onde: [...a.onde, ...antigos], ...governanca(velhos),
    };
  });
  // O que sumiu sem ser procurado de novo em todo lugar continua como estava.
  const naoRetestados = baseAtual.filter((b) => !m.usados.has(b) && !retestadoPorInteiro(b, rodadas));
  return {
    lista: [...nova, ...naoRetestados],
    mantidos: achados.filter((a) => m.daBase(a).length).length,
    novos: achados.filter((a) => !m.daBase(a).length).length,
    naoRetestados: naoRetestados.length,
    presos,
    divergentes: achados.filter((a) => m.daBase(a).length > 1 && governancaDivergente(m.daBase(a))).length,
  };
}

async function principal() {
  const cfg = lerConfig(process.env, process.argv.slice(2));
  const base = lerLista(cfg.arqBase, 'problemas que ja existiam', ['rota', 'regra', 'seletor']);
  const excecoes = lerLista(cfg.arqExc, 'excecoes', []);
  const roteiro = lerRoteiro(cfg.arqRoteiro);
  if (!cfg.rotas.length && !roteiro.length) throw new ErroDeConfig('nada para testar: ROTAS vazia e ROTEIRO sem estados.');
  const { achados, revisar, capturas, execucoes, rodadas, versaoAxe } = await auditar(cfg, roteiro);
  const avisoNaoRetestados = (n) => `${n} item(ns) sumiram sem ser procurados de novo em toda tela e modo onde apareciam (ou a regra nao rodou, ou o axe nao decidiu). Ficam na linha de base ate um teste completo.`;
  const avisoPresos = (n, depois) => `${n} item(ns) ficam com o seletor antigo porque uma excecao usa esse seletor. Troque o seletor na excecao pelo de agora e ${depois}.`;

  if (cfg.gerar) {
    const g = gerarBase(achados, base, rodadas, excecoes);
    writeFileSync(cfg.arqBase, JSON.stringify(g.lista, null, 2) + '\n');
    console.log(`Linha de base gravada em ${cfg.arqBase}: ${g.lista.length} problema(s) que ja existiam.`);
    console.log(`${g.mantidos} mantiveram dono e prazo; ${g.novos} entraram com "${PENDENTE}".`);
    if (g.presos) console.log(avisoPresos(g.presos, 'gere de novo'));
    if (g.divergentes) console.log(`${g.divergentes} item(ns) juntaram itens antigos com dono ou prazo diferentes: ficou o prazo mais curto, com o dono dele. Confira.`);
    if (g.naoRetestados) console.log(avisoNaoRetestados(g.naoRetestados));
    console.log('Cada item e uma tarefa: preencha dono e prazo antes de commitar.');
    return 0;
  }
  if (cfg.limpar) {
    const m = casarComBase(achados, base);
    const fica = base.filter((b) => m.usados.has(b) || !retestadoPorInteiro(b, rodadas));
    const naoRetestados = fica.filter((b) => !m.usados.has(b)).length;
    // Quem continua e mudou de seletor ou de posicao ganha o seletor e o xpath de agora; dono e prazo
    // ficam. So quando o achado e o item casam so um com o outro, e sem repetir um item que ja existe.
    let atualizados = 0;
    let presos = 0;
    let soComGerar = 0;
    for (const a of achados) {
      const velhos = m.daBase(a);
      if (!m.pares.get(a).size || velhos.every((b) => b.seletor === a.seletor && (b.xpath || '') === (a.xpath || ''))) continue;
      const [b] = velhos;
      if (!m.umParaUm(a) || (b.seletor !== a.seletor && fica.some((x) => x !== b && chave(x) === chave(a)))) {
        soComGerar += 1;
        continue;
      }
      if (presoPorExcecao(b, a, excecoes)) {
        presos += 1;
        continue;
      }
      b.seletor = a.seletor;
      // Elemento que foi para dentro de shadow DOM fica sem xpath: a posicao antiga poderia casar com outro.
      if (a.xpath) b.xpath = a.xpath;
      else delete b.xpath;
      atualizados += 1;
    }
    writeFileSync(cfg.arqBase, JSON.stringify(fica, null, 2) + '\n');
    console.log(`Linha de base: ${base.length - fica.length} resolvido(s) removido(s); ${fica.length} continuam${atualizados ? ` (${atualizados} com o seletor ou o xpath de agora)` : ''}. Nada novo foi adicionado.`);
    if (presos) console.log(avisoPresos(presos, 'rode de novo'));
    if (soComGerar) console.log(`${soComGerar} item(ns) mudaram de seletor de um jeito que esta opcao nao grava (por exemplo, o mesmo elemento com um seletor em cada tela ou modo). Rode --gerar-linha-de-base para gravar o seletor de agora: dono e prazo ficam.`);
    if (naoRetestados) console.log(avisoNaoRetestados(naoRetestados));
    return 0;
  }

  const r = classificar(cfg, achados, base, excecoes, rodadas);
  const relatorio = {
    data: cfg.hoje, axe_core: versaoAxe, base_url: cfg.baseUrl, rotas: cfg.rotas, modos: cfg.modos, telas: cfg.telas,
    impacto_que_trava: cfg.impacto, sempre_trava: cfg.sempreTrava, roteiro: roteiro.map((e) => ({ rota: e.rota, estado: e.estado })), regras: cfg.regras, execucoes, travou: r.travas.length > 0,
    travas: r.travas, avisos: r.avisos, ja_existiam: r.jaExistiam, pendencias_da_base: r.pendencias,
    excecoes_usadas: r.excecoesUsadas, resolvidos: r.resolvidos, para_revisar: revisar, capturas,
  };
  writeFileSync(cfg.arqRel, JSON.stringify(relatorio, null, 2) + '\n');
  imprimir(cfg, r, revisar, capturas, execucoes.length, roteiro.length);
  if (cfg.resumoGithub) appendFileSync(cfg.resumoGithub, resumoMarkdown(cfg, r, revisar));
  return r.travas.length ? 1 : 0;
}

try {
  process.exitCode = await principal();
} catch (e) {
  if (e instanceof ErroDeConfig) console.error(`Configuracao: ${e.message}`);
  else console.error(`A auditoria nao rodou: ${e.stack || e.message}`);
  process.exitCode = 2;
}
