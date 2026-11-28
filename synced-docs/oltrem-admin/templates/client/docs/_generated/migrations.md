---
title: "Migrations"
status: generated
source: `migrations/` and its `kit.json`
---

# Migrations

> Written by `oltrem docs` from the files named above; never edited by hand. `oltrem docs --check` in verify refuses a stale copy.

The kit's migrations are copied in by `oltrem migrations sync` and never edited; this
client's own start at 5000. `oltrem migrations apply` runs the pending ones
before each deploy and records them in the `oltrem_migrations` table.

| Kit migration | From | Integrity |
|---|---|---|
| `0001_settings.sql` | `@oltrem/core-config` | `sha256-JQu+8AfNIrf9h1pOWmRbMikVbINXGxGdasXCDMoZ8rc=` |
| `0002_outbox.sql` | `@oltrem/core-outbox` | `sha256-wmZKF2gqz6Ic8ZQ+fvvJBwmh6UKwDYDtq1w5IopbV0A=` |
| `0003_audit.sql` | `@oltrem/core-audit` | `sha256-O8ErQnKRMk7LGHaGvO5qu7n5jMkDCxr0QA1hi+A/LmM=` |
| `0004_iam.sql` | `@oltrem/iam` | `sha256-27/BHkNqD7eP68lo/Wmf5+A+/W7IBuACdozhPuUNWec=` |
| `0005_iam_governance.sql` | `@oltrem/iam` | `sha256-lBoMsVvhVeyQZUVEd9Z2AK4HG/t3t6ng3Tl5yEvznF8=` |
| `0006_iam_handover.sql` | `@oltrem/iam` | `sha256-60RVB/KhOuJoN30ouUnJG5f0cn7kNuV+AImUyz/mTNw=` |
| `0007_users.sql` | `@oltrem/users` | `sha256-940fll6phsAdsP0uc/5q1+JCSl8Cua7bo6ePmAeNoFM=` |
| `0008_jobs.sql` | `@oltrem/core-jobs` | `sha256-4x7ml8my3WBzDcAzetLVeuQ4HAtTuC11e4/E/AuNxWE=` |
| `0009_health.sql` | `@oltrem/core-health` | `sha256-EoP2x3aOaSQYS0IVbue4j5lrL2vBxmMN6ImG9q6IzV4=` |
| `0010_providers.sql` | `@oltrem/providers` | `sha256-yP7qCBEs1fjhv6NZUnbQeAO9/DItJqc9UwtxrzQ+3sk=` |
| `0011_email.sql` | `@oltrem/email` | `sha256-cKeeG89iqW+vS2ntRUROLt9FnQkMusr7vOcWE0MIXEw=` |
| `0012_backup.sql` | `@oltrem/backup` | `sha256-Wzy6XGCAHhXy8tsc2kNC3Ep33N41v+2H4PV74j0DTI4=` |
| `0013_github.sql` | `@oltrem/github` | `sha256-OHC9mMbErHq+L0Hvc2JBKUMNe9c2RpEvs3lIIpWRLcM=` |
| `0014_budgets.sql` | `@oltrem/core-health` | `sha256-yi36WCu415VTxeVKXA2WEUvDBfEEFISWmWMySsVTWEY=` |
| `0015_alerts.sql` | `@oltrem/alerts` | `sha256-BL4iWeciZpXDigGcqkV9O9R1qU0YD06HB8iuk3ju2ko=` |
| `0016_audit_seals.sql` | `@oltrem/core-audit` | `sha256-MG3w4FibRpezDIaWe4NyS3aKjRqFe/XVeBLCWi5Oo6U=` |
| `0017_records.sql` | `@oltrem/records` | `sha256-oCgrdDB8aECMrfmbzUAOYJbesSqa8xdvf8lJqE9zoP0=` |
| `0018_forms.sql` | `@oltrem/forms` | `sha256-/JR2E7kTf+PcrSAqBh0SbCyHvtPK7HMBkUy+f4OFYo4=` |
| `0019_files.sql` | `@oltrem/files` | `sha256-LQ9OhruttmijRtMuI6vEld8RGuJ58ncChkBDBpNAiiU=` |
| `0020_campaigns.sql` | `@oltrem/campaigns` | `sha256-j6vbv8sWk7Vc0pwionfBYhdb8NqLLeKJLbQADoUyzKk=` |
| `0021_jobs_pause.sql` | `@oltrem/core-jobs` | `sha256-WCh/NiVbqY9p7ajqiMkEfplk9g5vZpBuflyydkQoP90=` |
| `0022_developer.sql` | `@oltrem/developer` | `sha256-Y2XDuhNAWQSRWh8bptq1jM5wlg2snJCM6L6zbCs7sBw=` |
| `0023_automations.sql` | `@oltrem/automations` | `sha256-H4qcCDpEBahSyTTF9RtSymQvWP7VPHmalHAl6t+XOiY=` |
| `0024_analytics.sql` | `@oltrem/analytics` | `sha256-gYnwKb0eGDON2nJHowz4uaU32H3kEegd/F6aG06GZoY=` |
| `0025_privacy.sql` | `@oltrem/privacy` | `sha256-25vHb8Ao3ZLoRgMYaOpULGgmGKPwMQEnxcWgWv9HrVw=` |
| `0026_tasks.sql` | `@oltrem/tasks` | `sha256-joEOWrrt3VogqSLFlsdAGnPuprVQdp3G7k3vidFKlWk=` |
| `0027_approvals.sql` | `@oltrem/approvals` | `sha256-u2XYMxY9aVQdKmrK7GNe2AOVf5cg9Cet3TJ5NTH8ePs=` |
| `0028_announcements.sql` | `@oltrem/announcements` | `sha256-X5vhbDjObAGJ3SWOkdqdLQRvVjfXAe9y2nG0FAqRKnU=` |
| `0029_bookings.sql` | `@oltrem/bookings` | `sha256-I8d56MkToceazI/uBGoWgnxz1yRFho13P7GCOeWP/FU=` |
| `0030_tasks_comments.sql` | `@oltrem/tasks` | `sha256-9oPMv5ROSz+lS6hSbxZMDZ124JFTX8uiEhQrbBH1o7g=` |
| `0031_jobs_queries.sql` | `@oltrem/core-jobs` | `sha256-+3fz2ktrnsDQAVTSHevbPi0Eqpy6Al2nakHMjwjwo34=` |
| `0032_timeoff.sql` | `@oltrem/timeoff` | `sha256-Mx5rNdycTY6a5KxtbObgs0y1er7e5N2F/Ty3jKP5Xbg=` |
| `0033_expenses.sql` | `@oltrem/expenses` | `sha256-79zcxaK8NKo6SIZ6YvztOrHBOMS4U2sRY79Elwy9Nr0=` |
| `0034_assets.sql` | `@oltrem/assets` | `sha256-DB/ydH96QlSPNBCrNPXCtXI9aAoiEuGO1cfxPssosPQ=` |
| `0035_timeclock.sql` | `@oltrem/timeclock` | `sha256-BYYwYDqmmD3keHcM/avCXcIn49ZXxL7JCP9eibFe1io=` |
| `0036_customers.sql` | `@oltrem/customers` | `sha256-HHXbBzDgnfG8k807BN10SZqXLZwOzMYoS/f37qbFmDQ=` |
| `0037_customers_services.sql` | `@oltrem/customers` | `sha256-9P4OLR/EI2K3ir+sY+2jJ7roijjJAW2G6BD7EbQgkO8=` |
| `0038_shifts.sql` | `@oltrem/shifts` | `sha256-5U1OopQHOCo+QHqxom6m9lfjOx1U9vWjaRd3TgMJs3U=` |
| `0039_forms_reply_to.sql` | `@oltrem/forms` | `sha256-69CV6/nx4qUcN+aRUTVn7T6dnQiqRnEIBchlSeXO3Us=` |
| `0040_files_customers.sql` | `@oltrem/files` | `sha256-MreylejtmY/RaO+Ww/JL7cf5NyJM3ii8xj4tvhscVzk=` |
| `0041_quotes.sql` | `@oltrem/quotes` | `sha256-RsXha2EUuz+ubgCL/pGgr9fG+u9bv3qNSg1onLeMTFI=` |
| `0042_invoices.sql` | `@oltrem/invoices` | `sha256-5f8chUYM+/nDPyLtQAF8CwChFzyF6KZQRbHqA96EmPc=` |
| `0043_email_outcomes.sql` | `@oltrem/email` | `sha256-9am1fMgzaDfnxCPuy5z052DwLiqBf/I3TeJ7FDjjzKE=` |
| `0044_campaigns_donotmail.sql` | `@oltrem/campaigns` | `sha256-kPAdE8opgy+HOq4xIyf2mY4/36fNKm5aAZCRmJrXIEg=` |
| `0045_email_senders.sql` | `@oltrem/email` | `sha256-5DxMOXYh43/YQg4hy1ZJt5DMmRQE+CG3vUTTLEpdiZ0=` |
| `0046_campaigns_sender.sql` | `@oltrem/campaigns` | `sha256-Fl+UYU1KCkshb4RVFjgyYYMGb3S66KLJiSudYj8fFVU=` |
| `0047_email_templates.sql` | `@oltrem/email` | `sha256-F8ptOprB6LmREShopXBap+xiWkqXhBxPG9g0TjwJ0AY=` |
| `0048_email_lists.sql` | `@oltrem/email` | `sha256-qUupC2Zsrxx20WDhtt/DGEz/mytahaTRPeUPash3VqU=` |
| `0049_campaigns_engine.sql` | `@oltrem/campaigns` | `sha256-L6kurUHAtxLjOwpsX/YaS6Rw9vwkNw3hmFmO7nX1CUg=` |
| `0050_campaigns_watch.sql` | `@oltrem/campaigns` | `sha256-fOTHoLJB3Rk9L4AZcGCZlSDfVcW1tRS0HbaIb8uheyE=` |
| `0051_providers_usage.sql` | `@oltrem/providers` | `sha256-Tt5d8MWXOtRzaV4WKQj3EGpTr2glNMoiv3UkxdkiLFo=` |
| `0052_email_written.sql` | `@oltrem/email` | `sha256-1rWOWI4pC2+hK2ghUljBuffoiwET0u67ixtI8inlPXQ=` |
| `0053_email_signatures.sql` | `@oltrem/email` | `sha256-B86ecWPc9+1wcZbQ/EoMMoB6nqLrWFJtD+6JRWGfRFs=` |
| `0054_email_template_uses.sql` | `@oltrem/email` | `sha256-wLmeJCGWBRom362VWlby9rNmNiK8rUvP0schJO4QNiM=` |
| `0055_users_views.sql` | `@oltrem/users` | `sha256-2mg6vFRWX3WVzPf+fAttVVDr9gEjMasYIWqMXeeF0VQ=` |
| `0056_users_notifications.sql` | `@oltrem/users` | `sha256-uoi4w9naKSju3aeTeCDuGBD2bwwgbSTTavyNLtMJvWo=` |
| `0057_records_trash.sql` | `@oltrem/records` | `sha256-KnTFIrykJGB/GS05ZTt7Q8eow/WX48cJpb/S/gaoWXs=` |
| `0058_iam_sign_ins.sql` | `@oltrem/iam` | `sha256-rEEL02KYGzZ3e81O0DkwyXMaW2rPkCo6wmt44O0/8/w=` |
| `0059_audit_target.sql` | `@oltrem/core-audit` | `sha256-PN2jG9/5/qV6K5G/17F4h4OpabCdIPJLiUkTnDT31Cc=` |
| `0060_alerts_waiting.sql` | `@oltrem/alerts` | `sha256-RZf0vIHuI9ls5o8BRr06ul9AsL/IEPNDsU0eOZPNyjI=` |
| `0061_customers_by_name.sql` | `@oltrem/customers` | `sha256-UeKPr55Z2P6Bzs21q84J5FFpHaYjSzTs7dtRnp9GmHM=` |
| `0062_invoices_recent.sql` | `@oltrem/invoices` | `sha256-3UasnUI7kSYGmciBugA/WJ4mc20HmvBSd0b5UBUc4WM=` |
| `0063_quotes_recent.sql` | `@oltrem/quotes` | `sha256-pN7nlA0Hff6ZgLTqvkrdvc5ge6osRw/xyfLxUc/ms+g=` |
| `0064_alerts_resolved.sql` | `@oltrem/alerts` | `sha256-+hu/q3EFiBUPlw8wxzGXOrfvDw818XDD2vQW/12pERE=` |
| `0065_iam_blocks.sql` | `@oltrem/iam` | `sha256-PO9vrdMoc8Xg0o1hBfb7+CM3Ho+LZU4BDP3AiLdcPto=` |
| `0066_backup_progress.sql` | `@oltrem/backup` | `sha256-vr180Imbp7BZRuFUzg6PRiyiJGz3t9AWgAxnBapQv20=` |
| `0067_parts_quiet_extras.sql` | `@oltrem/core-config` | `sha256-wSDFRJBPa81okd1B4BxDH19qhrT6QnMy1PqtZKMqPB4=` |
| `0068_files_passcodes_and_room.sql` | `@oltrem/files` | `sha256-/bu7ZnM4v8hCZsTsaIYpxwMEfxvA7/ViW6e0rvwKpnU=` |
| `0069_jobs_last_day.sql` | `@oltrem/core-jobs` | `sha256-7BV4M/JY8jQi66YxLzJG3koKHDuwwxBTH5JlR82SUPM=` |
| `0070_users_seen.sql` | `@oltrem/users` | `sha256-kjM4rXO2+IYmB+71RJFaV6kfS5yauV5USI+EM+bCzUw=` |
| `0071_forms_read.sql` | `@oltrem/forms` | `sha256-skdqK80gXd5M3XWo0yPutK7y51FsoXExjU5QyTPO5Vg=` |
| `0072_developer_chat.sql` | `@oltrem/developer` | `sha256-u8l9abidDix9IPWSNks38rLk8BUFJHYzOzrYBXH+FnI=` |
| `0073_connect.sql` | `@oltrem/connect` | `sha256-IX9YdnFvk43G5pUmnsgRSbNdTFu26U4zOwidoeNC5cA=` |
| `0074_parts_summary_off.sql` | `@oltrem/core-config` | `sha256-DVK4RcDG3CVamZDrhwjvjatzQxP+DrI8aYvigf7RE64=` |
| `0076_iam_ready_role_names.sql` | `@oltrem/iam` | `sha256-3U9SzObbxJ7wyWhTxtwx8yLWnlQs/x/OrfGJYxpabP4=` |
| `0077_parts_data_watch_off.sql` | `@oltrem/core-config` | `sha256-Uu1XFRlO1SOYW5z96uXJ34g1NLak/P8ZcAe8vkmC4O0=` |
| `0078_iam_drop_policy_compiles.sql` | `@oltrem/iam` | `sha256-ffLAWVzpYEkDJxeC8ol/0UJ2EVrvevbDSxvhM9Gf9pA=` |
| `0079_files_access.sql` | `@oltrem/files` | `sha256-nofTViZo6/PbKRRa+H7uugpNwIb/+LpeiMMTt5jyVc8=` |
| `0080_files_stores.sql` | `@oltrem/files` | `sha256-om8Joxp7wqLXARXdRwNsixLZhEP5HdV7sCJAzyIYg8E=` |
| `0081_files_held.sql` | `@oltrem/files` | `sha256-KrUm9X7jktu2HbsxoGzerVgC3rxA5sl9CjUwtbbaztU=` |
| `0082_files_versions_and_stars.sql` | `@oltrem/files` | `sha256-t1MIpZJa0pxAXB3xi2EL69RQBb/mepT5QDQ4lHtffdg=` |
| `0083_files_requests.sql` | `@oltrem/files` | `sha256-iA7keevyTlxx7IL+lj6qwkrssSh3+qTKKPkhI54d8lw=` |
| `0084_files_keep.sql` | `@oltrem/files` | `sha256-7mFHvZ9ZJN54c87J0DG663qkej7DG9+9G/WexsFTDAU=` |
| `0085_parts_sign_in_alerts_on.sql` | `@oltrem/core-config` | `sha256-iYc1V5kmwhBZlBknsW/s6WRlU5cexMmU4sgLHsR+LgY=` |
| `0089_iam_api_keys.sql` | `@oltrem/iam` | `sha256-5RRECkxnYYAWfNybmQCNPjbuwjidkRrHo3L9YdIKLQg=` |
| `0090_iam_api_key_limits.sql` | `@oltrem/iam` | `sha256-t58H757Gy9pfzBzylVPTizNslk9UmFwmx11ggTrBOoo=` |
| `0094_jobs_paused_until.sql` | `@oltrem/core-jobs` | `sha256-04k9+S0zrX3bPcgXsDG9WHU5/3dJvoRIyRFZlMs5E0s=` |
| `0096_alerts_manage.sql` | `@oltrem/alerts` | `sha256-gwvv5h/6hpKKuaiqFSml87/+UFMFBc+dKlFMOeMo22Q=` |
| `0097_analytics_hours.sql` | `@oltrem/analytics` | `sha256-i306GSVy4UEYDl08V6ya2G31Jng7NkGyhdGXa7Bz3nI=` |
| `0098_alerts_resolution.sql` | `@oltrem/alerts` | `sha256-g4pbPYd3OnPWqeuFKssGoPcMVFtsBSeB3XVyxw51i1k=` |
| `0101_iam_idempotency.sql` | `@oltrem/iam` | `sha256-s5Bish+Rv5tYGYxwqW9I3OC9tWnR15kzETZCXHfn+Y8=` |
| `0102_developer_rotation_replay.sql` | `@oltrem/developer` | `sha256-3Vt/LRk8FliGwIvOF1Tt7xBQKQoaayV6RXf9Ak6Xn+E=` |
| `0103_parts_unusual_off.sql` | `@oltrem/core-config` | `sha256-p2DptJEX1/3ETXsXwtphRawdAyoQdsKSn5Q8vuRUhPE=` |
| `1000_email_pinned_route.sql` | `@oltrem/email` | `sha256-CfXP4wNdiMgs31I0e+t723DpNjNZvJe+jUV9fulYpYA=` |
| `1001_mail_cloudflare.sql` | `@oltrem/mail` | `sha256-FFNWuD9hyyhaEEw6hDEuZ+k57wauc5IbaqNY6PVTp5g=` |
| `1002_mail_inbox.sql` | `@oltrem/mail` | `sha256-BCT8vtG7kEmrHTlsYgqyUv/cafoVLTrGWrX/hblgNG8=` |
| `1003_email_consent.sql` | `@oltrem/email` | `sha256-9MMSUt/RyFtQOigMCocK4TT7fatLY1XQmZG4wxRu4SQ=` |
| `1004_mail_familiar.sql` | `@oltrem/mail` | `sha256-sW7UF4J8RsTa0vb93qYc6Amebvm8tcHG7kjzM5iuijA=` |
| `1005_mail_answers.sql` | `@oltrem/mail` | `sha256-PqQTsQkMDZ+jTECqMfk5fInv6FmtaZwL8PThcoE7nzw=` |
| `1006_email_clean_lists.sql` | `@oltrem/email` | `sha256-DzCLqQo4R9+U5crUtLA0F7jz/2sSggiXq95PISxsoKI=` |
| `1007_mail_forwarding.sql` | `@oltrem/mail` | `sha256-mDVwsn+GvgL76uH9tn4pdrGWX+8Rpoqv3oDTB8rmD9w=` |
| `1008_mail_test_again.sql` | `@oltrem/mail` | `sha256-0YvROG4uNqeyZH7/ayZ+xZERhOfCyxnKPdSRKZdfm1s=` |
| `1009_email_kind_senders.sql` | `@oltrem/email` | `sha256-+GsDyVEYAU3sBCv+ZpgZDoanMIzq0rKQxMMfncvGao4=` |
| `1010_email_files.sql` | `@oltrem/email` | `sha256-LsiyMZcrk18UzEF2Xr6l52G7/6DIdzphcR+Suq5M8k8=` |
| `1011_email_files_owner.sql` | `@oltrem/email` | `sha256-ySd0NWpkgl8qUf+V9lBv6kBTH6idHpu4gicUWtyzCTA=` |
| `1012_campaigns_tally.sql` | `@oltrem/campaigns` | `sha256-GtL/1yIbpkIqYTV/eC8hujW4vyvqgKKmTQstszolk9c=` |
| `1013_email_send_proof.sql` | `@oltrem/email` | `sha256-nUHZsiq+8w5iCmghOQnpQ21+cyQzBSTcqKJCrinAtRU=` |
| `1014_campaigns_archive.sql` | `@oltrem/campaigns` | `sha256-k5+13wsUgL9nyrcGV+5vhS2Tri7FuuAip92VGeCttlo=` |
| `1015_campaigns_fields.sql` | `@oltrem/campaigns` | `sha256-uJmBD/8vFQkYYyrGX5yJhBDCmU3Qs7FrrQobXXOQIqc=` |
| `1016_mail_gmail.sql` | `@oltrem/mail` | `sha256-qwU36L+FUDgq2KVNroHFqE8Tf0H+ZZx6HCABp2/IpM4=` |
| `1017_email_code_for_senders.sql` | `@oltrem/email` | `sha256-3oZaeq/b1cueKxjLvqsqp2rs+l2DW9uaT+cMwqcSvIk=` |
| `1018_email_messages_recent.sql` | `@oltrem/email` | `sha256-Xwj9aKM5UaY/Jo+HVPlLtQSFZl8Id6J5BYgbzbiLFFA=` |
| `1019_mail_unread_and_age.sql` | `@oltrem/mail` | `sha256-J3UDpqDIQBD2coyhUT6VDMnvcml8o+n+U9EeHV7S1NU=` |
| `1020_campaigns_lighter.sql` | `@oltrem/campaigns` | `sha256-4iiJtJYbVB84Sxi6ZhEVzdRGkMgHdiXycUPL51P9fnI=` |
| `1021_email_lighter.sql` | `@oltrem/email` | `sha256-7tsz96lDB2yjBATBrFntkO0UyBXvZ87nVV9nAjv5Z8w=` |
| `1022_mail_lighter.sql` | `@oltrem/mail` | `sha256-Ur8gOCKAm8cEa6eiXlHxuX9KDcAaS0d/rKrOlTmbNAo=` |

| This client's migration |
|---|
| `0104_alerts_fix.sql` |
