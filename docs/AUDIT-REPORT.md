# Build-Tech Pro — review and repair

**For Charles and Chris. Plain English, no jargon.**
**Date:** 11 September 2026

---

## The six things Charles reported

Each in one line: what he reported, what was wrong, what changed, what he will see now.

1. **Every product should carry two supplier sheets (a technical data sheet and a safety
   data sheet).** Nothing in the system told anyone which products were missing them. Now a
   red flag appears on the catalogue, on the product page, and on the shipping request for
   any product missing either sheet; the catalogue has a "Missing sheets" filter; and the
   home screen lists how many products still need one. Nothing is blocked — it only flags.

2. **Creating an order from a quotation said "created" but the order was empty.** The order
   page asked the catalogue for a column that does not exist, the request failed, and the
   failure was hidden, so every order opened blank. That is fixed; orders show their lines,
   value and received percentage. Orders now also go through **draft → waiting for approval →
   approved → sent**, an owner alone can approve, and the order prints on the office
   letterhead to send to Krypton.

3. **The scope reader produced a wrong quotation.** The reading of the document was fine; the
   draft it built was not. It applied a per-square-metre cost to lines measured in metres or
   as a lump sum (a skirting came out about five times its real rate), it printed the reader's
   own working notes on the client's sheet, it threw away the client's own wording, and it
   ignored "at 6 mm". All of that is fixed: only square-metre lines take a per-square-metre
   cost, the reader's notes go into internal meeting notes that never print, the bill's own
   wording stays on the line, and a stated thickness now changes the quantity of material.

4. **The shipping request could not get into an order.** It only ever lived on the quotation.
   Now the shipping request has a "Create an order from this request" button that builds a
   draft purchase order from the same cargo, ready to approve, send and print.

5. **A new product could not be created from inside the quotation editor.** The picker only
   offered what was already in the catalogue. Now "Add product" on a section can create a new
   product on the spot — name, category, consumption, a pack and a price — and it becomes a
   real catalogue product. "New product" was also added to the catalogue page, where before
   there was no way to add one at all.

6. **Building a quotation should be easier, but the printed sheet must not change.** The
   printed sheet, the PDF and the layout are **byte-for-byte unchanged**. Around them:
   picking a product now writes its specification line for you, a new section starts from the
   previous section's area, a single "Save & PDF" button replaces save-then-print-then-fiddle
   with the dialog, and the colour blocks now print without the browser's "Background
   graphics" box.

---

## 1. What was reviewed

The whole application. It is one file of about 14,000 lines that runs the entire business —
clients, visits, the sales pipeline, quotations, projects, purchase orders, shipments, stock,
invoices, payments, partners and payroll. Every line was read. The database behind it was
examined in full: every table, every view, every rule, every automatic action. The review
ran in eight passes: map the system, check the database matches the code, check security,
hunt for bugs, investigate the "refresh signs me out" complaint, fix what was found, build an
automated test suite, and prove the tests left no trace.

## 2. What was found

Grouped by how much it matters to the business.

**Serious — money or data could be wrong, or anyone could get in.**
- Anyone on the internet could create a full account and see and change everything in both
  offices. Sign-up was left open and every new sign-up was given full access.
- Belgian invoices were impossible: every invoice used Dubai's company name, tax number,
  bank details, 5% VAT and dirham wording, whichever office raised it.
- Money going out was only ever counted in dirhams, so a euro cost from the Belgian account
  reduced the balance by the wrong amount.
- The quotations list showed a subtotal and margin that quietly included the build-up
  (the products a line is made of), so the figures on the list did not match the sheet.
- Saving a quotation deleted everything first and then re-added it with no safety net; a
  failure halfway through could leave the quotation empty in the database.
