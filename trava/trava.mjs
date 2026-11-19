#!/usr/bin/env node
// Trava de acessibilidade: roda o axe em cada rota e em tres modos de tela.
// Trava so o que e novo e grave. O que ja existia fica na linha de base,
// como tarefa com dono e prazo. Excecao precisa de quem aprovou, motivo e validade.
//
// Uso:
//   BASE_URL=http://localhost:4321 node trava.mjs
//   BASE_URL=http://localhost:4321 node trava.mjs --gerar-linha-de-base
//
// Variaveis:
//   BASE_URL       endereco do site (obrigatorio)
//   ROTAS          rotas separadas por virgula (padrao: /)
//   MODOS          normal,cores-forcadas,texto-200 (padrao: os tres)
//   IMPACTO        impactos que travam (padrao: critical). Ex.: critical,serious
//   LINHA_DE_BASE  arquivo da linha de base (padrao: linha-de-base.json)
//   EXCECOES       arquivo de excecoes (padrao: excecoes.json)
//   RELATORIO      arquivo do relatorio (padrao: trava-relatorio.json)
//   HOJE           data de referencia AAAA-MM-DD (padrao: hoje). Util para teste.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';

const env = process.env;
const BASE_URL = env.BASE_URL;
const ROTAS = (env.ROTAS || '/').split(',').map((r) => r.trim()).filter(Boolean);
const MODOS = (env.MODOS || 'normal,cores-forcadas,texto-200').split(',').map((m) => m.trim()).filter(Boolean);
const IMPACTO = (env.IMPACTO || 'critical').split(',').map((i) => i.trim());
const ARQ_BASE = env.LINHA_DE_BASE || 'linha-de-base.json';
const ARQ_EXC = env.EXCECOES || 'excecoes.json';
const ARQ_REL = env.RELATORIO || 'trava-relatorio.json';
const HOJE = env.HOJE || new Date().toISOString().slice(0, 10);
const GERAR = process.argv.includes('--gerar-linha-de-base');

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const MODOS_VALIDOS = ['normal', 'cores-forcadas', 'texto-200'];

function erroDeConfig(msg) {
  console.error(`Configuracao: ${msg}`);
  process.exit(2);
}

if (!BASE_URL) erroDeConfig('defina BASE_URL, por exemplo BASE_URL=http://localhost:4321');
for (const m of MODOS) if (!MODOS_VALIDOS.includes(m)) erroDeConfig(`modo desconhecido "${m}". Use ${MODOS_VALIDOS.join(', ')}.`);

function lerJson(arquivo, padrao) {
  if (!existsSync(arquivo)) return padrao;
  try {
    return JSON.parse(readFileSync(arquivo, 'utf8'));
  } catch (e) {
    erroDeConfig(`${arquivo} nao e um JSON valido (${e.message}).`);
  }
}

const chave = (x) => `${x.rota}|${x.regra}|${x.seletor}`;

async function prepararModo(pagina, modo) {
  if (modo === 'cores-forcadas') await pagina.emulateMedia({ forcedColors: 'active' });
  else await pagina.emulateMedia({ forcedColors: 'none' });
  if (modo === 'texto-200') {
    // Aproximacao do texto a 200%: dobra o tamanho base da fonte.
    await pagina.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  }
}

async function auditar() {
  const navegador = await chromium.launch();
  const achados = new Map();
  try {
    for (const rota of ROTAS) {
      for (const modo of MODOS) {
        const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 } });
        const pagina = await contexto.newPage();
        const url = new URL(rota, BASE_URL).toString();
        const resp = await pagina.goto(url, { waitUntil: 'load' });
        if (!resp || !resp.ok()) {
          await contexto.close();
          erroDeConfig(`${url} respondeu ${resp ? resp.status() : 'sem resposta'}.`);
        }
        await prepararModo(pagina, modo);
        const resultado = await new AxeBuilder({ page: pagina }).withTags(TAGS).analyze();
        for (const v of resultado.violations) {
          for (const no of v.nodes) {
            const item = {
              rota,
              regra: v.id,
              seletor: no.target.flat().join(' '),
              impacto: no.impact || v.impact || 'desconhecido',
              ajuda: v.helpUrl,
            };
            const k = chave(item);
            const atual = achados.get(k);
            if (atual) {
              if (!atual.modos.includes(modo)) atual.modos.push(modo);
            } else {
              achados.set(k, { ...item, modos: [modo] });
            }
          }
        }
        await contexto.close();
      }
    }
  } finally {
    await navegador.close();
  }
  return [...achados.values()];
}

