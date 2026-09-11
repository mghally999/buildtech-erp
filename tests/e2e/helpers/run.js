// Isolation helpers shared by every e2e spec.
//
// Everything a test writes carries the tag ZZTEST in a field the app already has (a
// reference, a name, a description). Each spec's afterAll calls purge(), which deletes
// every tagged row in dependency order; the global teardown then proves none remain in
// ANY table. sql() talks only to the test project (it is the hard-wired helper in lib.js).
const { sql, lit } = require('../../lib');

const TAG = 'ZZTEST';                 // the marker every test record carries
const RUN = TAG + '-' + Date.now().toString(36);   // this run, for readability in the data

// Delete every tagged row, children before parents, so foreign keys never block a delete.
// Matched broadly on the tag so a crashed earlier run is swept too; nothing real is named ZZTEST.
async function purge() {
  const like = `'%${TAG}%'`;
  // a tagged client: everything hanging off it goes too, even a quotation or order that
  // was auto-numbered and so does not carry the tag in its own reference
  const CL = `(select id from clients where name like ${like})`;
  const Q = `(select id from quotations where reference like ${like} or project_name like ${like} or client_id in ${CL})`;
  const PJ = `(select id from projects where name like ${like} or client_id in ${CL})`;
  const IV = `(select id from invoices where reference like ${like} or client_id in ${CL})`;
  const PO = `(select id from purchase_orders where reference like ${like} or notes like ${like} or quotation_id in ${Q} or project_id in ${PJ})`;
  const stmts = [
    // payments and invoice lines, then invoices (tagged, or belonging to a tagged client)
    `delete from invoice_payments where invoice_id in ${IV}`,
    `delete from invoice_lines where invoice_id in ${IV}`,
    `delete from invoices where id in ${IV}`,
    // order lines, then orders (tagged, or built from a tagged client's quotation/project)
    `delete from purchase_order_lines where po_id in ${PO}`,
    `delete from purchase_orders where id in ${PO}`,
    // shipment lines, then shipments
    `delete from shipment_lines where shipment_id in (select id from shipments where reference like ${like})`,
    `delete from shipments where reference like ${like}`,
    // stock movements and stock for tagged products or warehouses
    `delete from stock_movements where product_id in (select id from products where name like ${like}) or warehouse_id in (select id from warehouses where name like ${like})`,
    `delete from stock where product_id in (select id from products where name like ${like}) or warehouse_id in (select id from warehouses where name like ${like})`,
    // project children, then projects
    `delete from payment_milestones where project_id in ${PJ}`,
    `delete from project_materials where project_id in ${PJ}`,
    `delete from expenses where project_id in ${PJ} or description like ${like}`,
    `delete from projects where id in ${PJ}`,
    // quotation children, then quotations
    `delete from quotation_lines where section_id in (select id from quotation_sections where quotation_id in ${Q})`,
    `delete from quotation_sections where quotation_id in ${Q}`,
    `delete from product_wordings where wording like ${like}`,
    `delete from quotations where id in ${Q}`,
    // sales funnel, then the clients themselves
    `delete from field_visits where summary like ${like} or contact_person like ${like} or client_id in ${CL}`,
    `delete from inquiries where project_name like ${like} or client_id in ${CL}`,
    `delete from correspondence where summary like ${like} or client_id in ${CL}`,
    `delete from clients where id in ${CL}`,
    // catalogue: tagged products a test seeded
    `delete from product_documents where product_id in (select id from products where name like ${like}) or title like ${like}`,
    `delete from product_packs where product_id in (select id from products where name like ${like})`,
    `delete from products where name like ${like}`,
    `delete from warehouses where name like ${like}`,
    // banks and partners a test may have made
    `delete from bank_accounts where name like ${like}`,
    `delete from partners where name like ${like}`,
    `delete from payroll where person like ${like}`,
    `delete from commitments where reference like ${like} or supplier like ${like}`,
  ];
  // one round-trip for speed; if any single statement is unsupported on this schema, fall
  // back to one-by-one so it cannot block the rest. The scan is the real guarantee either way.
  try { await sql(stmts.join(';\n')); }
  catch (e) { for (const q of stmts) { try { await sql(q); } catch (_) {} } }
}

// Look in every text column of every base table for a leftover ZZTEST row. Returns a string
// of "table.column=count" for anything still tagged, or '' when the database is clean. This
// is the guarantee the global teardown asserts. The helper function is dropped after use so
// it leaves no trace of its own.
async function scan() {
  const rows = await sql(`
    create or replace function public._bt_leak_scan() returns text language plpgsql as $fn$
    declare r record; n bigint; hits text := '';
    begin
      for r in
        select c.table_name, c.column_name
        from information_schema.columns c
        join information_schema.tables t
          on t.table_schema=c.table_schema and t.table_name=c.table_name
        where c.table_schema='public' and t.table_type='BASE TABLE'
          and c.data_type in ('text','character varying','character')
      loop
        execute format('select count(*) from public.%I where %I like ''%%ZZTEST%%''', r.table_name, r.column_name) into n;
        if n > 0 then hits := hits || r.table_name || '.' || r.column_name || '=' || n || '; '; end if;
      end loop;
      return hits;
    end $fn$;
    select public._bt_leak_scan() as hits;`);
  await sql('drop function if exists public._bt_leak_scan()');
  return (rows && rows[0] && rows[0].hits) || '';
}

module.exports = { sql, lit, TAG, RUN, purge, scan };
