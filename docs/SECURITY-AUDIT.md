# Build-Tech Pro — Security and RLS audit (Phase 2)

Source: the production project `zlyqecpsgzgbpbikrlro`, read on 2026-09-10 through the
Management API's SQL endpoint, which executes as `supabase_read_only_user` (a role that
cannot write). Only system catalogues were read: `pg_policies`, `pg_class`, `pg_proc`,
`pg_trigger`, `pg_constraint`, ACLs, and the auth configuration. No business data was read.
Raw outputs are in `docs/schema/`.

The premise of this phase: the browser holds a publishable key, so the only rules that exist
are the ones Postgres enforces. Anything enforced in `index.html` alone can be bypassed by
anyone who opens the browser console.

---

## 1. Tables with RLS disabled

**None.** All 45 public tables have row-level security enabled (none forced). An event
trigger, `rls_auto_enable()`, turns RLS on for any table created in `public` in future.

What the **anonymous** key can do, given that: the `anon` role holds **no grants at all** on
any public table or view, and no storage policy names `anon`. So an unauthenticated caller
with the publishable key can reach only the auth endpoints. That part is right.

The problem is what happens once a caller is authenticated, and how easy that is (section 6).

---

## 2. Every policy, in plain English

All policies are `PERMISSIVE` and apply to the role `authenticated` only.

### 2a. Thirty-eight tables: any signed-in user may do anything

Policy shape: `FOR ALL TO authenticated USING (true) WITH CHECK (true)`, named
`<table>_all_authenticated` (or `_all`):

`approval_documents`, `approval_requirements`, `approvals`, `bank_accounts`, `clients`,
`commitment_documents`, `commitment_lines`, `commitments`, `correspondence`, `expenses`,
`field_visits`, `inquiries`, `invoice_lines`, `invoice_payments`, `invoices`, `partners`,
`payment_milestones`, `payroll`, `po_documents`, `product_aliases`, `product_documents`,
`product_packs`, `product_transport`, `product_wordings`, `products`, `project_materials`,
`projects`, `purchase_order_lines`, `purchase_orders`, `quotation_lines`,
`quotation_sections`, `quotations`, `scope_documents`, `shipment_documents`,
`shipment_lines`, `shipments`, `stock`, `stock_movements`, `warehouses`.

Meaning: every person with a login can read, create, change and delete every row of every
one of these tables, in both offices, including salaries (`payroll`), partner capital and
drawings (`partners`, and the `partner_ledger` view over them), bank account numbers and
IBANs (`bank_accounts`), every client, every price, every quotation, and the stock ledger.

### 2b. Three tables with owner rules

| Table | Read | Insert | Update | Delete |
|---|---|---|---|---|
| `settings` | anyone signed in | owner only (`is_owner()`) | owner only | owner only |
| `offices` | anyone signed in | owner only | owner only | owner only |
| `profiles` | anyone signed in | owner only | **own row or owner**; a `BEFORE UPDATE` trigger (`guard_profile_role`) additionally refuses a role change unless `is_owner()` | owner only |

`is_owner()` is `SECURITY DEFINER` and returns true when the caller's `profiles.role` is
`'owner'`.

### 2c. Two tables with read-only or split rules

| Table | Rule |
|---|---|
| `activity_log` | `SELECT` only, for anyone signed in. Writes happen inside the `SECURITY DEFINER` trigger `log_activity()`, so users cannot forge or erase log rows. Correct. |
| `applied_migrations` | `SELECT` only. |
| `spec_equivalents` | `SELECT` for anyone signed in; `ALL` (write) **owner only**. |

### 2d. Storage

`storage.objects` has RLS on with four policies per bucket (`SELECT`, `INSERT`, `UPDATE`,
`DELETE`), each `TO authenticated` with the single condition `bucket_id = '<bucket>'`, for
all six buckets. Any signed-in user can read, replace or delete any file in any bucket.
`storage.buckets` has RLS on and no policies, so buckets cannot be listed or altered from
the browser. All buckets are private, unlimited size, any MIME type.

