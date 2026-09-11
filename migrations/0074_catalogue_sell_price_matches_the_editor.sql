-- 0074: the catalogue's suggested sell price is the same figure the quotation editor
-- works out (Charles's decision on F-012, taken 11 September 2026).
--
-- The catalogue added the installation rate on top of the price at margin; the editor
-- never did, so the same product showed two "sell" figures on two screens. The editor's
-- figure is the one that reaches a quotation, so the view now matches it: the material
-- cost per square metre at the standard margin. The installation rate is still carried
-- (install_rate, total_cost_aed_m2) for a screen to show separately.

create or replace view public.catalogue_pricing with (security_invoker = true) as
 WITH cfg AS (
         SELECT max(nullif(regexp_replace(settings.value, '[^0-9.]', '', 'g'), '')::numeric) FILTER (WHERE settings.key = 'supply_discount'::text) AS supply_discount,
            max(nullif(regexp_replace(settings.value, '[^0-9.]', '', 'g'), '')::numeric) FILTER (WHERE settings.key = 'install_rate_aed'::text) AS install_rate,
            max(nullif(regexp_replace(settings.value, '[^0-9.]', '', 'g'), '')::numeric) FILTER (WHERE settings.key = 'default_margin'::text) AS margin,
            max(nullif(regexp_replace(settings.value, '[^0-9.]', '', 'g'), '')::numeric) FILTER (WHERE settings.key = 'eur_aed_rate'::text) AS fx
           FROM settings
        ), cov AS (
         SELECT products.id,
                CASE products.coverage_unit
                    WHEN 'kg/m2'::text THEN products.coverage_max
                    WHEN 'g/m2'::text THEN products.coverage_max / 1000.0
                    ELSE NULL::numeric
                END AS kg_m2
           FROM products
        )
 SELECT p.id AS product_id, p.name, p.category, p.subcategory, p.consumption_text,
    v.kg_m2 AS kg_per_m2,
    k.id AS pack_id, k.label AS pack, k.pack_qty, k.unit,
    k.eur_total AS rrp_eur, k.eur_per_unit AS rrp_eur_per_unit,
    round(k.eur_total * (1::numeric - c.supply_discount), 2) AS cost_eur,
    round(k.eur_per_unit * (1::numeric - c.supply_discount), 4) AS cost_eur_per_unit,
    round(k.eur_total * (1::numeric - c.supply_discount) * c.fx, 2) AS cost_aed,
    round(k.eur_per_unit * (1::numeric - c.supply_discount) * c.fx * v.kg_m2, 2) AS material_cost_aed_m2,
    round(k.eur_per_unit * (1::numeric - c.supply_discount) * c.fx * v.kg_m2 + c.install_rate, 2) AS total_cost_aed_m2,
    round(k.eur_per_unit * (1::numeric - c.supply_discount) * c.fx * v.kg_m2 / NULLIF(1::numeric - c.margin, 0::numeric), 2) AS sell_aed_m2,
    c.supply_discount, c.install_rate, c.margin, c.fx
   FROM products p
     JOIN product_packs k ON k.product_id = p.id
     JOIN cov v ON v.id = p.id
     CROSS JOIN cfg c
  WHERE p.is_active AND NOT k.is_poa AND k.eur_per_unit IS NOT NULL;

insert into public.applied_migrations (name) values ('0074_catalogue_sell_price_matches_the_editor') on conflict do nothing;