function validarExcecao(e) {
  const faltando = ['regra', 'seletor', 'motivo', 'aprovado_por', 'validade'].filter((c) => !e[c]);
  if (faltando.length) return `faltam campos: ${faltando.join(', ')}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.validade)) return 'validade precisa ser AAAA-MM-DD';
  return null;
}

function cobre(e, item) {
  return e.regra === item.regra && e.seletor === item.seletor && (!e.rota || e.rota === item.rota);
}

let achados;
try {
  achados = await auditar();
} catch (e) {
  console.error(`A auditoria nao rodou: ${e.message}`);
  process.exit(2);
}

if (GERAR) {
  const base = achados.map(({ rota, regra, seletor, impacto }) => ({
    rota, regra, seletor, impacto, dono: '[definir]', prazo: '[definir]',
  }));
  writeFileSync(ARQ_BASE, JSON.stringify(base, null, 2) + '\n');
  console.log(`Linha de base gravada em ${ARQ_BASE}: ${base.length} problemas que ja existiam.`);
  console.log('Cada um vira tarefa: preencha dono e prazo antes de commitar.');
  process.exit(0);
}

const base = lerJson(ARQ_BASE, []);
const excecoes = lerJson(ARQ_EXC, []);
const naBase = new Set(base.map(chave));

const travas = [];
const jaExistiam = [];
const excecoesUsadas = [];
const avisos = [];

for (const e of excecoes) {
  const problema = validarExcecao(e);
  if (problema) travas.push({ tipo: 'excecao-invalida', excecao: e, motivo: problema });
}

for (const item of achados) {
  if (naBase.has(chave(item))) {
    jaExistiam.push(item);
    continue;
  }
  const exc = excecoes.find((e) => !validarExcecao(e) && cobre(e, item));
  if (exc) {
    if (exc.validade < HOJE) {
      travas.push({ tipo: 'excecao-vencida', item, excecao: exc });
    } else {
      excecoesUsadas.push({ item, excecao: exc });
    }
    continue;
  }
  if (IMPACTO.includes(item.impacto)) travas.push({ tipo: 'nova', item });
  else avisos.push(item);
}

const encontrados = new Set(achados.map(chave));
const resolvidos = base.filter((b) => !encontrados.has(chave(b)));

const relatorio = { data: HOJE, base_url: BASE_URL, rotas: ROTAS, modos: MODOS, impacto_que_trava: IMPACTO,
  travou: travas.length > 0, travas, avisos, ja_existiam: jaExistiam, excecoes_usadas: excecoesUsadas, resolvidos };
writeFileSync(ARQ_REL, JSON.stringify(relatorio, null, 2) + '\n');

const linha = (i) => `  ${i.rota}  ${i.regra}  ${i.seletor}  (${i.impacto}; modos: ${(i.modos || []).join(', ')})`;

console.log(`Trava de acessibilidade: ${ROTAS.length} rota(s), modos ${MODOS.join(', ')}.`);
console.log(`Ja existiam (na linha de base): ${jaExistiam.length}.`);
if (excecoesUsadas.length) {
  console.log(`Excecoes em vigor: ${excecoesUsadas.length}.`);
  for (const u of excecoesUsadas) console.log(`${linha(u.item)}\n    aprovada por ${u.excecao.aprovado_por} ate ${u.excecao.validade}: ${u.excecao.motivo}`);
}
if (avisos.length) {
  console.log(`Avisos (novos, abaixo do impacto que trava): ${avisos.length}.`);
  for (const a of avisos) console.log(linha(a));
}
if (resolvidos.length) {
  console.log(`Resolvidos (podem sair da linha de base): ${resolvidos.length}.`);
  for (const r of resolvidos) console.log(`  ${r.rota}  ${r.regra}  ${r.seletor}`);
}
if (travas.length) {
  console.log(`\nTRAVOU: ${travas.length} problema(s).`);
  for (const t of travas) {
    if (t.tipo === 'nova') console.log(`Novo e grave:\n${linha(t.item)}\n    ${t.item.ajuda}`);
    if (t.tipo === 'excecao-vencida') console.log(`Excecao vencida em ${t.excecao.validade}:\n${linha(t.item)}`);
    if (t.tipo === 'excecao-invalida') console.log(`Excecao invalida (${t.motivo}): ${JSON.stringify(t.excecao)}`);
  }
  console.log(`\nRelatorio completo em ${ARQ_REL}.`);
  process.exit(1);
}
console.log('\nPassou. Verde quer dizer: a maquina nao achou erro novo. O teste com gente continua.');
