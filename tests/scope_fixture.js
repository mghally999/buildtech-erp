// The Waterfront Market BOQ, every line of it, against a hand-checked fixture.
//
//   node tests/scope_fixture.js            compare index.html's reader with the fixture
//   node tests/scope_fixture.js --write    rewrite the fixture from the current reader
//                                          (only after checking every line by hand)
//
// The fixture is tests/fixtures/waterfront-boq.expected.json. Both the DOCX and the PDF
// reading of the same bill are in it; they must come out the same.
const fs = require('fs');
const path = require('path');
const { build, draftOf } = require('./scope_engine');

const FIX = path.join(__dirname, 'fixtures', 'waterfront-boq.expected.json');
const b = build();
const got = {};
b.docs.forEach(d => { got[d.file_name] = draftOf(b, d.extracted); });

if (process.argv.includes('--write')) {
  fs.mkdirSync(path.dirname(FIX), { recursive: true });
  fs.writeFileSync(FIX, JSON.stringify({
    _hand_checked: 'Every section, quantity, unit, product line, consumption and internal note checked by hand against '
      + '4.BOQ and Spec - Meat and F&V Market floor (.docx and .pdf) on 10 September 2026. Rewrite only after checking again.',
    ...got }, null, 2) + '\n');
  console.log('fixture written:', FIX); process.exit(0);
}

let fails = 0;
// Rows numbered 1.1 or A, and a Belgian quantity, read as rows (F-069 g)
const synth = b.eng.parseScope('No.\tDescription\tQuantity\tUnit\n1.1\tSupply and apply of PU membrane\t28.153,00\tm2\n1.2\tSupply and apply of topcoat\t424,8\tm2\nA\tExpansion joint\t3\tnr');
const ok = (c, m) => { if (!c) { fails++; console.log('  ✗', m); } else console.log('  ✓', m); };
console.log('▶ numbering and decimals');
ok(synth.items.length === 3 && synth.unread.length === 0, `three rows read, none unread (saw ${synth.items.length} / ${synth.unread.length})`);
ok(synth.items[0] && synth.items[0].qty === 28153 && synth.items[0].label === '1.1', `"28.153,00" under item 1.1 is 28153 (saw ${synth.items[0] && synth.items[0].qty})`);
ok(synth.items[1] && synth.items[1].qty === 424.8, `"424,8" is 424.8 (saw ${synth.items[1] && synth.items[1].qty})`);
ok(synth.items[2] && synth.items[2].label === 'A' && synth.items[2].unit === 'nr', 'item A in nr is read');

const want = JSON.parse(fs.readFileSync(FIX, 'utf8'));
const diff = (p, a, e) => {
  if (Array.isArray(e) || (e && typeof e === 'object')) {
    if (typeof a !== typeof e || Array.isArray(a) !== Array.isArray(e)) { fails++; return console.log('  ✗', p, 'shape differs'); }
    const keys = new Set([...Object.keys(e), ...Object.keys(a)]);
    keys.forEach(k => diff(p + (Array.isArray(e) ? '[' + k + ']' : '.' + k), a[k], e[k]));
  } else if (a !== e) { fails++; console.log('  ✗', p, '\n      expected:', JSON.stringify(e), '\n      got:     ', JSON.stringify(a)); }
};
Object.keys(want).filter(k => !k.startsWith('_')).forEach(file => {
  console.log('▶', file);
  if (!got[file]) { fails++; return console.log('  ✗ not in docs/schema/scope_doc.json'); }
  diff(file, got[file], want[file]);
  const n = want[file].sections.length;
  console.log(`  ${n} sections, ${want[file].notes.length} notes, ${want[file].internal.length} internal notes checked`);
});
console.log(fails ? `\nFAILED ${fails} difference(s) from the hand-checked fixture` : '\nevery line matches the hand-checked fixture');
process.exit(fails ? 1 : 0);