### 2e. Views

Twenty of the 23 views (`approval_watch`, `cash_position`, `invoice_totals`,
`partner_ledger`, `stock_position`, `quotation_totals`, … everything except
`catalogue_pricing`, `document_watch` and `product_transport_summary`) are **not**
`security_invoker`. They run with their owner's rights and therefore ignore RLS on the
tables underneath. Today that changes nothing, because the table policies are `true`
anyway. The moment any office or owner rule is added to a table, these views will keep
showing every row unless they are switched to `security_invoker = true` first (fix 7.1).

### 2f. Grants

`authenticated` holds full table privileges on every public table and view, and
`EXECUTE` on every function. `anon` holds none in `public`. Default privileges for new
tables give `authenticated` full rights automatically, so a future table is open unless a
policy says otherwise.

---

## 3. Rules the frontend enforces that the database does not

| # | Question from the sweep | Answer | Rank |
|---|---|---|---|
| 3.1 | Can a non-owner write `settings` or change pricing dials? | **No.** RLS and the trigger enforce it. The app's `disabled` inputs are cosmetic on top of a real rule. | OK |
| 3.2 | Can a Dubai user read or write Belgium records, or the reverse? | **Yes, everything.** Office separation exists only in the `sb.from()` wrapper (index.html 1949–1964). Every office-owned table's policy is `true`. A user who removes the `office_id` filter in the console, or calls the REST API directly, sees and edits both companies' books. The app's own comment says the two offices are "different customers, different books, different country"; the database does not know that. | **CRITICAL** by the sweep's definition (JavaScript-only rule). Whether it matters depends on whether the four users are meant to see both companies; today the UI lets them anyway (see 3.6). |
| 3.3 | Can any signed-in user read salaries, partner ledger entries, bank balances? | **Yes.** `payroll`, `partners`, `bank_accounts`, `expenses`, `invoice_payments` and the `partner_ledger` / `cash_position` views are readable by every login. The app shows them to everyone too, so the UI and the database agree. This is a design decision, not a mismatch, but it means the "Full" role is the same as owner for reading money. | Design decision for Charles |
| 3.4 | Can Civil-Defence-blocked stock be issued via a direct call? | **Yes.** `stock_movements` accepts any insert; the only checks are `direction in ('in','out')` and `quantity > 0`. Nothing in the database looks at `products.dcd_approved`, `warehouses.dcd_certified` or their expiry dates. `apply_stock_movement()` then subtracts from `stock.qty_on_hand`, which has no floor, so stock can go negative as well. The UI does not check either (Stock.record, index.html 4485–4500): the "held" list is a report, not a lock. | **HIGH** |
| 3.5 | Can quotation approval status be changed by someone not allowed to approve? | **Yes.** `quotations` is fully open and there is no approver role; the status dropdown (11208) is the whole mechanism. Also `promote_prospect` fires on quotation insert regardless of status. | Design decision: there is currently no approval workflow to enforce |
| 3.6 | Extra: who can create a login? | The app says "Accounts are created by an owner" (2929). The auth config has `disable_signup = false`. Anyone can call the sign-up endpoint with the publishable key, confirm the email they own, and the trigger `handle_new_user()` creates a `profiles` row with role `full`. Every policy in 2a then applies to them. | **CRITICAL** |
| 3.7 | Extra: can a non-owner change their own office or email? | Yes: `profiles_edit` allows updating one's own row; only `role` is guarded. Changing `office_id` changes which office the app opens on; changing `email` desynchronises it from `auth.users`. | LOW |
| 3.8 | Extra: the "Remember" button in the scope reader | Inserts into `spec_equivalents` (10192), whose write policy is owner-only. Every non-owner gets "Not saved: new row violates row-level security policy". | MEDIUM (feature broken for non-owners) |
| 3.9 | Extra: a third role exists | `profiles_role_check` allows `'staff'` as well as `'owner'` and `'full'`. Nothing in the app or the policies gives `staff` any meaning; a `staff` user is treated as `full` everywhere. | LOW |
| 3.10 | Extra: can the anonymous key call functions? | Yes. Every public function carries `=X` in its ACL (EXECUTE granted to PUBLIC) and PUBLIC has USAGE on the schema, so the `anon` role can call any RPC through PostgREST without signing in. Three run as `SECURITY DEFINER` and bypass RLS: `receive_po_line` (writes a stock movement and updates an order, but needs a real line uuid, so practically unguessable), `next_po_reference` (reveals the next order number) and `is_owner` (harmless). The numbering functions read `settings`/`offices` as the caller and fail for anon, but they are still reachable. | MEDIUM; fix 7.4 already revokes from `anon` and `public` |

