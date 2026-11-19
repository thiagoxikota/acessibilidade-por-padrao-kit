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
    estrito: env.ESTRITO === '1',
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
  try {
    new URL(cfg.baseUrl);
  } catch {
    throw new ErroDeConfig(`BASE_URL invalida: "${cfg.baseUrl}".`);
  }
  if (!cfg.rotas.length && !cfg.arqRoteiro) throw new ErroDeConfig('ROTAS esta vazia. Sem rota, nada e testado e o verde seria falso.');
  for (const r of cfg.rotas) if (!r.startsWith('/')) throw new ErroDeConfig(`rota "${r}" precisa comecar com /.`);
  if (!cfg.modos.length) throw new ErroDeConfig('MODOS esta vazio.');
  for (const m of cfg.modos) if (!MODOS_VALIDOS.includes(m)) throw new ErroDeConfig(`modo desconhecido "${m}". Use ${MODOS_VALIDOS.join(', ')}.`);
  if (!cfg.telas.length) throw new ErroDeConfig('TELAS esta vazia.');
  for (const t of cfg.telas) if (!TELAS[t]) throw new ErroDeConfig(`tela desconhecida "${t}". Use ${Object.keys(TELAS).join(', ')}.`);
  if (!cfg.impacto.length) throw new ErroDeConfig('IMPACTO esta vazio. Sem impacto, nada trava e o verde seria falso.');
  for (const i of cfg.impacto) if (!IMPACTOS.includes(i)) throw new ErroDeConfig(`impacto desconhecido "${i}". Use ${IMPACTOS.join(', ')} (nomes do axe, em ingles).`);
  if (!cfg.regras.length) throw new ErroDeConfig('REGRAS esta vazia.');
  if (!ESPERAS.includes(cfg.espera)) throw new ErroDeConfig(`ESPERA desconhecida "${cfg.espera}". Use ${ESPERAS.join(', ')}.`);
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
    if (!e.rota.startsWith('/')) throw new ErroDeConfig(`${arquivo}, item ${i + 1}: rota precisa comecar com /.`);
    if (!Array.isArray(e.acoes) || !e.acoes.length) throw new ErroDeConfig(`${arquivo}, item ${i + 1}: "acoes" precisa ser uma lista com pelo menos uma acao.`);
    e.acoes.forEach((a, j) => {
      const tipos = a && typeof a === 'object' ? Object.keys(a).filter((k) => ACOES.includes(k)) : [];
      if (tipos.length !== 1) throw new ErroDeConfig(`${arquivo}, item ${i + 1}, acao ${j + 1}: use exatamente uma de ${ACOES.join(', ')}.`);
      if (tipos[0] === 'preencher' && typeof a.texto !== 'string') throw new ErroDeConfig(`${arquivo}, item ${i + 1}, acao ${j + 1}: "preencher" precisa de "texto".`);
    });
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
      throw new ErroDeConfig(`roteiro "${alvo.estado}" em ${alvo.rota}: nao conseguiu ${tipo} "${valor}" (${e.message.split('\n')[0]}).`);
    }
  }
}

const chave = (x) => `${x.rota}|${x.estado || ''}|${x.regra}|${x.seletor}`;
const rotulo = (x) => `${x.rota}${x.estado ? ` [${x.estado}]` : ''}`;
const pior = (a, b) => (IMPACTOS.indexOf(a) >= IMPACTOS.indexOf(b) ? a : b);

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
      const cortados = [...document.body.querySelectorAll('*')].filter((el) => {
        const temTexto = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!temTexto) return false;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') return false;
        if (el.clientWidth <= 1 || el.clientHeight <= 1) return false; // texto so para leitor de tela
        if (cs.clip !== 'auto' && cs.clip !== '') return false;
        const escondeX = ['hidden', 'clip'].includes(cs.overflowX);
        const escondeY = ['hidden', 'clip'].includes(cs.overflowY);
        return (escondeX && el.scrollWidth > el.clientWidth + 1) || (escondeY && el.scrollHeight > el.clientHeight + 1);
      });
      if (cortados.length) {
        sinais.push({
          sinal: 'texto-cortado',
          criterio: 'WCAG 1.4.4 Resize Text',
          descricao: `Com o texto ampliado, ${cortados.length} elemento(s) cortam o proprio conteudo (overflow escondido).`,
          seletores: cortados.slice(0, 5).map(seletor),
        });
      }
    }
    return sinais;
  }, modo);
}

