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
      + '4.BOQ and Spec - Meat and F&V Market floor (.docx and .pdf) on 10 September 2026. On 14 September 2026 the units '
      + 'became the ones the bill writes (m², LM, LS rather than sq.m, lm, item) and the tender reference its bare number, '
      + 'checked again against the same documents. Rewrite only after checking again.',
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

// One of our own quotation sheets (tenders 7089 and 7090), made up so no client's prices sit in the
// repo: Belgian figures, bold kept as **, a section headed OPTIONAL that the sheet counts and one it
// leaves out, a lump sum, a tender reference and an empty tax row.
const HEAD = '**Description**\t**Unit**\t**Qté**\t**Prix unit. (AED)**\t**Total Price (AED)**';
const SHEET = [
  '**QUOTATION**', '**Project :**\t\t\t\t0999 BT', '**Reference**\t\t\t\tRoof - Waterproof', '**Date :**\t\t\t\t03/02/2027',
  '**Company:**\t\t\t\t**BUILD-TECH PRO B.V**', '**Adresse :**\t\t\t\tDubai Maritime City - MBC - 1', '**TL**\t\t\t\t1411354',
  '**For**\t\t\t\tExample Trading LLC', '**Adresse :**\t\t\t\tP O Box: 1234, Dubai, UAE', '**Tender Ref.**\t\t\t\t**4242**',
  '\t\t\t\t**1. Roof**', HEAD,
  'Supply and apply of PU membrane\tm²\t1.250,00\t80,00\t100.000,00 AED', '**PU-SYSTEM:**', '2 × Example Primer',
  '\t\t\t\t**2. Hoarding**', HEAD,
  'Hoarding with artwork\tLS\t1,00\t12.500,00\tAED 12.500,00', '**Note:** Final dimensions are confirmed by the Client.',
  '\t\t\t\t**3. OPTIONAL**', HEAD, 'Coating for soffits:\tm²\t100,00\t45\t4.500,00 AED',
  '\t\t\t\t**4. Optional extras**', HEAD, 'Extra kerb painting\tm\t200,00\t10,00\t2.000,00 AED',
  '\t\t\t**117.000,00 AED**\t**SUBTOTAL**', '\t\t\t\tSALES TAX (%)', '\t\t\t**117.000,00 AED**\t**TOTAL**',
  'info@example.com', '**Remarks:**', 'Quantities are measured after execution.',
  'Unit of measurement: m² - net floor surface area.', 'For approval Client', 'For approval BUILD - TECH',
].join('\n');
console.log('▶ one of our own quotation sheets');
const e = b.eng;
ok(e.looksLikeQuotationSheet(SHEET) && b.docs.every(d => !e.looksLikeQuotationSheet(d.extracted)), 'a sheet is told apart from a bill of quantities');
const sh = e.parseQuotationSheet(SHEET);
ok(sh.number === '0999 BT' && sh.reference === 'Roof - Waterproof' && sh.date === '2027-02-03', `number, reference and date (saw ${sh.number} / ${sh.reference} / ${sh.date})`);
ok(sh.client === 'Example Trading LLC' && sh.client_address === 'P O Box: 1234, Dubai, UAE' && sh.client_reference === '4242',
  `client, address and tender reference (saw ${sh.client} / ${sh.client_address} / ${sh.client_reference})`);
ok(sh.company === 'BUILD-TECH PRO B.V' && sh.licence === '1411354' && sh.currency === 'AED', 'the company, its licence and the currency');
ok(sh.subtotal === 117000 && sh.total === 117000 && sh.vat.stated && sh.vat.applies === false,
  `subtotal and total, and an empty tax row read as no tax (saw ${sh.subtotal} / ${JSON.stringify(sh.vat)})`);
ok(sh.remarks.length === 2 && /m² - net floor/.test(sh.remarks[1]) && sh.unread.length === 0,
  `the remarks, and nothing left unread (saw ${sh.remarks.length} / ${sh.unread.join(' | ')})`);
const dr = e.draftFromSheet(sh, { office: { name: 'Dubai', legal_name: 'BUILD TECH PROTECTION MATERIALS L.L.C', currency: 'AED' } });
const charged = s => s.lines.filter(l => !l.is_spec_note);
ok(dr.secs.length === 4 && JSON.stringify(dr.secs.map(s => charged(s)[0].unit)) === JSON.stringify(['m²', 'LS', 'm²', 'm']),
  `four sections, units as written (saw ${dr.secs.map(s => charged(s)[0].unit).join(', ')})`);
ok(charged(dr.secs[0])[0].quantity === 1250 && charged(dr.secs[0])[0].sell_rate === 80 && charged(dr.secs[2])[0].sell_rate === 45, 'Belgian quantities and rates');
ok(dr.secs[0].lines.some(l => l.is_spec_note && l.is_bold && l.description === 'PU-SYSTEM:'), 'a heading bold on the sheet is a bold line');
ok(dr.secs[1].lines.some(l => l.is_spec_note && !l.is_bold && /^\*\*Note:\*\* Final/.test(l.description)), 'a note keeps only its first word bold');
ok(JSON.stringify(dr.secs.map(s => s.is_optional)) === '[false,false,false,true]',
  `the section the sheet leaves out of its subtotal is optional, the one it counts is not (saw ${dr.secs.map(s => s.is_optional)})`);
const inTotal = dr.secs.filter(s => !s.is_optional).reduce((t, s) => t + charged(s).reduce((u, l) => u + l.quantity * l.sell_rate, 0), 0);
ok(inTotal === 117000, `the draft adds up to the sheet's subtotal (saw ${inTotal})`);
ok(dr.notes.some(n => /Section 3 \(OPTIONAL\) is headed as an option/.test(n)) && dr.notes.some(n => /leaves Section 4 \(Optional extras\) out/.test(n))
   && dr.checks.length === 0, 'the notes say which is which, and there is nothing to check');
ok(dr.seed.vat_applies === false && dr.seed.client_reference === '4242' && dr.seed.quote_date === '2027-02-03' && /^Quantities/.test(dr.seed.remarks),
  'the header, the tax and the remarks go to the editor');
const two = e.draftFromSheet(e.parseQuotationSheet(['QUOTATION', '\t\t\t\t1. Floor', HEAD,
  'Supply\tm²\t10,00\t5,00\t50,00 AED', 'Install\tm²\t10,00\t3,00\t99,00 AED', '\t\t\t80,00 AED\tSUBTOTAL'].join('\n')), {});
ok(two.secs.length === 2 && two.secs[1].title === 'Floor (2)' && two.checks.some(c => /split into 2 sections/.test(c))
   && two.checks.some(c => /sheet prints 99\.00/.test(c)), 'a section charging two lines is split so both stay charged, and a wrong amount is flagged');
ok([['28.153,00', 28153], ['1,407,650', 1407650], ['126.000', 126000], ['45', 45], ['879.766,80', 879766.8], ['AED 38.000,00', 38000], ['1,00', 1]]
   .every(([t, n]) => e.sheetNum(t) === n), 'figures in either sheet format');
ok([['m2', 'm²'], ['M2', 'm²'], ['l.s', 'LS'], ['LS', 'LS'], ['LM', 'LM'], ['sq.m', 'sq.m']].every(([u, w]) => e.unitAsWritten(u) === w),
  'units written the way a sheet writes them');

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
