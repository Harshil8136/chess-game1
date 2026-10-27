# @oltrem/forms

Forms for the company's website, and the inbox where what arrives is taken, answered and tracked
(the owner's second pick for every kind of business, 2026-10-22). Contact, quote requests,
feedback, sign-ups, or any other form: the company designs it with no code, pastes the code it
gets onto its website, and every answer lands in the portal. Nothing in the module knows one kind
of business from another.

## Using it

```ts
import { createApp } from '@oltrem/core-http';
import { createForms } from '@oltrem/forms';
import { createIam } from '@oltrem/iam';

const bindings = (env: Env) => ({ kv: env.CACHE, db: env.DB });
const iam = createIam<Env>({ bindings, audience: (env) => env.ACCESS_AUD });
const forms = createForms<Env>({ bindings, send: (env, message) => sendEmail(env, message) });
const app = createApp<Env>({
  modules: [iam.module, forms.module],
  startup: iam.startup,
  session: iam.sessions.hook,
  authorize: iam.sessions.authorize,
});
```

`createForms` returns the `store` functions and the module manifest. It stands on the IAM module:
the same sessions and authorizer, the same audit wrapper. `send` is how the portal sends an
email; the client template hands in the email module's, with one plain template
(`forms.message`). Without `send`, no reply goes by email and nobody is told of new answers.

## Who may do what: the place of a form

Four capabilities, on bit plane `11`: `forms.read` sees a form and its answers;
`forms.handle` takes an answer, marks it new, open or done, and adds notes and email replies;
`forms.remove` removes answers; `forms.design` makes forms, changes their fields and settings,
gives one a new address, and removes it with its answers. They join every Owner role when the
Worker starts, like every capability.

A form sits at one place (an IAM scope). A role held at that place, or above it, decides what a
person may do with its answers, exactly as for a list of `@oltrem/records`. A form the person
may not see answers as one that is not there (`KIT-E-0404`). A form whose place was removed
belongs to the company.

## The public address

A website posts to `POST /hooks/forms/<key>`, the module's one hook, which answers before the
sign-in. The key is sixteen random letters and digits, made with the form and replaced on demand
(the old address then stops taking answers). The portal's door must let the `hooks` path through
for a visitor's website to reach it; `npm run deploy` prints that step.

The address checks everything itself:

- the key names a form that is taking answers, or the answer is `404`;
- a form's own encoding (either kind) or a JSON object, at most 512 KB; anything the form does not
  ask (a button's name, say) is ignored;
- each value against its field: needed ones present, a needed tick box ticked, a number, a date,
  an email address, a phone number, one of a choice's choices, text within its length;
- a hidden field, `_hp`, that a person never fills: when a robot fills it, it is thanked and
  nothing is kept;
- five answers from one sender in ten minutes, and 500 a day for the form, then `429`. The sender
  is a one-way digest of their network address and the form; the address itself is not kept.

A browser gets a small page: thanks, or what to correct, with a link back to the page it came
from; a form may send people to a page of the website instead after sending. A script that asks
for JSON gets `{ "ok": true }` or the problem, readable from any website.

## Fields

Eight kinds: short text (200 characters), long text (4000), email, phone, number, date
(year-month-day), choice (two to twenty choices), and tick box. A field's id is made from its
name (`Your name` is sent as `your_name`), so the website's code reads plainly. A form has at most
20 fields and a company at most 50 forms. Removing a field stops the form asking it; answers
already in keep every value the sender gave, with the field's name as they saw it.

## The inbox

Answers are newest first, narrowed by status (to do, which is new and open together; new; open;
done; all), by the ones the person took, and by a search across their text, a page at a time. An
answer's name in the inbox is its first short text, email or phone. Taking an answer, or noting
or replying to a new one, opens it. A reply goes by email to the first email address the sender
gave, from the company's sending address, with the person replying as the address a reply comes
back to; it is kept beside the notes. The download (`GET /forms/:id/export`) is a CSV file of up
to 5000 answers, oldest first, with formulas defused as in `@oltrem/records`.

The people a form names (up to five addresses) are told by email when an answer arrives: a link to
the inbox, never what was sent, and at most one email per form in 15 minutes.

## The routes

| Routes | Capability | What they do |
|---|---|---|
| `GET /forms` | `forms.read` | the forms the person may see, with their new and total answers, and the places where they may make one |
| `POST /forms`, `PATCH /forms/:id`, `DELETE /forms/:id`, `POST /forms/:id/key` | `forms.design` | make a form with its starting fields; change its name, line, place, whether it takes answers, the page after sending and who is told; remove it with its answers; give it a new address |
| `POST /forms/:id/fields`, `DELETE /forms/:id/fields/:field`, `POST /forms/:id/fields/:field/move` | `forms.design` | add a field at the end; remove one; move one up or down |
| `GET /forms/:id`, `GET /forms/:id/entries`, `GET /forms/:id/entries/:entry`, `GET /forms/:id/export` | `forms.read` | a form with its fields, address and what the person may do; its answers (`view`, `mine`, `q`, `limit`, `offset`) with the count per status; one answer with its notes; the CSV file |
| `PATCH /forms/:id/entries/:entry`, `POST /forms/:id/entries/:entry/notes` | `forms.handle` | mark an answer, take it or let it go; add a note, or a reply by email |
| `DELETE /forms/:id/entries/:entry` | `forms.remove` | remove an answer with its notes |

Every change people make is audited (`forms.form-create`, `-update`, `-remove`;
`forms.key-renew`; `forms.field-add`, `-remove`, `-move`; `forms.entry-update`, `-note`,
`-remove`), the refusals as much as the successes, with ids only: never what an answer or a note
says. An answer arriving through the public address is the system's `forms.answer`, naming the
answer, the form and its place and nothing the person wrote, so webhooks and automations hear of
it; the answer itself keeps when it came.

The module has no card on Home: Home reads a card without the person, and a count of every form's
answers would tell someone about forms their places do not show them.

## Tables

Migration `0018_forms.sql`, additive and idempotent, in the one ledger `oltrem_migrations`:
`forms_forms` (the form, its tenant, place, name, line, fields as JSON, public key, whether it
takes answers, the page after sending, who is told and when they last were), `forms_entries`
(each answer as the sender saw it, the address to reply to, its status, who took it, the
sender's digest, its search text, when it came and changed) and `forms_notes` (each note or
reply, who wrote it, when).

## Errors

The module owns the `2300` to `2399` block: `KIT-E-2301` a value does not fit its field,
`KIT-E-2302` the limit of forms or fields is reached, `KIT-E-2303` another form has that name,
`KIT-E-2304` there is no email to answer (no address in the answer, or no email in the portal),
`KIT-E-2305` too many answers from one sender or in one day. A form that is not there or not
visible is the core's `KIT-E-0404`; a change the person may not make at the form's place is the
core's `KIT-E-0403`.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module, on a company with two
places under it, four roles and five people: the manifest; a form made with field ids from their
names, a name taken in another case, a one-choice field, a wrong address to tell and a page after
sending that is not a web address refused; forms seen only where a role reaches their place; the
public address taking an answer with no sign-in, refusing a missing value and an unticked box,
thanking a robot and keeping nothing, refusing an unknown key and a closed form, answering a
script in JSON, slowing a sixth answer from one sender while another sender passes, sending
people to the website's own page; the people named told once, with a link and none of the
answer; the inbox's views, counts, search, taking, a note, an email reply to the sender with the
person's address to answer to, a reply refused when the answer has no email, removal by role;
fields added, moved and removed while an old answer keeps its field; the CSV with a formula
defused; a new address stopping the old one; a form removed with its answers and notes; every
change and every website answer audited without what was sent.
