// Print what the scope reader makes of the production BOQ, for reading by eye.
//   node tests/run_parse2.js
// The assertions live in tests/scope_fixture.js; this only shows the working.
const { build, draftOf } = require('./scope_engine');
const b = build();
for (const d of b.docs) {
  const r = draftOf(b, d.extracted);
  console.log('\n==================', d.file_name, '==================');
  console.log('title:', JSON.stringify(r.title), '| client:', JSON.stringify(r.client), '| ref:', JSON.stringify(r.ref));
  console.log('items:', r.items, '| unread:', r.unread, '| notes:', r.notes.length, '| boilerplate dropped:', r.boilerplateDropped);
  r.notes.forEach(n => console.log('  note:', n));
  r.sections.forEach((s, i) => {
    console.log(`\n  ${i + 1}. ${s.title}`);
    console.log(`     PRICE ${s.priced.unit} ${s.priced.qty} :: ${String(s.priced.description).slice(0, 100)}`);
    s.spec.forEach(l => console.log('     ' + (l.startsWith('**') ? 'SPEC* ' + l.slice(2) : 'spec  ' + l).slice(0, 110)));
    console.log('     cost per m² from the products:', s.perM2 == null ? '(none)' : s.perM2 + ' AED' + (s.applies ? ', applied to the line' : ', NOT applied: the line is not per square metre'));
  });
  console.log('\n  internal notes, into Meeting notes:'); r.internal.forEach(n => console.log('   -', n));
}
