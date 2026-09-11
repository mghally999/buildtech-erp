// Seed data a test owns and removes. Tests never touch the real catalogue, so any test
// that needs a product makes its own here, tagged ZZTEST, and purge() takes it away again.
const { sql } = require('../helpers/run');

// A catalogue product with one priced pack and a known consumption, so a section that
// names it prices itself. Returns { id, name, packId }.
async function seedProduct({ name, category = 'flooring', coverage = 2.5, eur = 100, qty = 25 } = {}) {
  const cat = category || (await sql('select category from products limit 1'))[0].category;
  // Civil-Defence-approved, so a test that needs to move it is not blocked by the held-stock trigger
  const [p] = await sql(`insert into products (category, name, coverage_min, coverage_max, coverage_unit, consumption_text, dcd_approved, dcd_expiry)
    values ('${cat}', '${name}', ${coverage}, ${coverage}, 'kg/m2', 'Approx. ${String(coverage).replace('.', ',')} kg/m²', true, current_date + 365) returning id, name`);
  const [pk] = await sql(`insert into product_packs (product_id, label, pack_qty, unit, eur_total, eur_per_unit, is_poa)
    values ('${p.id}', '${qty} kg', ${qty}, 'kg', ${eur}, ${Math.round((eur / qty) * 10000) / 10000}, false) returning id`);
  return { id: p.id, name: p.name, packId: pk.id };
}

// A warehouse a test can move stock through, with its Civil Defence certificate in order.
async function seedWarehouse({ name, office_id }) {
  const [w] = await sql(`insert into warehouses (name, dcd_certified, dcd_certificate_ref, dcd_expiry, office_id)
    values ('${name}', true, 'ZZTEST-CERT', current_date + 365, '${office_id}') returning id`);
  return w.id;
}

module.exports = { seedProduct, seedWarehouse };