---

## 4. SECURITY DEFINER functions

| Function | Runs as owner? | What it does with that | Verdict |
|---|---|---|---|
| `is_owner()` | yes | Reads `profiles` for the caller's row. Needed, because it is used inside `profiles` policies. Safe. | OK |
| `handle_new_user()` | yes (trigger on `auth.users`) | Creates a `profiles` row with role `'full'` for every new auth user. Combined with open sign-up this is the door in 3.6. | Fix 7.2 |
| `guard_profile_role()` | yes (trigger) | Refuses role changes by non-owners. Correct. | OK |
| `log_activity()` | yes (trigger on 9 tables) | Writes `activity_log` bypassing RLS; swallows its own errors so a failed log never blocks a write. Correct. Note it is attached to `approval_requirements`, `expenses`, `field_visits`, `invoices`, `payroll`, `projects`, `quotation_lines`, `quotations`, `stock_movements` only. Not to purchase orders, order lines, invoice payments, clients, products, packs, settings or offices, despite the Settings page saying "every edit to … an order, a cost or a payment lands here" (7025). | Phase 3 |
| `promote_prospect()` | yes (trigger) | Flips `clients.kind` to `'client'` on the first inquiry or quotation. Safe. | OK |
| `next_po_reference()` | yes | Reads `purchase_orders` to compute `max + 1`. Safe, but not concurrency-safe (two users can get the same number; the unique constraint then rejects the second). | Phase 3 |
| `receive_po_line(...)` | yes | Inserts a stock movement and updates order lines and status, bypassing RLS. Validates quantity, line existence, product link and warehouse. No office check, no Civil Defence check (receiving *into* stock is fine; the block is on issuing). Acceptable given 2a; would need an office check if 7.3 is applied. | OK / revisit with 7.3 |
| `rls_auto_enable()` | yes (event trigger) | Enables RLS on new tables. Good. | OK |
| **`next_quotation_reference(p_office)`** | **no** | Does `UPDATE offices SET quote_next = quote_next + 1`. `offices_edit` is owner-only, so for a `full` user the update matches no rows, `NOT FOUND` fires and the function raises "There is no office with that id." The editor shows "Error: could not allocate a number. There is no office with that id." **A non-owner cannot save a new quotation.** | **BREAKS** for every non-owner (fix 7.4) |
| **`next_invoice_reference()`** | **no** | Does `UPDATE settings SET value = value + 1 … RETURNING`. `settings_edit` is owner-only, so for a `full` user zero rows update, `n` stays NULL, the function returns NULL, and the insert fails on `invoices.reference NOT NULL`. **A non-owner cannot create an invoice.** | **BREAKS** for every non-owner (fix 7.4) |
| `next_quotation_reference()` (no argument, legacy) | no | Same pattern on `settings`; not called by the current build. | Remove |
| `apply_stock_movement()`, `block_delete_of_received_po()`, `office_must_match_parent()`, `sync_approval_to_subject()` | no | Ordinary triggers running as the caller; all their writes hit tables whose policies are `true`, so they work for everyone. `office_must_match_parent` silently copies the parent's `office_id` onto stock, stock movements and project materials, which is good. | OK |

