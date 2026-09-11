-- 0073: money out is kept in the currency of the account and the office it belongs to
-- (Charles's decision on F-003, taken 11 September 2026: Belgium keeps its books here).
--
-- Every cost was stored with a dirham figure and that figure was taken off whatever bank
-- account paid it, so a EUR 100 cost took EUR 427 off a Belgian account. Payroll had no
-- currency at all. From here a figure is converted only when it crosses a currency line:
-- a cost in the account's own currency is taken as it is, a cost in the other currency is
-- converted at the rate in Settings, and a salary is in its office's currency.

-- the rate in Settings, read the forgiving way the screens read it
create or replace function public.settings_fx()
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce(nullif(regexp_replace(value, '[^0-9.]', '', 'g'), '')::numeric, 4.27)
  from settings where key = 'eur_aed_rate' limit 1;
$$;

create or replace function public.office_currency(p_office uuid)
returns text
language sql
stable
set search_path = public
as $$
  select coalesce((select currency from offices where id = p_office), 'AED');
$$;

-- An amount kept in `p_cur` (with its dirham figure, when the record has one), as a number
-- in `p_to`. The same currency passes through untouched.
create or replace function public.money_in(p_amount numeric, p_cur text, p_amount_aed numeric, p_to text)
returns numeric
language sql
stable
set search_path = public
as $$
  select case
    when coalesce(p_cur, 'AED') = coalesce(p_to, 'AED') then coalesce(p_amount, p_amount_aed)
    when coalesce(p_to, 'AED') = 'AED' then coalesce(p_amount_aed, p_amount * settings_fx())
    else coalesce(p_amount_aed, p_amount) / nullif(settings_fx(), 0)
  end;
$$;

-- what each bank account holds, in its own currency
create or replace view public.cash_position with (security_invoker = true) as
 SELECT v.bank_account_id, v.name, v.bank, v.currency, v.opening_balance, v.opening_date,
        v.received, v.spent, v.wages_and_drawings, v.balance, p.office_id
   FROM ( SELECT b.id AS bank_account_id, b.name, b.bank, b.currency, b.opening_balance, b.opening_date,
            COALESCE(r.amt, 0::numeric) + COALESCE(c.amt, 0::numeric) AS received,
            COALESCE(e.amt, 0::numeric) AS spent,
            COALESCE(w.amt, 0::numeric) AS wages_and_drawings,
            b.opening_balance + COALESCE(r.amt, 0::numeric) + COALESCE(c.amt, 0::numeric)
              - COALESCE(e.amt, 0::numeric) - COALESCE(w.amt, 0::numeric) AS balance
           FROM bank_accounts b
             -- a payment is in the invoice's money; converted only if the account is kept in the other
             LEFT JOIN ( SELECT ip.bank_account_id, b2.id AS bid,
                    sum(money_in(ip.amount, office_currency(i.office_id), NULL, b2.currency)) AS amt
                   FROM invoice_payments ip
                     JOIN invoices i ON i.id = ip.invoice_id
                     JOIN bank_accounts b2 ON b2.id = ip.bank_account_id
                  GROUP BY ip.bank_account_id, b2.id) r ON r.bid = b.id
             LEFT JOIN ( SELECT x.bank_account_id, sum(money_in(x.amount, x.currency, x.amount_aed, b3.currency)) AS amt
                   FROM expenses x JOIN bank_accounts b3 ON b3.id = x.bank_account_id
                  WHERE x.paid_on IS NOT NULL AND x.kind = 'contribution'::expense_kind
                  GROUP BY x.bank_account_id) c ON c.bank_account_id = b.id
             LEFT JOIN ( SELECT x.bank_account_id, sum(money_in(x.amount, x.currency, x.amount_aed, b4.currency)) AS amt
                   FROM expenses x JOIN bank_accounts b4 ON b4.id = x.bank_account_id
                  WHERE x.paid_on IS NOT NULL AND x.kind = 'expense'::expense_kind
                  GROUP BY x.bank_account_id) e ON e.bank_account_id = b.id
             -- a salary or drawing is in its office's money
             LEFT JOIN ( SELECT w0.bank_account_id, sum(money_in(w0.amount, office_currency(w0.office_id), NULL, b5.currency)) AS amt
                   FROM payroll w0 JOIN bank_accounts b5 ON b5.id = w0.bank_account_id
                  WHERE w0.paid_on IS NOT NULL
                  GROUP BY w0.bank_account_id) w ON w.bank_account_id = b.id
          WHERE b.is_active) v
     LEFT JOIN bank_accounts p ON p.id = v.bank_account_id;

-- what each partner has put in, in their office's money, against the partners of that office
create or replace view public.partner_ledger with (security_invoker = true) as
 SELECT v.partner_id, v.name, v.ownership_pct, v.share_capital, v.funded, v.drawings,
        v.contributed, v.fair_share, v.balance, p.office_id
   FROM ( WITH funded AS (
                 SELECT x.paid_by_partner_id AS pid, pp.office_id,
                        sum(money_in(x.amount, x.currency, x.amount_aed, office_currency(pp.office_id))) AS amt
                   FROM expenses x JOIN partners pp ON pp.id = x.paid_by_partner_id
                  GROUP BY x.paid_by_partner_id, pp.office_id
                ), drawn AS (
                 SELECT w.partner_id AS pid,
                        sum(money_in(w.amount, office_currency(w.office_id), NULL, office_currency(pp.office_id))) AS amt
                   FROM payroll w JOIN partners pp ON pp.id = w.partner_id
                  WHERE w.kind = 'drawing'::pay_kind
                  GROUP BY w.partner_id
                ), pot AS (
                 SELECT pp.office_id,
                        sum(pp.share_capital) + coalesce(sum(f.amt), 0::numeric) AS total
                   FROM partners pp LEFT JOIN funded f ON f.pid = pp.id
                  WHERE pp.is_active
                  GROUP BY pp.office_id
                )
         SELECT p_1.id AS partner_id, p_1.name, p_1.ownership_pct, p_1.share_capital,
            COALESCE(f.amt, 0::numeric) AS funded,
            COALESCE(d.amt, 0::numeric) AS drawings,
            p_1.share_capital + COALESCE(f.amt, 0::numeric) AS contributed,
            round(COALESCE(pot.total, 0::numeric) * p_1.ownership_pct / 100.0, 2) AS fair_share,
            round(p_1.share_capital + COALESCE(f.amt, 0::numeric) - COALESCE(d.amt, 0::numeric)
                  - COALESCE(pot.total, 0::numeric) * p_1.ownership_pct / 100.0, 2) AS balance
           FROM partners p_1
             LEFT JOIN pot ON pot.office_id = p_1.office_id
             LEFT JOIN funded f ON f.pid = p_1.id
             LEFT JOIN drawn d ON d.pid = p_1.id
          WHERE p_1.is_active) v
     LEFT JOIN partners p ON p.id = v.partner_id;

-- what a project has actually cost, in the project's office money
create or replace view public.project_actuals with (security_invoker = true) as
 SELECT v.project_id, v.name, v.status, v.contract_value, v.quoted_cost, v.costs_booked,
        v.shipment_cost, v.material_issued, v.labour_cost, v.actual_cost, v.actual_gross,
        v.actual_margin_pct, v.quoted_margin_pct, v.has_actuals, p.office_id
   FROM ( WITH exp AS (
                 SELECT x.project_id,
                    sum(money_in(x.amount, x.currency, x.amount_aed, office_currency(pj.office_id))) AS amt,
                    sum(money_in(x.amount, x.currency, x.amount_aed, office_currency(pj.office_id)))
                      FILTER (WHERE x.category ~~* '%labour%' OR x.category ~~* '%subcontract%') AS labour,
                    sum(money_in(x.amount, x.currency, x.amount_aed, office_currency(pj.office_id)))
                      FILTER (WHERE x.category ~~* '%shipping%' OR x.category ~~* '%freight%') AS freight
                   FROM expenses x JOIN projects pj ON pj.id = x.project_id
                  WHERE x.kind = 'expense'::expense_kind
                  GROUP BY x.project_id
                ), shp AS (
                 -- a landed cost is worked out in dirhams; brought into the project's money
                 SELECT s.project_id,
                    sum(money_in(NULL, 'AED', t.landed_cost, office_currency(pj.office_id))) AS amt
                   FROM shipments s
                     JOIN shipment_totals t ON t.shipment_id = s.id
                     JOIN projects pj ON pj.id = s.project_id
                  GROUP BY s.project_id
                ), iss AS (
                 SELECT m.project_id,
                    sum(money_in(NULL, 'AED',
                        m.quantity * COALESCE(k.eur_per_unit, 0::numeric) * (1::numeric - COALESCE(c.disc, 0.70)) * COALESCE(c.fx, 4.27),
                        office_currency(pj.office_id))) AS amt,
                    sum(m.quantity) AS qty
                   FROM stock_movements m
                     JOIN projects pj ON pj.id = m.project_id
                     LEFT JOIN LATERAL ( SELECT min(product_packs.eur_per_unit) AS eur_per_unit
                           FROM product_packs
                          WHERE product_packs.product_id = m.product_id AND NOT product_packs.is_poa) k ON true
                     CROSS JOIN ( SELECT max(nullif(regexp_replace(settings.value, '[^0-9.]', '', 'g'), '')::numeric) FILTER (WHERE settings.key = 'supply_discount'::text) AS disc,
                            max(nullif(regexp_replace(settings.value, '[^0-9.]', '', 'g'), '')::numeric) FILTER (WHERE settings.key = 'eur_aed_rate'::text) AS fx
                           FROM settings) c
                  WHERE m.direction = 'out'::text
                  GROUP BY m.project_id
                )
         SELECT p_1.id AS project_id, p_1.name, p_1.status,
            nz.value AS contract_value,
            COALESCE(p_1.material_cost, 0::numeric) + COALESCE(p_1.freight_cost, 0::numeric) + COALESCE(p_1.duty_cost, 0::numeric) + COALESCE(p_1.other_cost, 0::numeric) AS quoted_cost,
            COALESCE(exp.amt, 0::numeric) AS costs_booked,
            COALESCE(shp.amt, 0::numeric) AS shipment_cost,
            COALESCE(iss.amt, 0::numeric) AS material_issued,
            COALESCE(exp.labour, 0::numeric) AS labour_cost,
            COALESCE(exp.amt, 0::numeric) + COALESCE(shp.amt, 0::numeric) + COALESCE(iss.amt, 0::numeric) AS actual_cost,
            nz.value - (COALESCE(exp.amt, 0::numeric) + COALESCE(shp.amt, 0::numeric) + COALESCE(iss.amt, 0::numeric)) AS actual_gross,
            CASE WHEN nz.value > 0::numeric
                 THEN round((nz.value - (COALESCE(exp.amt, 0::numeric) + COALESCE(shp.amt, 0::numeric) + COALESCE(iss.amt, 0::numeric))) / nz.value * 100::numeric, 1)
                 ELSE NULL::numeric END AS actual_margin_pct,
            CASE WHEN nz.value > 0::numeric
                 THEN round((nz.value - (COALESCE(p_1.material_cost, 0::numeric) + COALESCE(p_1.freight_cost, 0::numeric) + COALESCE(p_1.duty_cost, 0::numeric) + COALESCE(p_1.other_cost, 0::numeric))) / nz.value * 100::numeric, 1)
                 ELSE NULL::numeric END AS quoted_margin_pct,
            (COALESCE(exp.amt, 0::numeric) + COALESCE(shp.amt, 0::numeric) + COALESCE(iss.amt, 0::numeric)) > 0::numeric AS has_actuals
           FROM projects p_1
             CROSS JOIN LATERAL ( SELECT COALESCE(p_1.value, 0::numeric) AS value) nz
             LEFT JOIN exp ON exp.project_id = p_1.id
             LEFT JOIN shp ON shp.project_id = p_1.id
             LEFT JOIN iss ON iss.project_id = p_1.id) v
     LEFT JOIN projects p ON p.id = v.project_id;

insert into public.applied_migrations (name) values ('0073_money_kept_in_its_own_currency') on conflict do nothing;
