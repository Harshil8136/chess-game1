---
title: "Why the owner's test email landed in Promotions, and what Write and Campaigns now say (2026-11-12)"
status: record
owner: vendor
last_verified: 2026-11-12
sources: [modules/email/src/before-send.ts; modules/email/src/html-text.ts; modules/email/src/design.ts; modules/email/src/write-page.tsx; modules/campaigns/src/campaigns.ts; modules/campaigns/src/pages.tsx; modules/email/test/before-send.test.ts; modules/email/test/write-composer.test.ts; modules/campaigns/test/campaigns.test.ts; docs/setup.md]
---

# Why the test email landed in Promotions

> **In plain words.** The owner sent a test email from a client's portal to a Gmail address and it
> landed in the Promotions tab. Everything about the sending was right: the domain signed it, the
> provider's return path matched the domain, the connection was encrypted, and the provider added
> no tracking. The email itself was the reason: it was a designed offer, with "Deal" in its
> subject, a big picture, a button, a hidden preview line and Unsubscribe and View in browser
> links, sent from the one address that had also sent the client's campaign. Gmail puts deals and
> offers in Promotions on purpose, from any provider. Now Write asks once before an email like that
> goes, naming each sign and the way to Primary, and names links that go nowhere; and a campaign
> sent from an address that also sends everyday email says so on its page.

## What was checked

| What | How | Found |
|---|---|---|
| The headers the owner read in Gmail | Gmail's message details, pasted by the owner | Mailed by the provider's return-path subdomain of the client's domain, signed by the client's domain, standard encryption (TLS): SPF and DKIM both align with the From domain |
| The domain's records | Public DNS (TXT, MX, CNAME) | SPF on the root covers the two other providers; the return-path subdomain carries the sending provider's own SPF and bounce MX; the provider's DKIM key is published; DMARC is `p=none`; no click or open tracking subdomain of the usual names exists |
| The provider's tracking | Its domain API documentation | Open and click tracking apply only once a tracking subdomain is set up and verified, and start off; none was found, so the email carried no tracker or rewritten links |
| The email itself | The portal's own record of what was sent (`email_written`) | A 15 KB newsletter design pasted as HTML: a hidden preview line ("Exclusive ... packages now open!"), a 600-pixel layout table, a full-width background picture, an animated badge, a button, a "Dear Traveler" greeting, and Unsubscribe, View in Browser and Contact Us links pointing to `#`, plus a button to a template's placeholder site |
| The address's history | The portal's sender and campaign rows | The one sender address has the purpose both: it sent the client's campaign (with `List-Unsubscribe`) and every Write test, most of them designed HTML |

## The cause

Gmail sorts mail into its tabs with a classifier it does not publish. Its help describes
Promotions as "deals, offers, and other promotional emails". Every guide from the providers and
the deliverability firms (Google's sender guidelines, SendGrid, Mailchimp, and the analyses
listed below) names the same signs, and the test email carried nearly all of them: an offer in the
subject, a newsletter layout, pictures, a call-to-action button, hidden text, a marketing footer,
and an address that also sends campaigns. Authentication decides between the inbox and spam, not
between the tabs: here it passed, which is why the email reached the inbox at all.

## What changed

| Area | Before | Now |
|---|---|---|
| Write, before an email goes | Asked once about a misspelt address or a forgotten file | Also asks once when two signs or more say promotion (an offer in the subject or preview line, a newsletter build, Unsubscribe or View in browser links, six links or more), naming each and the way to Primary; names links that go nowhere; **Send anyway** sends it as it is |
| Template checks | Subject, preview line, words, size, http links, button and image addresses, image descriptions | Also a warning for links that go nowhere (`#`, yourwebsite.com and the like) |
| A campaign's From | Any address the person may use for bulk mail | The same, and the page says when that address also sends everyday email, asking for an address only for campaigns |

Nothing here stops a send or changes what is sent: a designed offer is still a promotion, and
Gmail is right to file it there. The checks are pure functions on what was posted, with no query
and no provider call.

## What only the client can do

They are in [the setup page's section 6](../setup.md#6-landing-in-gmails-primary-tab-not-promotions):
send letters in Words from a person's name, give campaigns their own address, put the reply
address on the same domain, and ask regular customers to move one email to Primary.

## References

- Gmail Help, "Organize your emails into categories": https://support.google.com/mail/answer/3094499
- Google, "Email sender guidelines": https://support.google.com/a/answer/81126
- SendGrid, "How to Avoid the Gmail Promotional Tab": https://support.sendgrid.com/hc/en-us/articles/1260802576170
- Mailchimp, "About Gmail Tabs": https://mailchimp.com/help/about-gmail-tabs/
- Resend, "Update Domain" (tracking applies only with a verified tracking subdomain): https://resend.com/docs/api-reference/domains/update-domain
- Suped, "How does Gmail decide which emails go to the promotions tab?": https://www.suped.com/learn/email-deliverability/how-does-gmail-decide-which-emails-go-to-the-promotions-tab

## How it was checked

`modules/email/test/before-send.test.ts` holds the test email's shape (with the reserved example
domains) and checks every sign it names, the dead links, Spanish offer words, and that a plain
letter, a lone sign or a letter with a signature logo asks nothing.
`modules/email/test/write-composer.test.ts` checks that Write asks once and that the answer sends.
`modules/campaigns/test/campaigns.test.ts` checks the campaign's sender flag. `pnpm verify` ran
once for the batch.