Note on 4's two BREAKS rows: `handle_new_user` gives every invited person the role `full`,
and the Access list (7043) confirms "everything except the system values" is the default.
The exact number of non-owner accounts among the four users was not read (that is user
data), but the app's own text says Charles alone holds the dials.

---

## 5. Secrets in the shipped files

Checked `index.html`, `config.js`, `sw.js`, `_headers`, `manifest.webmanifest`:

- `config.js` carries the project URL and the **publishable** key. That is correct by
  design; it is the key meant for browsers.
- No service-role key, JWT secret, database password, SMTP credential or personal access
  token appears anywhere in the shipped files.
- The auth config export (`docs/schema/auth_config.json`) was checked for populated secret
  fields before being kept: none (no SMTP password, no OAuth provider secrets, no hook
  secrets).
- The sweep's own token lives in `.env.local`, gitignored, and should be revoked when the
  sweep ends.

---

## 6. How exposed is this in practice

Put together: the publishable key is public by design; sign-up is open; a new sign-up
becomes a `full` profile automatically; and `full` may do anything to any row in either
office and any file in any bucket. So the effective access control on the whole business
database is "know the URL and confirm an email address". That chain is the single most
important finding of the sweep so far, and the first link (open sign-up) is a one-line
configuration change.

Second in importance: the two numbering functions, because they mean the system's core
workflow (number a quotation, number an invoice) only works for owners.

---

## 7. The SQL that closes each gap

Nothing below has been applied anywhere. Each block is written to be run once, in order,
on the **test project first**. Items marked *decision* change behaviour Charles may want,
and should not be applied without him.

### 7.1 Make the views obey RLS (prerequisite for anything office- or owner-scoped)

```sql
do $$
declare v text;
begin
  for v in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'v'
              and coalesce(array_to_string(c.reloptions, ','), '') not like '%security_invoker=true%'
  loop
    execute format('alter view public.%I set (security_invoker = true)', v);
  end loop;
end $$;
```

### 7.2 Close the open door: no self-service accounts (CRITICAL)

Two layers. First, the auth setting (dashboard → Authentication → Sign In / Providers →
"Allow new users to sign up" off; or `PATCH /v1/projects/{ref}/config/auth` with
`{"disable_signup": true}`). Invitations sent by an owner from the dashboard still work.

Second, so a mistake in that setting cannot reopen the door, make the profile trigger
refuse anyone who was not invited:

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Only people an owner invited from the dashboard get a profile. A self-service
  -- sign-up has no invited_at, gets no profile, and every policy below then denies it.
  if new.invited_at is null and (new.raw_app_meta_data->>'provider') = 'email' then
    raise exception 'Accounts are created by an owner. Ask Charles for an invitation.';
  end if;
  insert into profiles (id, full_name, email, role)
  values (new.id,
          coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
                   initcap(replace(split_part(new.email,'@',1),'.',' '))),
          new.email, 'full')
  on conflict (id) do nothing;
  return new;
end $$;
```

And a belt for every table: require a profile to exist at all, so a stray auth user with
no profile row can do nothing. Add to every policy's `USING`/`WITH CHECK` via the helper
used in 7.3, which returns NULL (never true) for a user without a profile.

### 7.3 Office separation in the database (*decision*)

Helper:

```sql
create or replace function public.my_office_id()
returns uuid language sql stable security definer set search_path = public as $$
  select office_id from profiles where id = auth.uid();
