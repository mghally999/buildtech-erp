// The scope chain, lifted verbatim from index.html by function name, run against the
// stored text of the production BOQ with the real catalogue and equivalents.
const fs = require('fs');
const lines = fs.readFileSync('/Users/amu/Documents/buildtech2026.09.10e/index.html', 'utf8').split('\n');
const at = re => { const i = lines.findIndex(l => re.test(l)); if (i < 0) throw new Error('marker not found: ' + re); return i; };
const block = (startRe, endRe) => lines.slice(at(startRe), at(endRe)).join('\n');
let code = '';
code += block(/^const num = v =>/, /^const money = /) + '\n';
code += block(/^const normName = s =>/, /^function rollM2/) + '\n';          // normName, numOf, parseConsumption
code += block(/^const BOLD_MARK = /, /^function toggleBoldSelection/) + '\n'; // BOLD_MARK, richText (uses html; unused), plainText
code = code.replace(/return html`[\s\S]*?<\/\$\{Frag\}>`;/, 'return s;');    // richText never called here
code += block(/^const BOQ_ROLE = /, /^const xmlText = /) + '\n';
code += block(/^const SCOPE_UNITS = /, /^\/\* ── matching/) + '\n';
code += block(/^const scopeTokens = /, /^\/\* ── the draft/) + '\n';
code += block(/^function buildDraft/, /^\/\* ── the screen/) + '\n';
// the editor's costing closure, with its free variables supplied
code += 'const BUILD_VERSION="test"; let cat=[]; let settings=[]; const cfg=k=>settings.find(s=>s.key===k)?.value||""; const rate=4.27; const qCur="AED";\n';
code += 'function editor(){\n' + block(/^  const coverageOf = p =>/, /^  \/\/ Once per line, and never again/) + '\n';
code += block(/^  const catKeys = \(\(\)=>\{/, /^  \/\/ sell that carries the margin/) + '\n';
code += 'return {sectionCost, lineCostDetail, findProduct, packCost, packList};}\n';
code += 'module.exports={parseScope,buildMatcher,matchItem,buildDraft,sectionTitle,editor,setCat:(c,s)=>{cat=c;settings=s;}};';
fs.writeFileSync('scope_engine.js', code);
const eng = require('./scope_engine.js');
const J = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const products = J('schema/seed/products.json'), packs = J('schema/seed/product_packs.json'), aliases = J('schema/seed/product_aliases.json');
products.forEach(p => { p.product_packs = packs.filter(k => k.product_id === p.id); p.product_aliases = aliases.filter(a => a.product_id === p.id).map(a => ({alias: a.alias})); });
const equivalents = J('schema/seed/spec_equivalents.json');
const settings = J('schema/seed/settings.json');
eng.setCat(products, settings);
const ed = eng.editor();
const matcher = eng.buildMatcher(products, equivalents, []);
const docs = J('schema/scope_doc.json');
for (const d of docs) {
  console.log('\n==================', d.file_name, '==================');
  const parsed = eng.parseScope(d.extracted);
  console.log('title:', JSON.stringify(parsed.title), '| client:', JSON.stringify(parsed.client));
  console.log('items:', parsed.items.length, '| notes:', parsed.notes.length, '| unread:', parsed.unread.length);
  const matched = parsed.items.map(it => eng.matchItem(it, matcher));
  matched.forEach(it => {
    console.log(`\n  #${it.no} qty=${it.qty} ${it.unit}${it.group ? ' [' + it.group.slice(0, 30) + ']' : ''} :: ${it.text.slice(0, 80)}`);
    console.log('     works:', it.works, '| settled:', it.settled, '| gaps:', it.gaps.map(g => g.why.slice(0, 70)));
    it.parts.forEach(p => console.log('     layer:', JSON.stringify(p.label.slice(0, 40)), '→', p.pick ? `${p.pick.kind}/${p.pick.confidence} ${products.find(x => x.id === p.pick.product_id)?.name || '(no product)'}` : 'nothing', p.pick ? '|' + p.pick.why.slice(0, 80) : ''));
  });
  const draft = eng.buildDraft(parsed, matched, {products});
  console.log('\n  DRAFT SECTIONS:');
  draft.secs.forEach(s => {
    const cost = ed.sectionCost(s);
    console.log(`   ▸ ${JSON.stringify(s.title)}`);
    s.lines.forEach(l => console.log(`       ${l.is_spec_note ? (l.is_bold ? 'SPEC*' : 'spec ') : 'PRICE'} ${l.unit || ''} ${l.quantity || ''} :: ${String(l.description).slice(0, 95)}`));
    console.log(`       auto-cost per unit of the priced line: ${cost.any ? cost.perM2.toFixed(2) + ' AED  from ' + cost.used.join(' ; ') : '(none)'}${cost.missed.length ? ' | missed: ' + cost.missed.join('; ') : ''}`);
  });
  console.log('  notes into remarks:', draft.notes.length);
}
