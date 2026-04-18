# Fix Plan — P0 → P5

All priorities apply to the `cf-email-consumer` sidecar unless noted. Each priority is independent; P0 alone unblocks production.

---

## P0 — Remove runtime template compilation (restores email delivery)

**Goal:** make `cf-astro-email-consumer` deliver emails again.

**Approach A (recommended, 1-file change):** Convert the three Eta templates in [`cf-email-consumer/src/templates.ts`](../../../cf-email-consumer/src/templates.ts) from Eta strings to plain **tagged template-literal functions** that take the view data and return a string. No runtime compilation, no `new Function`, zero dependencies.

Sketch of what the new `templates.ts` looks like:

```ts
// Before: string with <%= it.bookingRef %> tags, rendered via eta.renderString
// After:  a function that takes view data and returns HTML directly.

export interface AdminBookingView {
  bookingRef: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  phoneClean: string;
  svc: string;
  stayText: string;
  nights: number;
  checkInDateEs: string;
  checkOutDateEs: string;
  pets: { petName: string; petType: string; petBreed: string; petAge: string;
          petWeight?: string; icon: string }[];
  hasTransport: boolean;
  transportLabel: string;
  transportAddress?: string;
  hasCare: boolean;
  specialInstructions?: string;
  timestamp: string;
  previewText: string;
  consentId?: string;
}

const esc = (s: unknown): string => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export function renderAdminBooking(v: AdminBookingView): string {
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Nueva Reservación ${esc(v.bookingRef)}</title>
<style>/* …existing inline styles… */</style>
</head><body>
<div class="preheader" style="display:none">${esc(v.previewText)}</div>
<h1>🐾 Nueva Reservación — ${esc(v.bookingRef)}</h1>
<p>${esc(v.svc)} · ${esc(v.stayText)}</p>
<ul>
  ${v.pets.map(p => `<li>${p.icon} ${esc(p.petName)} (${esc(p.petBreed)}, ${esc(p.petAge)})</li>`).join('')}
</ul>
<p>Owner: ${esc(v.ownerName)} — <a href="mailto:${esc(v.ownerEmail)}">${esc(v.ownerEmail)}</a>
— <a href="tel:${esc(v.phoneClean)}">${esc(v.ownerPhone)}</a></p>
${v.hasTransport ? `<p>Transport: ${esc(v.transportLabel)}${v.transportAddress ? ' — ' + esc(v.transportAddress) : ''}</p>` : ''}
${v.hasCare ? `<p>Care: ${esc(v.specialInstructions)}</p>` : ''}
<p><small>${esc(v.timestamp)}</small></p>
</body></html>`;
}

export function renderCustomerBooking(v: CustomerBookingView): string { /* … */ }
export function renderArcoAdmin(v: ArcoAdminView): string { /* … */ }
```

And the consumer's call site becomes:

```ts
// cf-email-consumer/src/index.ts
import { renderAdminBooking, renderCustomerBooking, renderArcoAdmin } from './templates';
// delete:  import { Eta } from 'eta';
// delete:  const eta = new Eta();

// line 213:
const html = renderAdminBooking(viewData);

// line 253:
const html = renderCustomerBooking(viewData);