$$;
```

Rule: owners see and write both offices (that is the BOTH view they use); everyone else
sees and writes only their own office. Applied to every table that carries `office_id`:

```sql
do $$
declare t text;
begin
  for t in select unnest(array[
    'clients','field_visits','inquiries','quotations','projects','project_materials',
    'purchase_orders','shipments','warehouses','stock','stock_movements','approvals',
    'correspondence','invoices','expenses','bank_accounts','partners','payroll',
    'commitments','scope_documents'])
  loop
    execute format('drop policy if exists %I on public.%I', t || '_all_authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format($p$
      create policy %I on public.%I for all to authenticated
      using (is_owner() or office_id = my_office_id())
      with check (is_owner() or office_id = my_office_id())
    $p$, t || '_own_office', t);
  end loop;
end $$;
```

Child tables reach the rule through their parent:

```sql
create policy quotation_sections_via_parent on public.quotation_sections for all to authenticated
  using (exists (select 1 from quotations q where q.id = quotation_id and (is_owner() or q.office_id = my_office_id())))
  with check (exists (select 1 from quotations q where q.id = quotation_id and (is_owner() or q.office_id = my_office_id())));
create policy quotation_lines_via_parent on public.quotation_lines for all to authenticated
  using (exists (select 1 from quotation_sections s join quotations q on q.id = s.quotation_id
                 where s.id = section_id and (is_owner() or q.office_id = my_office_id())))
  with check (exists (select 1 from quotation_sections s join quotations q on q.id = s.quotation_id
                 where s.id = section_id and (is_owner() or q.office_id = my_office_id())));
-- same shape for: purchase_order_lines (po_id → purchase_orders), po_documents,
-- shipment_lines and shipment_documents (shipment_id → shipments),
-- invoice_lines and invoice_payments (invoice_id → invoices),
-- payment_milestones (project_id → projects),
-- commitment_lines and commitment_documents (commitment_id → commitments),
-- approval_requirements and approval_documents (approval_id → approvals).
-- Then drop each child's *_all_authenticated policy.
```

What changes for a `full` user if this is applied: the office switch in the bar would show
an empty other office and an empty BOTH view, and BOTH-mode inserts would be refused
rather than silently landing in the default office (see SCHEMA-AUDIT 6.2). The frontend
should hide the switch for non-owners at the same time. This is why it is Charles's
decision, not a code fix.

### 7.4 Let every user number a quotation and an invoice (BREAKS today)

```sql
alter function public.next_quotation_reference(uuid) security definer set search_path = public;
alter function public.next_invoice_reference()       security definer set search_path = public;
drop function if exists public.next_quotation_reference();   -- the unused legacy overload
revoke execute on function public.next_quotation_reference(uuid) from anon, public;
revoke execute on function public.next_invoice_reference()       from anon, public;
revoke execute on function public.next_po_reference()            from anon, public;
revoke execute on function public.receive_po_line(uuid, numeric, uuid, date, text) from anon, public;
```

Running as definer is safe here: each function changes one counter and nothing else.

### 7.5 Stop held stock from leaving (HIGH)

```sql
create or replace function public.refuse_issue_of_held_stock()
returns trigger language plpgsql as $$
declare p products%rowtype; w warehouses%rowtype;
begin
  if new.direction <> 'out' then return new; end if;
  select * into p from products   where id = new.product_id;
  select * into w from warehouses where id = new.warehouse_id;
  if not p.dcd_approved or (p.dcd_expiry is not null and p.dcd_expiry < current_date) then
    raise exception '% has no valid Civil Defence approval, so it cannot leave the warehouse.', p.name;
  end if;
  if not w.dcd_certified or (w.dcd_expiry is not null and w.dcd_expiry < current_date) then
    raise exception '% has no valid Civil Defence storage certificate, so nothing can leave it.', w.name;
  end if;
  if (select qty_on_hand from stock where product_id = new.product_id and warehouse_id = new.warehouse_id) < new.quantity then
    raise exception 'Only what is on hand can be issued.';
  end if;
  return new;
end $$;
create trigger stock_out_needs_civil_defence before insert on public.stock_movements
  for each row execute function public.refuse_issue_of_held_stock();