async function auditar(cfg, roteiro) {
  let chromium;
  let AxeBuilder;
  try {
    ({ chromium } = await import('playwright'));
    ({ AxeBuilder } = await import('@axe-core/playwright'));
  } catch (e) {
    throw new ErroDeConfig(`dependencias ausentes (${e.message}). Rode npm install e npx playwright install chromium.`);
  }
  if (cfg.capturas && cfg.capturas !== '0') mkdirSync(cfg.capturas, { recursive: true });
  const navegador = await chromium.launch();
  const achados = new Map();
  const revisar = [];
  const capturas = [];
  const execucoes = [];
  try {
    for (const c of combinacoes(cfg, roteiro)) {
      const viewport = c.modo === 'largura-320' ? { width: 320, height: 640 } : TELAS[c.tela];
      const contexto = await navegador.newContext({
        viewport,
        forcedColors: c.modo === 'cores-forcadas' ? 'active' : 'none',
      });
      try {
        const pagina = await contexto.newPage();
        const url = new URL(c.rota, cfg.baseUrl).toString();
        let resp;
        try {
          resp = await pagina.goto(url, { waitUntil: cfg.espera, timeout: 45000 });
        } catch (e) {
          throw new ErroDeConfig(`nao abriu ${url} (${e.message.split('\n')[0]}).`);
        }
        if (!resp || !resp.ok()) throw new ErroDeConfig(`${url} respondeu ${resp ? resp.status() : 'sem resposta'}.`);
        if (c.acoes.length) await executarAcoes(pagina, c);
        if (c.modo === 'texto-200') {
          // Aproximacao: dobra o tamanho base da fonte. Texto em px nao cresce; veja o README.
          await pagina.addStyleTag({ content: 'html { font-size: 200% !important; }' });
        }
        const resultado = await new AxeBuilder({ page: pagina }).withTags(cfg.regras).analyze();
        execucoes.push({ rota: c.rota, estado: c.estado, tela: c.tela, modo: c.modo, url });
        for (const v of resultado.violations) {
          for (const no of v.nodes) {
            const item = {
              rota: c.rota,
              estado: c.estado,
              regra: v.id,
              seletor: no.target.flat(Infinity).join(' '),
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
            } else {
              achados.set(k, { ...item, onde: [onde] });
            }
          }
        }
        for (const inc of resultado.incomplete) {
          revisar.push({
            rota: c.rota, estado: c.estado, onde: `${c.tela}/${c.modo}`, tipo: 'axe-incompleto', regra: inc.id,
            descricao: `${inc.help} (o axe nao conseguiu decidir)`, seletores: inc.nodes.slice(0, 5).map((n) => n.target.flat(Infinity).join(' ')),
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
  return { achados: [...achados.values()], revisar, capturas, execucoes };
}

function validarExcecao(e) {
  const faltando = ['regra', 'seletor', 'motivo', 'aprovado_por', 'validade'].filter((c) => typeof e[c] !== 'string' || !e[c].trim());
  if (faltando.length) return `faltam campos: ${faltando.join(', ')}`;
  if (!dataValida(e.validade)) return `validade "${e.validade}" nao e uma data real no formato AAAA-MM-DD`;
  return null;
}

const cobre = (e, item) => e.regra === item.regra && e.seletor === item.seletor
  && (!e.rota || e.rota === item.rota) && (e.estado === undefined || e.estado === (item.estado || ''));

function pendenciasDaBase(base, hoje) {
  const out = [];
  for (const b of base) {
    const problemas = [];
    if (!b.dono || b.dono === PENDENTE) problemas.push('sem dono');
    if (!b.prazo || b.prazo === PENDENTE) problemas.push('sem prazo');
    else if (!dataValida(b.prazo)) problemas.push(`prazo invalido "${b.prazo}"`);
    else if (b.prazo < hoje) problemas.push(`prazo vencido em ${b.prazo}`);
    if (problemas.length) out.push({ item: b, problemas });
  }
  return out;
}

function noEscopo(b, execucoes) {
  // So da para dizer "resolvido" se a rota e algum dos modos onde o item aparecia rodaram agora.
  const rodou = execucoes.filter((x) => x.rota === b.rota && x.estado === (b.estado || ''));
  if (!rodou.length) return false;
  if (!Array.isArray(b.onde) || !b.onde.length) return true;
  return b.onde.some((o) => rodou.some((x) => `${x.tela}/${x.modo}` === o));
}

function classificar(cfg, achados, base, excecoes, execucoes) {
  const travas = [];
  const avisos = [];
  const jaExistiam = [];
  const excecoesUsadas = [];
  const usadas = new Set();
  const baseIdx = new Map(base.map((b) => [chave(b), b]));

  excecoes.forEach((e, i) => {
    const problema = validarExcecao(e);
    if (problema) travas.push({ tipo: 'excecao-invalida', excecao: e, motivo: `item ${i + 1}: ${problema}` });
  });
  const validas = excecoes.filter((e) => !validarExcecao(e));

  for (const item of achados) {
    // Excecao vem primeiro: uma excecao vencida trava mesmo que o item esteja na linha de base.
    const casadas = validas.filter((e) => cobre(e, item));
    if (casadas.length) {
      const exc = casadas.reduce((a, b) => (a.validade <= b.validade ? a : b));
      casadas.forEach((e) => usadas.add(e));
      if (casadas.length > 1) avisos.push({ tipo: 'excecao-duplicada', item, motivo: `${casadas.length} excecoes cobrem o mesmo problema; vale a de validade mais curta.` });
      if (exc.validade < cfg.hoje) travas.push({ tipo: 'excecao-vencida', item, excecao: exc });
      else excecoesUsadas.push({ item, excecao: exc });
      continue;
    }
    const naBase = baseIdx.get(chave(item));
    if (naBase) {
      const antes = IMPACTOS.includes(naBase.impacto) ? naBase.impacto : item.impacto;
      if (IMPACTOS.indexOf(item.impacto) > IMPACTOS.indexOf(antes) && (cfg.impacto.includes(item.impacto) || cfg.sempreTrava.includes(item.regra))) {
        travas.push({ tipo: 'piorou', item, antes });
      } else {
        jaExistiam.push({ ...item, dono: naBase.dono, prazo: naBase.prazo });
      }
      continue;
    }
    if (cfg.impacto.includes(item.impacto) || cfg.sempreTrava.includes(item.regra)) travas.push({ tipo: 'nova', item });
    else avisos.push({ tipo: 'abaixo-do-impacto', item });
  }

  for (const e of validas) {
    if (!usadas.has(e)) avisos.push({ tipo: 'excecao-sem-uso', excecao: e, motivo: 'nao cobre nenhum problema encontrado agora; pode sair do arquivo.' });
  }

  const encontrados = new Set(achados.map(chave));
  const resolvidos = base.filter((b) => !encontrados.has(chave(b)) && noEscopo(b, execucoes));
  const pendencias = pendenciasDaBase(base, cfg.hoje);
  if (cfg.estrito) for (const p of pendencias) travas.push({ tipo: 'base-sem-governanca', item: p.item, motivo: p.problemas.join(', ') });

  return { travas, avisos, jaExistiam, excecoesUsadas, resolvidos, pendencias };
}

const fmt = (i) => `  ${rotulo(i)}  ${i.regra}  ${i.seletor}  (${i.impacto}; em ${(i.onde || []).join(', ')})`;

function imprimir(cfg, r, revisar, capturas, nExec, nRoteiro) {
  const L = [];
  L.push(`Trava de acessibilidade: ${cfg.rotas.length} rota(s), ${nRoteiro} estado(s) de roteiro, ${nExec} execucao(oes), modos ${cfg.modos.join(', ')}, telas ${cfg.telas.join(', ')}.`);
  L.push(`Trava em: impacto ${cfg.impacto.join(', ')}${cfg.sempreTrava.length ? `, e sempre em ${cfg.sempreTrava.join(', ')}` : ''}. Regras: ${cfg.regras.join(', ')}.`);
  L.push(`Ja existiam (na linha de base): ${r.jaExistiam.length}.`);
  if (r.pendencias.length) {
    L.push(`Linha de base com pendencia de dono ou prazo: ${r.pendencias.length}${cfg.estrito ? ' (ESTRITO=1: trava)' : ' (use ESTRITO=1 para travar)'}.`);
    for (const p of r.pendencias.slice(0, 10)) L.push(`  ${rotulo(p.item)}  ${p.item.regra}  ${p.item.seletor}: ${p.problemas.join(', ')}`);
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
    for (const x of r.resolvidos) L.push(`  ${rotulo(x)}  ${x.regra}  ${x.seletor}`);
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

function gerarBase(cfg, achados, baseAtual, execucoes) {
  const antiga = new Map(baseAtual.map((b) => [chave(b), b]));
  const nova = achados.map((a) => {
    const velho = antiga.get(chave(a));
    return {
      rota: a.rota, ...(a.estado ? { estado: a.estado } : {}), regra: a.regra, seletor: a.seletor, impacto: a.impacto, onde: a.onde,
      dono: velho?.dono || PENDENTE, prazo: velho?.prazo || PENDENTE, ...(velho?.nota ? { nota: velho.nota } : {}),
    };
  });
  // Itens fora do escopo desta execucao continuam como estavam.
  const foraDoEscopo = baseAtual.filter((b) => !noEscopo(b, execucoes) && !nova.some((n) => chave(n) === chave(b)));
  return { lista: [...nova, ...foraDoEscopo], preservados: nova.filter((n) => antiga.has(chave(n))).length, novos: nova.filter((n) => !antiga.has(chave(n))).length };
}

async function principal() {
  const cfg = lerConfig(process.env, process.argv.slice(2));
  const base = lerLista(cfg.arqBase, 'problemas que ja existiam', ['rota', 'regra', 'seletor']);
  const excecoes = lerLista(cfg.arqExc, 'excecoes', []);
  const roteiro = lerRoteiro(cfg.arqRoteiro);
  if (!cfg.rotas.length && !roteiro.length) throw new ErroDeConfig('nada para testar: ROTAS vazia e ROTEIRO sem estados.');
  const { achados, revisar, capturas, execucoes } = await auditar(cfg, roteiro);

  if (cfg.gerar) {
    const g = gerarBase(cfg, achados, base, execucoes);
    writeFileSync(cfg.arqBase, JSON.stringify(g.lista, null, 2) + '\n');
    console.log(`Linha de base gravada em ${cfg.arqBase}: ${g.lista.length} problema(s) que ja existiam.`);
    console.log(`${g.preservados} mantiveram dono e prazo; ${g.novos} entraram com "${PENDENTE}".`);
    console.log('Cada item e uma tarefa: preencha dono e prazo antes de commitar.');
    return 0;
  }
  if (cfg.limpar) {
    const encontrados = new Set(achados.map(chave));
    const fica = base.filter((b) => encontrados.has(chave(b)) || !noEscopo(b, execucoes));
    writeFileSync(cfg.arqBase, JSON.stringify(fica, null, 2) + '\n');
    console.log(`Linha de base: ${base.length - fica.length} resolvido(s) removido(s); ${fica.length} continuam. Nada novo foi adicionado.`);
    return 0;
  }

  const r = classificar(cfg, achados, base, excecoes, execucoes);
  const relatorio = {
    data: cfg.hoje, base_url: cfg.baseUrl, rotas: cfg.rotas, modos: cfg.modos, telas: cfg.telas,
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
