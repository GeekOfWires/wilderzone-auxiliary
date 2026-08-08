# TribesNEXT community API — protocol notes

> Status: historical/reference. The suite talks to Thyth's live endpoints
> using this dialect. The self-hosted replacement API design is shelved at
> `../../wilderzone-clans-api-plan.shelved.md` (workspace root).

Assembled 2026-08-04 from: the original client scripts (`tournamentNetClient2.zip`,
and the completed versions in the public TribesNext/t2-scripts repo), the published
PHP sources (`json_session.phps`, `json_browser.phps`), and live unauthenticated
probing of `tribesnext.thyth.com`. All endpoints verified alive on 2026-08-04.

## Endpoints

| Endpoint | Transport | Auth | Format |
|---|---|---|---|
| `/tn/robot/robot_login.php` | HTTP :80 and HTTPS :443 | none (RSA challenge) | line-based |
| `/tn/robot/robot_browser.php` | HTTP :80 and HTTPS :443 | robot session | tab-separated lines |
| `/tn/robot/robot_mail.php` | HTTP :80 and HTTPS :443 | robot session | tab-separated lines |
| `/tn/json/json_session.php` | HTTPS (HTTP also served) | password | JSON |
| `/tn/json/json_browser.php` | HTTPS (HTTP also served) | any valid session | JSON (optional JSONP) |

Server header: Apache + PHP/5.5.25 behind a Caddy proxy. Plain HTTP on port 80 is
served directly (no HTTPS redirect), which is what makes the RC client flavor
(vanilla TCPObject, no TLS) possible.

## Robot session (robot_login.php)

Line-based responses (no tab fields; `PREFIX: value` or bare status words):

1. `GET ?guid=<guid>&nonce=<hex>` → `CHALLENGE: <hex>`
   - Nonce: random hex, half the length of the account RSA modulus, starting
     with `1`. The challenge is RSA-encrypted with the account public key and is
     cached server-side per GUID for a server-configured lifetime (repeat
     requests return the same challenge).
2. Client decrypts with the account private key, verifies the nonce prefix,
   then `GET ?guid=<guid>&response=<decrypted-suffix-hex>` → `UUID: <uuid>`
3. Keepalive: `GET ?guid=<guid>&uuid=<uuid>` → `REFRESHED`
4. `TIMEOUT` — session expired; renegotiate from step 1.
5. `ERR: <msg>` — e.g. `ERR: No GUID specified.`, `ERR: Invalid user.`
   (probed live). Client backs off quadratically on errors.

Clients MUST sanity-check that the challenge is lowercase hex only before
decrypting (the original client rejected "hostile challenge payloads"), and
verify the decrypted text starts with the nonce they sent.

Default client refresh interval: 600 s.

## Robot browser (robot_browser.php)

All requests carry `guid` + `uuid`. Replies are tab-separated lines after the
HTTP headers. Known lines:

- `CEC <escaped cert>` — the account's community certificate. Fields after
  `collapseEscape`: `DCENum  IssuedEpoch  ExpireEpoch  IssuedForGUID  HexBlob  Sig`.
  The HexBlob is the hex-encoded getAuthInfo() record (name, active tag,
  memberships). Clients store it in `$T2CSRI::CommunityCertificate` and re-fetch
  60 s before `ExpireEpoch`.
- `DCE <escaped cert>` — a delegation cert:
  `DCEName  DCENum  Issued  Expire  0  0  e  n  sig`, stored in
  `$T2CSRI::ClientDCESupport::DCECert[DCENum]`.
- `ERR BROWSER <type>` — e.g. `ERR	BROWSER	UNAUTHENTICATED` (probed live).

`method=cert` is the cert-fetch request. The full method vocabulary is
implemented client-side in t2-scripts `community/browser.cs` (see that file;
the robot PHP source was never published).

## Robot mail (robot_mail.php)

Same session scheme. Unauthenticated reply is `ERR	MAIL	UNAUTHENTICATED`
(probed live). Method vocabulary per t2-scripts `community/mail.cs` header
(as of RC3): inbox / sentbox / deleted box listing, view message, ignore list,
buddy list, add/delete ignore, add/delete buddy, delete/undelete message,
message counts (read/unread), send message. See `community/mail.cs` for the
exact query parameters and reply line formats.

## JSON session (json_session.php) — server plugin

Published source: `json_session.phps`.

- `GET ?method=login&un=<username>&pw=<password>` →
  `{"status":"success","uuid":"...","guid":"...","message":"logged in"}` or
  `{"status":"error","message":"user or password invalid"}`
- `?method=logout&guid=&uuid=` → `{"status":"success"}`
- Optional `&jsonp=<callback>` wraps the output.
- The password is hashed server-side as `sha1("3.14159265" . strtolower(un) . pw)`
  and checked through the same `lib/challenge.php` session store the robot API
  uses — so robot-issued and password-issued uuids are interchangeable for
  authorization (this is why the game clients never need a password).

There is no refresh method; re-login on expiry. An expired/invalid session on
json_browser yields HTTP 401 with body `<h1>Fatal Error</h1><h2>401
Authentication Required</h2>` — the server plugin detects that substring and
re-logs in.

## JSON browser (json_browser.php) — server plugin

Published source: `json_browser.phps`. Params: `guid`, `uuid`, `method`,
`payload` (JSON string), optional `jsonp`. Errors: `{"status":"error","msg":...}`;
HTTP 401 unauthenticated; HTTP 501 unknown method.

Methods (payload → meaning):

- `userview` — `{"id":"GUID"}` → `{"guid","name","tag","append","creation",
  "website","info","online","memberships":[{"id","name","rank","title","tag",
  "append"}]}` — the server plugin uses only `tag` (string) and `append`
  (0 = prepend, 1 = postpend).
- `usersearch` — `{"q":"name"}` prefix search → `[{"guid","name","tag","append"}]`
- `userclan` — `{"id"}` set active clan (`-1` clears); `username`, `usersite`,
  `userinfo`, `userinvites`, `useraccept`, `userreject`, `userleave`,
  `userhistory`
- `clansearch` — `{"q":"name"}` → `[{"id","name"}]`
- `clanview` — `{"id"}` → `{"id","name","tag","append","recruiting","website",
  "info","creation","picture","active","members":[{"guid","name","tag",
  "append","rank","title","online"}]}`
- `claninvite`, `clanviewinvites`, `clanrank`, `clankick`, `clanrecruit`,
  `claninfo`, `clantag`, `clansite`, `clanname`, `clanpicture`, `clandisband`,
  `clanhistory`, `createclan`

Thyth's forum post warns of policy rate limits ("esp. new clan creation").
The server plugin serializes requests with a configurable minimum interval
(default 1000 ms) and caches results (default 300 s) to stay well clear.

## Certificate trust model (context)

The engine patch holds three RSA public keys: authentication, update,
delegation. Community certificates are signed by the DCE and verified by game
servers locally — servers never talk to the community server. A client with a
valid CEC presents it during the t2csri handshake
(`serverCmdt2csri_sendCommunityCertChunk`), and the server replaces the bare
authinfo with the cert's annotated one (name, active clan tag, memberships).
This flow is intact in the QoL patch (`t2csri/serverSide.cs` v1.3,
`clientSideClans.cs`), which is why the server plugin only injects tags when
authinfo field 1 is empty: cert-presented tags are authoritative.
