# @oltrem/forms

Forms for the company's website (contact, quote requests, feedback, sign-ups, any other), designed
with no code, pasted onto the website, and an inbox where answers are taken, answered and tracked.
Nothing in it knows one kind of business from another.

## Using it

```ts
const forms = createForms<Env>({ bindings, send: (env, message) => sendEmail(env, message) });
const modules = [iam.module, forms.module /* , ... */];
```

It returns `store` and the manifest and stands on IAM (sessions, authorizer, audit). `send` is the
email module's, with the plain `forms.message` template; without it no reply goes by email and
nobody is told of new answers.

Four capabilities on bit plane 11, read at the form's place (an IAM scope; a role there or above
decides, as for `@oltrem/records`): `forms.read` (a form and its answers), `forms.handle` (take,
mark, note, reply), `forms.remove` (answers) and `forms.design` (make, change, new address, remove
with answers). A form the person may not see is `KIT-E-0404`; one whose place was removed belongs
to the company.

## The public address

A website posts to `POST /hooks/forms/<key>`, the one hook, before sign-in. The key is 16 random
letters and digits, replaced on demand (the old one then stops). The portal's door must let `hooks`
through; `npm run deploy` prints that step. Limits are `LIMITS` in `src/forms.ts`.

| Check | What happens |
|---|---|
| The key | Names a form taking answers, else `404` |
| The body | Form encoding (either kind) or JSON, 512 KB; fields the form does not ask are ignored |
| Each value | Needed ones present (a needed box ticked); number, date, email, phone, one of the choices, text within its length (`KIT-E-2301`) |
| The trap | `TRAP` (`_hp`), never filled by a person: a robot is thanked and nothing kept |
| The pace | `burst` (5) from one sender in `burstMinutes` (10), `daily` (500) for the form, then `429` (`KIT-E-2305`). The sender is a one-way digest of address and form; the address is not kept |
| The answer | A browser gets a small page (thanks, or what to fix, with a link back) or the form's own page after sending; a script asking for JSON gets `{ "ok": true }` or the problem, from any website |

The people a form names (`notify`, 5 addresses) are emailed a link to the inbox, never what was
sent, once per form in `notifyMinutes` (15).

## Fields

`FIELD_KINDS`: short text (`text` 200), long text (`longText` 4,000), email, phone, number, date
(year-month-day), choice (2 to `options` 20), tick box. A field's id comes from its name (`Your
name` is `your_name`). `fields` (20) a form, `forms` (50) a company (`KIT-E-2302`); names unique
(`KIT-E-2303`). A removed field stops being asked; old answers keep every value with the name the
sender saw.

## The inbox

| Part | What it does |
|---|---|
| Views | `VIEWS`: todo (new and open), new, open, done, all, unread; the ones the person took; a search; a page at a time, newest first. An answer is named by its first short text, email or phone |
| Taking | Taking, noting or replying to a new answer opens it |
| Replies | By email to the sender's first address, from the company's sending address, replies coming back to the person; kept beside the notes (`KIT-E-2304` with no address or no email) |
| Read and unread | Unread for the whole team until first opened: bold, its view and `unread` count from the same grouped read. The page marks it once shown (`data-seen`), so a prefetch marks nothing; **Mark unread** puts it back. Not audited |
| Download | `GET /forms/:id/export`: CSV of up to `export` (5,000), oldest first, formulas defused; a cut file is named `-first-5000` |

## The routes

| Route | Needs | What it does |
|---|---|---|
| `GET /forms` | `forms.read` | The visible forms with new and total answers, and the places where one may be made |
| `POST /forms`, `PATCH /forms/:id`, `DELETE /forms/:id`, `POST /forms/:id/key` | `forms.design` | Make (with starting fields); change name, line, place, open, page after sending, who is told; remove with answers; new address |
| `POST /forms/:id/fields`, `DELETE /forms/:id/fields/:field`, `POST …/:field/move` | `forms.design` | Add at the end, remove, move up or down |
| `GET /forms/:id`, `/entries` (`view`, `mine`, `q`, `limit`, `offset`), `/entries/:entry`, `/export` | `forms.read` | The form, its answers with counts, one with its notes, the CSV |
| `POST /forms/:id/entries/:entry/read` | `forms.read` | `{ read: true }` (or no body) or `false`; 204 |
| `PATCH /forms/:id/entries/:entry`, `POST …/notes` | `forms.handle` | Mark, take or let go; a note, or an email reply |
| `DELETE /forms/:id/entries/:entry` | `forms.remove` | Removes it with its notes |

Module parts: search (forms by name or line, then answers by text, titled by sender), Needs you
(forms with untaken answers where the person holds `forms.handle`, oldest first), Reports under
Customers (answers, forms answered, not taken, per day and per form; the funnel's enquiries), the
privacy answer (every answer from or naming the address, with fields, state and notes), and a
customer's "Your messages" on `/account`: the newest 20 sent with their proved address, form, time,
state (Received, Being handled, Done) and staff's email replies, never the answer or the notes. No
Home card: it would count forms a person's places do not show.

Audited with ids only, refusals too: `forms.form-create`, `-update`, `-remove`, `forms.key-renew`,
`forms.field-add`, `-remove`, `-move`, `forms.entry-update`, `-note`, `-remove`. An arriving
answer is the system's `forms.answer` (answer, form, place, nothing written), so webhooks and
automations hear of it.

## Tables and errors

| Migration | Adds |
|---|---|
| `0018` | `forms_forms` (place, name, line, fields as JSON, key, open, page after, who is told and when), `forms_entries` (values as seen, reply address, status, taker, sender digest, search text) and `forms_notes` |
| `0039` | An index on the reply address in lower case, for the account page |
| `0071` | `forms_entries.read_at`, every answer already in marked read, and the index `forms_entries_unread` |

Block `2300`–`2399`: `KIT-E-2301` a value does not fit, `2302` the limit of forms or fields, `2303`
the name is taken, `2304` no email to answer, `2305` too many answers. Not visible is `KIT-E-0404`,
not allowed at the place `KIT-E-0403`.

## Tests

`test/forms.test.ts`, in the Workers runtime on a company with two places, four roles and five
people: the manifest; ids from names, a name taken in another case, a one-choice field, a bad
address to tell or page after refused; forms seen by place; the public address taking an answer,
refusing a missing value or unticked box, thanking a robot, refusing an unknown key or closed form,
JSON for a script, the sixth answer from one sender slowed while another passes, the page after;
the people told once with a link only; views, counts, search, taking, notes, replies (refused with
no address), removal by role; read and unread, refused to someone who cannot see the form,
migration `0071`; fields added, moved and removed while old answers keep theirs; the CSV defused;
a new address; a form removed with everything; audit without content; a customer's messages; search
by place.