// line 288:
const html = renderArcoAdmin(viewData);
```

Then:

```bash
cd cf-email-consumer
npm uninstall eta
npm run build            # or tsc
wrangler deploy
```

**Approach B (only if template authors insist on Eta syntax):** add a build step that uses `eta.compileToString` at build time to emit a `.ts` file exporting already-compiled render functions. The bundle then contains the JS source string *as code*, not as a string passed to `new Function`. More moving parts; only worth it if the templates are edited by non-engineers or there are dozens of them. We have **three** templates — Approach A is strictly simpler.

**Verification:**

1. Submit a test booking to https://madagascarhotelags.com/en/booking/.
2. `wrangler tail cf-astro-email-consumer --format=pretty` should show `[Consumer] Admin email sent for MAD-…` and `[Consumer] Customer email sent for MAD-…`.
3. Both mailboxes (`mascotasmadagascar@gmail.com` and the submitted owner email) receive the message.
4. `SELECT status FROM email_audit_logs WHERE id = <trackingId>` returns `sent_to_resend`.

**Rollback:** re-deploy version `fec61dee-c5c4-4bc6-bbc5-b45948b2e83c` via `wrangler rollback --version-id fec61dee…` if the new version regresses; that version had working delivery on 2026-04-13.

---

## P1 — Make error persistence actually work (fix the schema-drop)

**Why:** even after P0 deploys, future failures should be diagnosable from SQL alone. Right now the `emailError` field in the consumer's catch block is silently dropped.

**Change 1** — add the column to the consumer's Drizzle schema at [`cf-email-consumer/src/db.ts`](../../../cf-email-consumer/src/db.ts):

```ts
export const emailAuditLogs = pgTable('email_audit_logs', {
  id: uuid('id').primaryKey(),
  // …existing columns…
  emailError: text('email_error'),            // ← ADD THIS
});
```

**Change 2** — mirror the column in the producer schema at [`cf-astro/src/lib/db/schema.ts`](../../src/lib/db/schema.ts) so both workers agree.

**Change 3** — remove the `as any` cast at [`cf-email-consumer/src/index.ts:315`](../../../cf-email-consumer/src/index.ts#L315). It only exists to silence the TypeScript error that would have flagged this bug in the first place. Leaving it is a tripwire for the same class of issue.

**Verification:** force a bad message (e.g. pass a malformed payload) and confirm `email_error` column is populated.

---

## P2 — Re-queue / recover the 10+ lost emails

See [07-RUNBOOK-RECOVERY.md](./07-RUNBOOK-RECOVERY.md). Has to happen **after** P0 deploys. Summary:

1. Query `email_audit_logs` for `status='failed' AND created_at > '2026-04-17'`.
2. For each row, reconstruct the `payload` JSON and re-`send()` to `madagascar-emails` (producer side, one-off admin script).
3. Watch `status` flip to `sent_to_resend`.
4. Spot-check recipients.

---

## P3 — Correct `cf-astro/RULES.md` §6.5

Current rule claims Eta is edge-safe. Replace with:

> **Templating on Workers — forbidden APIs.** Never call `eval`, `new Function`, `new AsyncFunction`, or any library that does so at runtime. This includes Eta's `renderString`, `render`-of-string, `compile`, and `compileAsync`; Handlebars' `compile`; Mustache/Hogan's `compile`; any `vm`-based engine. Use plain template literals or a build-time precompile step. See `Documentation/14-BOOKING-EMAIL-OUTAGE-2026-04-18/`.

---

## P4 — Finish the domain migration cleanup

Not the cause of this outage, but flagged during investigation:

- `pet.madagascarhotelags.com` still returns 200. Create the Cloudflare Dashboard **Redirect Rule** promised in the `cf-astro/wrangler.toml` comments: `pet.madagascarhotelags.com/* → madagascarhotelags.com/$1 (301)`.
- Leave `cf-astro.pages.dev/en/booking/` as 404 (already the case) — nothing to do.

Details in [06-SECONDARY-FINDINGS.md](./06-SECONDARY-FINDINGS.md).

---

## P5 — Add a consumer smoke test and DLQ alert

Details in [08-PREVENTION.md](./08-PREVENTION.md). Summary:

1. A `cf-email-consumer` unit test that imports the handler and runs one synthetic message through `queue()` with a mocked DB/Resend. Fails CI if `renderString` or `new Function` is touched.
2. A Cloudflare Analytics alert on `madagascar-emails-dlq` depth `> 0` for more than 10 minutes.
3. A lightweight Grafana/Dashboard tile: "emails delivered last 24h" — a zero for 24h should page oncall.

---

## Priority rationale

| Priority | Fixes | Time to apply | Customer impact if skipped |
|---|---|---|---|
| **P0** | Active outage | ~30 min | Booking pipeline stays dead |
| **P1** | Observability | ~20 min | Next outage takes 5 days to spot again |
| **P2** | Past failures | ~15 min script + verify | 10+ customers stay uncontacted |
| **P3** | Docs | ~5 min | Next engineer re-introduces Eta |
| **P4** | Domain hygiene | ~10 min | SEO split / confused users on `pet.` subdomain |
| **P5** | Prevention | ~1–2 h | Same class of bug recurs invisibly |

Do P0 → P1 → P2 in one sitting. P3–P5 can land in follow-up PRs the same week.
