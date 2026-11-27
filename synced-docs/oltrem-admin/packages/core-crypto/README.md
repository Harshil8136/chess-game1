# @oltrem/core-crypto

Envelope encryption for the credentials a client Worker keeps in its database (plan section 8.4):
many tenants times many providers cannot be Worker secrets, so one key-encryption key is the
secret and everything else is a sealed string in a row. Web Crypto only, no dependency. Under
`@oltrem/core-crypto/age`, the age file format a backup copy is written in (below).

## The envelope

```ts
const envelope = await createEnvelope({ kek: env.KEK }); // once per isolate
const wrapped = await envelope.newDataKey(); // stored on the tenant's row
const sealed = await envelope.seal(wrapped, apiKey, { tenant, row: instanceId }); // stored on the instance's row
const apiKey = await envelope.open(wrapped, sealed, { tenant, row: instanceId }); // inside the request that uses it
```

| Call | What it does |
|---|---|
| `generateKek()` | a fresh key-encryption key, the value of the `KEK` secret: printed once at setup, never logged |
| `createEnvelope({ kek })` | reads the secret: one or two base64url keys of 32 bytes separated by a space, the current one first; refuses a missing, malformed, repeated or third key |
| `kekIds` | the ids of the configured keys (twelve hex characters of each key's SHA-256), the current one first |
| `newDataKey()` | a random AES-256 data key, wrapped by the current key-encryption key: `k1.<kek id>.<iv>.<ciphertext>` |
| `seal(wrapped, plaintext, { tenant, row })` | AES-GCM under the data key with a random 96-bit IV and the tenant and row as additional authenticated data: `v1.<iv>.<ciphertext>` |
| `open(wrapped, sealed, { tenant, row })` | the plaintext, when the value was sealed under this data key at this address; a value copied to another row, altered, or sealed under another key is refused |
| `needsRewrap(wrapped)` | true when the data key was wrapped by a key-encryption key that is not the current one |
| `rewrap(wrapped)` | the same data key wrapped by the current key-encryption key |
| `masterKey(stored, secret)` | the KEK as the envelope takes it (a promise is fine): the Secrets Store binding's value first, the Worker secret beside it while a portal moves, two keys at most; a store that cannot be read falls back to the secret |

**Where the KEK lives** (2026-11-27, the owner's pick): in the account's Cloudflare Secrets Store,
bound as `KEK_STORE`, where a change shows in the account's audit log and a person who may deploy
Workers cannot replace it; portals set up before keep the `KEK` Worker secret until `npm run
deploy` moves it (`@oltrem/cli` kek-store.ts). A Worker can only read a stored secret, so the
credentials themselves stay sealed in the database: Secrets Store holds one key per portal, never
the keys people add.

## Rotation with one secret name

The kit has no second secret for the previous key (R-09): the `KEK` secret holds the new key and
the old one, separated by a space, for as long as the rotation takes. The first key wraps; any
key in the list unwraps. The procedure: set `KEK` to `<new> <old>`, rewrap every stored data key
(`needsRewrap` finds them), then set `KEK` to `<new>`. A data key wrapped by a key the Worker no
longer has is refused with `KIT-E-1303`, which names the key's id; putting the old key back
beside the current one recovers it. The steps a person follows, with the command that makes a
key, are the `KEK` key recipe of `@oltrem/providers`; it says to keep the key, since Cloudflare
never shows a secret back and a rotation needs the old one.

## What the caller owes

- Decrypt only inside the request that uses the value; never write a plaintext or a wrapped key
  to a log, an error, or an audit row (the audit log refuses fields that look like credentials).
- Store the wrapped data key on the tenant and the sealed value on the row it belongs to, and pass
  that same tenant and row to `open`: the binding is what refuses a value moved between rows.
- Audit every create, rotate and failed use, with the actor: the envelope has no actor and writes
  no row. The providers module does this.
- Unwrapped data keys are kept in memory per isolate, the newest `CACHE_LIMIT` (64); nothing is
  cached across isolates.

## The age format, for backup copies

`@oltrem/core-crypto/age` writes the standard age format (C2SP age v1) to one X25519 recipient,
the `age1…` public key from `age-keygen`, so a backup copy opens with the age tool and a private
key the Worker never holds (plan 9.3). Encryption only: nothing in the kit decrypts.

| Call | What it does |
|---|---|
| `ageEncryptStream(recipient)` | a stream that turns plaintext into an age file: the header with its MAC and the payload nonce first, then the plaintext in 64 KiB chunks under ChaCha20-Poly1305, the last chunk marked |
| `ageEncrypt(recipient, bytes)` | the same for bytes held in memory |
| `ageEncryptedSize(n)` | the file's size for `n` bytes of plaintext, known before any byte is written, so a copy can be stored as a stream of known length |
| `parseRecipient(text)` | the 32-byte public key of an `age1…` recipient, its bech32 checksum checked |

X25519, HKDF and HMAC are Web Crypto. ChaCha20-Poly1305 is not in Web Crypto, so it is the
runtime's native cipher through `node:crypto`: a Worker that imports this entry turns on the
`nodejs_compat` compatibility flag. The main entry does not import it, so the envelope's users
need no flag. No package is added: the age library for JavaScript would bring five, and its
cipher in plain JavaScript would spend far more of a request's CPU time than the native one.

## A seal for one trip

`oneTimeKey()`, `sealTo()` and `openSealed()` (one-click connect): the portal makes a P-256 key pair
for one sign-in trip and keeps the private half in a short cookie, sealed under the KEK; the connect
relay, which stores nothing, seals what the service answered to the public half with its own
long-term key pair; only the portal that started the trip, in the same browser, opens it, and only
when the relay's key sealed it.

| Call | What it does |
|---|---|
| `oneTimeKey()` | `{ publicKey, privateKey }`: the raw public point, base64url (87 characters), and the private half as a JWK in JSON |
| `sealTo(publicKey, plaintext, aad, from?)` | ECDH with the sender's key pair `from` (a fresh one when left out), HKDF-SHA-256 (the two public points as salt) to an AES-256-GCM key, `aad` as additional data: `s1.<sender's public key>.<iv>.<ciphertext>` |
| `openSealed(key, sealed, aad, from?)` | the plaintext, when it was sealed to this key's public half with the same `aad` and, given `from`, by that sender's key; anything else is `KIT-E-1305` |

The connect relay uses `<service>:<nonce>` as `aad`, so an answer moved to another trip or another
service does not open, and seals with its own key, which the portal names when it opens: someone who
knows the trip's public key cannot seal an answer that opens, since only the sender's private half
reaches the same AES key.

## Errors

`KIT-E-1301` no `KEK` secret (503); `1302` the secret is malformed; `1303` a data key wrapped by
a key this Worker lacks (503); `1304` a wrapped key or sealed value in a shape this package did
not write; `1305` a sealed value that did not open (moved, altered, or another key); `1306` a
seal or open asked without its tenant and row; `1307` a recipient that is not an `age1…` key.

## Tests

| File | Covers |
|---|---|
| `test/envelope.test.ts` | Sealed and opened at its address, two seals different, the empty value allowed; refused at another tenant or row, altered, under another data key, malformed or without its address; a key opened under the next KEK with the old beside it, rewrapped, refused once the old is gone; the secret refused when missing, malformed, repeated or three keys long |
| `test/age.test.ts` | A known-answer file the age tool decrypted, pinned by digest; the header's shape and `AGE_HEADER_SIZE`; the size formula at every chunk boundary; a stream in uneven pieces equal to one written at once; bad recipients refused |
| `test/one-time.test.ts` | Opened by its key for its trip, two seals different; refused with another key, trip or service, altered or malformed; a named sender's seal only |