```

### 7.6 Quotation approval by owners only (*decision*)

```sql
create or replace function public.guard_quotation_approval()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') and not is_owner() then
    raise exception 'Only an owner can mark a quotation approved.';
  end if;
  return new;
end $$;
create trigger quotations_approval_is_the_owners before insert or update of status on public.quotations
  for each row execute function public.guard_quotation_approval();
```

### 7.7 Money that only owners should see (*decision*)

```sql
-- payroll, partners, bank_accounts: read and write for owners only
do $$
declare t text;
begin
  for t in select unnest(array['payroll','partners','bank_accounts']) loop
    execute format('drop policy if exists %I on public.%I', t || '_all_authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_own_office', t);
    execute format('create policy %I on public.%I for all to authenticated using (is_owner()) with check (is_owner())',
                   t || '_owners_only', t);
  end loop;
end $$;
```

If applied, the Finance tab's Salaries and Bank views must be hidden from non-owners, and
`invoice_payments.bank_account_id` and `expenses.bank_account_id` still work because they
store an id, not a read of the account.

### 7.8 Non-owners edit only their own name, language and password

```sql
create or replace function public.guard_profile_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then
    if new.role      is distinct from old.role      then raise exception 'Only an owner can change what access somebody has.'; end if;
    if new.office_id is distinct from old.office_id then raise exception 'Only an owner can move somebody to another office.'; end if;
    if new.email     is distinct from old.email     then raise exception 'Email is changed by an owner.'; end if;
  end if;
  return new;
end $$;
```

### 7.9 Let non-owners teach the scope reader (MEDIUM)

```sql
drop policy if exists spec_equivalents_write on public.spec_equivalents;
create policy spec_equivalents_insert on public.spec_equivalents for insert to authenticated with check (true);
create policy spec_equivalents_owner  on public.spec_equivalents for update to authenticated using (is_owner()) with check (is_owner());
create policy spec_equivalents_delete on public.spec_equivalents for delete to authenticated using (is_owner());
```

Or hide the Remember button for non-owners; one or the other.

### 7.10 Storage follows the tables (*with 7.3 or 7.7*)

Today every bucket is open to every login, which matches 2a. If 7.3 is applied, the
document buckets should be scoped by joining the object's path prefix (the record id) to
its table, for example for `product-docs` nothing changes (catalogue is shared), while
`po-docs`, `shipment-docs`, `commitment-docs`, `approval-docs` and `scope-docs` need a
policy like:

```sql
drop policy if exists po_docs_read on storage.objects;
create policy po_docs_read on storage.objects for select to authenticated
  using (bucket_id = 'po-docs' and exists (
    select 1 from public.purchase_orders p
    where p.id::text = split_part(name, '/', 1) and (public.is_owner() or p.office_id = public.my_office_id())));
```

### 7.11 Auth settings to change alongside

- `disable_signup: true` (7.2).
- `password_min_length: 8`, to match the app's own screens.
- Leave refresh-token rotation on; the 3600 s JWT is fine (Phase 4 covers the refresh
  symptom).

### 7.12 Tidy-ups with no behaviour change

```sql
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add  constraint profiles_role_check check (role in ('owner','full'));
```

---

## 8. Order of application, and what the frontend must change with each

| Step | Apply | Frontend change needed |
|---|---|---|
| 1 | 7.2 sign-up off, 7.4 numbering, 7.9 equivalents, 7.11 password length, 7.12 | none |
| 2 | 7.1 views to `security_invoker` | none today; required before 3 or 4 |
| 3 | 7.5 held-stock trigger | Stock.record should show the trigger's message (it already shows `error.message`) |
| 4 | *Charles decides:* 7.3 office separation, 7.7 money for owners, 7.6 approval, 7.8 profile guard, 7.10 storage | hide the office switch and the two Finance views for non-owners; block BOTH-mode inserts in the UI |

Everything in step 1 is a plain bug fix by the app's own stated rules. Steps 3 and 4 are
Phase 5 candidates only after they are agreed.
