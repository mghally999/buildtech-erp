// The scope chain, lifted verbatim from index.html by function name so it can run under
// node against the stored text of the production BOQ with the real catalogue and
// equivalents. Nothing here is a copy: if index.html changes, this changes with it.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'out');

function build() {
  const lines = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').split('\n');
  const at = re => { const i = lines.findIndex(l => re.test(l)); if (i < 0) throw new Error('marker not found: ' + re); return i; };
  const block = (startRe, endRe) => lines.slice(at(startRe), at(endRe)).join('\n');
  let code = '';
  code += block(/^const settingNumber = /, /^const daysSince/) + '\n';
  code += block(/^const num = v =>/, /^const money = /) + '\n';
  code += block(/^const normName = s =>/, /^function rollM2/) + '\n';          // normName, numOf, parseConsumption
  code += block(/^const BOLD_MARK = /, /^function toggleBoldSelection/) + '\n'; // BOLD_MARK, richText (unused), plainText
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
  code += 'module.exports={parseScope,buildMatcher,matchItem,buildDraft,sectionTitle,isAreaUnit,readThickness,perMmOf,editor,'
    + 'unitAsWritten,sheetNum,looksLikeQuotationSheet,parseQuotationSheet,draftFromSheet,setCat:(c,s)=>{cat=c;settings=s;}};';
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, 'scope_engine_built.js');
  fs.writeFileSync(file, code);
  const eng = require(file);

  const J = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'docs', f), 'utf8'));
  const products = J('schema/seed/products.json'), packs = J('schema/seed/product_packs.json'), aliases = J('schema/seed/product_aliases.json');
  products.forEach(p => { p.product_packs = packs.filter(k => k.product_id === p.id); p.product_aliases = aliases.filter(a => a.product_id === p.id).map(a => ({ alias: a.alias })); });
  const equivalents = J('schema/seed/spec_equivalents.json');
  const settings = J('schema/seed/settings.json');
  eng.setCat(products, settings);
  const ed = eng.editor();
  const matcher = eng.buildMatcher(products, equivalents, []);
  const docs = J('schema/scope_doc.json');
  return { eng, ed, matcher, products, docs };
}

// One document through the whole chain, reduced to what a person would check by hand.
function draftOf(b, text) {
  const { eng, ed, matcher, products } = b;
  const parsed = eng.parseScope(text);
  const matched = parsed.items.map(it => eng.matchItem(it, matcher));
  const draft = eng.buildDraft(parsed, matched, { products });
  return {
    title: parsed.title, client: parsed.client, ref: parsed.ref,
    items: parsed.items.length, unread: parsed.unread.length,
    notes: parsed.notes, boilerplateDropped: parsed.boilerplate.length > 0,
    sections: draft.secs.map(s => {
      const priced = s.lines.find(l => !l.is_spec_note);
      const cost = ed.sectionCost(s);
      return {
        title: s.title,
        priced: { description: priced.description, unit: priced.unit, qty: priced.quantity },
        spec: s.lines.filter(l => l.is_spec_note && l.description).map(l => (l.is_bold ? '**' : '') + l.description),
        // the products' cost per square metre, and whether the editor may put it on the line
        perM2: cost.any ? Math.round(cost.perM2 * 100) / 100 : null,
        applies: cost.any && eng.isAreaUnit(priced.unit),
      };
    }),
    internal: draft.internal,
  };
}

module.exports = { build, draftOf };
