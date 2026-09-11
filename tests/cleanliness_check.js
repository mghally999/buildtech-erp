// Phase 7 evidence: prove the test database carries no trace of the sweep, and report the
// forward-only counters that testing advanced (which a delete cannot undo — the single
// strongest reason these tests never run against production).
//
//   node tests/cleanliness_check.js
const { sql } = require('./lib');
const { scan } = require('./e2e/helpers/run');

(async () => {
  // 1. any ZZTEST row still anywhere?
  const hits = await scan();
  console.log('ZZTEST rows remaining anywhere:', hits ? hits : 'NONE — clean');

  // 2. row counts of the tables tests write to, so a stray row would show
  const tables = ['clients', 'field_visits', 'inquiries', 'quotations', 'quotation_sections',
    'quotation_lines', 'projects', 'payment_milestones', 'purchase_orders', 'purchase_order_lines',
    'shipments', 'shipment_lines', 'invoices', 'invoice_lines', 'invoice_payments', 'stock',
    'stock_movements', 'products', 'product_packs', 'product_documents', 'warehouses',
    'bank_accounts', 'partners', 'payroll', 'commitments', 'correspondence', 'activity_log'];
  const counts = {};
  for (const t of tables) counts[t] = (await sql(`select count(*)::int as n from ${t}`))[0].n;
  console.log('\nrow counts:');
  for (const t of tables) console.log('  ' + t.padEnd(24), counts[t]);

  // 3. orphans in the audit/log tables referencing anything tagged (there should be none)
  const orphanLog = (await sql("select count(*)::int as n from activity_log where summary like '%ZZTEST%'"))[0].n;
  const orphanCorr = (await sql("select count(*)::int as n from correspondence where summary like '%ZZTEST%'"))[0].n;
  console.log('\naudit tables referencing ZZTEST: activity_log =', orphanLog, ', correspondence =', orphanCorr);

  // 4. forward-only counters — these advanced during testing and cannot be rolled back
  const offices = await sql("select code, quote_prefix, quote_next, invoice_prefix, invoice_next from offices order by code");
  console.log('\nnumbering counters now (advanced by testing, not reversible):');
  offices.forEach(o => console.log('  ' + o.code, '| quotes → next', o.quote_next, '| invoices → next', o.invoice_next));
})().catch(e => { console.error('cleanliness check failed:', e.message); process.exit(1); });