- The empty-order bug (Charles's item 2) and the wrong-scope-quotation bug (item 3).

**Important — a feature was broken, or broke under some input.**
- Non-owners could not number a quotation or an invoice at all.
- Stock marked "held" for Civil Defence could still be issued, and stock could go negative.
- In the company (BOTH) view, figures from the two offices were added together as if a euro
  and a dirham were the same number.
- A record created in the company view was filed under a fixed office (Dubai), so a Belgian
  user's work landed in Dubai's books.
- A failed "add a row" turned the whole screen blank instead of showing the error.
- The home-screen money chart was labelled a month behind for the first hours of each month.
- A pricing value typed with a comma or a percent sign became "not a number" and silently
  emptied costs.

**Smaller** — dozens of lesser items, listed in the detailed findings.

## 3. What was fixed, and why it matters

- **Invoices now belong to their office.** A Belgian invoice carries the Belgian company
  name, tax number, bank details, 21% VAT and euro wording, and its own number series.
- **The company view adds up honestly.** Euros and dirhams are converted at the rate in
  Settings before being added, and the screen says so under the total.
- **Orders work and are controlled.** They show their lines, need an owner's approval before
  they are sent, record who did what, and print on the office letterhead.
- **The scope reader builds an honest draft.** Right costs on the right lines, the client's
  wording kept, thickness respected, and the reader's own notes kept off the client's sheet.
- **Held stock cannot leave**, and stock cannot go negative.
- **Everyone can number quotations and invoices.** The two numbering steps were given the
  rights they needed.
- **A failed save now says so** instead of blanking the screen, and a quotation is saved in
  one safe step that cannot leave it empty.
- **New products can be created** from the catalogue and from inside a quotation.
- **Missing data sheets are flagged** everywhere a person would want to know.
- **Building a quotation is easier** without any change to the printed sheet.

## 4. The business decisions, taken and applied

Charles decided these on 11 September 2026. Each is now built and tested; none is a code
fault, each is a rule about how the company works.

- **The two offices are walled off in the database.** A person sees and writes only their
  own office; an owner sees both. Documents follow their records. A person not yet given
  an office counts as Dubai until an owner moves them, under Settings, "Who can get in".
- **Approval is for the owners.** An order, and now a quotation too, is marked approved by
  an owner only: Charles, Chris once he is given owner rights, and anyone else made an
  owner. Nobody else is offered the button, and the database refuses it anyway.
- **Salaries, the partner ledger and the bank balances are the owners' to see.** The
  Finance tabs for them are gone for everyone else, and the home screen says so.
- **A person who is not an owner can change only their own name, language and password.**
- **Belgium keeps its books here.** A cost or a salary is taken off a bank account in the
  account's own currency; a euro cost no longer takes 4.27 times as much off a Belgian
  account. Project costs and the partner ledger are in their office's money.
- **Orders are numbered by their office**, as quotations and invoices already were.
- **The catalogue's suggested sell price is the quotation editor's figure**, with the
  installation rate shown separately instead of folded in.
- **A second priced line in a section still counts as build-up**, as your quotations are
  written, and the section now says so and how to charge it instead.

Left as they are, being structural choices worth a conversation rather than faults: the
two sales funnels (Visits and Pipeline) and the ledger that duplicates Zoho.

## 5. What testing was done, and where

An automated suite now drives the real application in a browser and checks real figures, not
just "it didn't crash". It covers each fix individually and runs seven full journeys: the
whole job lifecycle, office isolation, permissions, input abuse, session and refresh, network
failure and offline, and Charles's own scope-to-order path.

**All of it ran against an isolated copy of the database, never the live system.** The app
served to the test browser can only reach the test project; it refuses to load otherwise.
Every record a test created was tagged and deleted afterwards, and a final check proved that
**no tagged row remained in any table**. The one thing a delete cannot undo is a used
quotation or invoice number: testing advances those counters, and they never go backwards.
That is the single strongest reason these tests must never run against the live system, and
they were built so they cannot.

## 6. Risks that remain

- **The two sales funnels** and **the second ledger duplicating Zoho** are structural choices
  worth revisiting.
- **Everyone is Dubai until moved.** After the deploy, each Belgian user has to be moved to
  Bruges once, under Settings, "Who can get in"; until then they see Dubai's records.
- **There was no version history before this review.** Every change from here can be undone;
  everything before it cannot be compared against.
- **The application is one very large file.** It works, but it is harder to change safely than
  a system split into parts. That is a long-term consideration, not an urgent one.

## 7. Recommended next steps, in order

1. **Close the open sign-up** — it is a one-line setting and the biggest exposure.
2. **Give Chris owner rights** (Settings, "Who can get in", "Give them the dials") so he can
   approve orders and quotations, and **move each Belgian user to Bruges** on the same screen.
3. **Get the two supplier sheets onto every product** — the flags now show exactly which are
   missing.
4. **Decide on the two sales funnels** and the ledger next to Zoho, when convenient.
5. **Keep the version history going**, so future changes stay reversible and comparable.

## 8. Putting it live: the steps only you can take

Everything above was built and proven on a separate test copy of the database. Nothing has
been changed on the live system. To take it live, in this order:

1. **Apply the sixteen database changes to the live project**, in numerical order, through
   the Supabase SQL editor: `migrations/0059_…` to `migrations/0074_…`. Each one is written so
   it can be run twice without harm, and each records itself in `applied_migrations`. Take
   a backup first (Dashboard → Database → Backups).
2. **Close the open sign-up** in the live project's Authentication settings: turn off
   "Allow new users to sign up" and set the minimum password length to 8. (Migration 0061
   also refuses an uninvited sign-up at the database, so both walls are up.)
3. **Publish the new `index.html`** to the Cloudflare site, exactly as the current one is
   published. There is no build step and no new dependency.
4. **Revoke the two access tokens** that were used for this review (Supabase → Account →
   Access tokens): the read-only one for the live project and the one for the test project.
   Both were shared in writing during the review and should not outlive it.
5. **Check the invoice letterhead once.** A Dubai invoice now prints the office's legal name
   (BUILD TECH PROTECTION MATERIALS L.L.C), which is what the quotation sheet already
   printed; the old setting printed "Build-Tech Pro". No invoice has been issued yet, so
   nothing already sent is affected. The Dubai TRN is still blank in Settings and should be
   entered before the first tax invoice.
6. **Delete the test project** when you no longer need it, or keep it as the place to try
   things: the test suite can only ever run against it.

7. **On the first sign-in after the deploy**, go to Settings, "Who can get in": give Chris
   owner rights, and set each Belgian colleague's office to Bruges. Until that is done a
   person with no office works in Dubai.

