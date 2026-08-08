# wilderzoneClan — Tribes 2 community system (clans + T-Mail) vl2 suite

A QOL-era reimagining of Thyth's `tournamentNetClient2` and the TribesNEXT
community client: in-game clan tags, a clan browser, and T-Mail — talking to
the **live TribesNEXT community APIs** at `tribesnext.thyth.com`. No new
backend is required.

Original community system: Electricutioner/Thyth and the TribesNext Project
(<https://www.tribesnext.com/>), adapted with credit from the public
[TribesNext/t2-scripts](https://github.com/TribesNext/t2-scripts) sources.

## The three vl2s

| Archive | For | What it does |
|---|---|---|
| `wilderzoneClanQOL-server.vl2` | Dedicated servers on the QoL patch | Shows clan tags on the scoreboard/nameplates for **all** players (modded or not), fetched from the Wilderzone Auxiliary tag API, which reads the live TribesNEXT community database. Base install and TacoServer (Classic 1.5.2) compatible. |
| `wilderzoneClanQOL-client.vl2` | Game clients on the QoL patch | In-game clan browser + T-Mail, robot RSA session via native QoL crypto (no Ruby). |
| `wilderzoneClanRC-client.vl2` | Game clients on RC2a (Ruby patch) | Same client features via `rubyEval` + plain-HTTP TCPObject, closely ported from the 2011 originals. |

Tags are a server-side concern: the tag API returns each player's community
name, tag, and append flag, and the server plugin bakes them into player names
— client vl2s are needed **only** for the Mail & Browser UIs. (The community
server's certificate issuer is dead — its signer's validity period expired — so
the old client-cert tag flow is gone; the tag API replaces it.)

Client identity is your TribesNEXT account key: clients prove who they are by
RSA challenge/response (`robot_login.php`); **no password ever leaves the
client**. The server plugin needs no TribesNEXT account — just a WZA API key.

## Install

All vl2s go in `GameData/base/` (mounted for both `-mod base` and
`-mod Classic`; TacoServer included). Each vl2 deletes its own compiled
`.cs.dso` shadows when the game/server exits (via a packaged `onExit()` that
calls `Parent::onExit()`, so any other exit handling — including another
tool that also deletes `.dso` files — is unaffected), so updating a vl2 never
requires manual `.dso` deletion. Server-side plugins require no client
install; the client vl2s are per-player.

### Server (`wilderzoneClanQOL-server.vl2`)

1. Drop the vl2 in `GameData/base/` on the server.
2. For live community tags, the plugin ships with the shared generic WZA key
   and works out of the box (rate-limited per server IP by the service). For
   dedicated capacity, create a key on the admin panel's **WZA API Keys** page
   and set it in `GameData/<mod>/prefs/serverPrefs.cs`:

   ```php
   $Host::WZAGenericKey = "wza_...";   // your dedicated WZA API Key
   ```

   The plugin then looks up each connecting player's public clan tag via
   `wilderzone-aux.geekofwires.workers.dev/tribes-api/tag` (HTTPS, cached,
   rate-limited). The worker holds the TribesNEXT service account — **the
   server needs no TribesNEXT account, and no player session data is ever
   involved.**
3. Optional: force tags for specific account GUIDs (tournament teams, staff
   tags) in `GameData/<mod>/prefs/wzClansConfig.cs` — overrides beat the API:

   ```php
   $WZClans::LocalTag[2000000] = "WZA";      // keyed by account GUID
   $WZClans::LocalAppend[2000000] = 0;       // 0 = prepend, 1 = postpend
   ```

   (`wzClansConfig.cs` is exec'd at startup and by `/wzclansreload`, and the
   engine never rewrites it — unlike `serverPrefs.cs`.)
4. Super admins can run `/wzclansreload` in chat to clear the cache and
   re-fetch everyone connected.

How tags reach the scoreboard:

- Players presenting a community certificate keep their cert-verified tag;
  the plugin only fills *empty* tag fields.
- Otherwise: local override if one exists, else the tag API lookup.
- Smurfed players (in-game name ≠ account name) get no tag, same as stock.
- Lookups are asynchronous (≥1 s apart, 5 min cache); a tag that arrives
  after connect is applied to the nameplate immediately, and the scoreboard
  line refreshes on the next score update.
- Without the QoL patch on the server, remote lookups are disabled (the
  vanilla HTTPObject can't do HTTPS) but local overrides still work.

### Clients (`wilderzoneClanQOL-client.vl2` / `wilderzoneClanRC-client.vl2`)

Drop the vl2 for your patch generation into `GameData/base/` and launch the
game. Log in with your TribesNEXT account; the client negotiates a community
session automatically (watch the console for `WZClans` lines) and wires the
stock clan browser / T-Mail UIs to the community system. Clan tags are not a
client feature — they are applied by the server (see above).

The QoL patch ships with the WON-era EMAIL / BROWSER / CHAT launch tabs
force-disabled (`console_client_patches.cs`); this mod re-activates EMAIL and
BROWSER on the launch screen once loaded (CHAT stays disabled — stock IRC has
no community replacement). The tabs light up the next time the launch screen
is shown after the session connects.

Requirements:

- QOL flavor: the TribesNEXT QoL patch (native crypto + HTTPS HTTPObject).
- RC flavor: the RC2a patch with its Ruby bridge (`rubyEval`, `$accountKey`)
  and a locally stored TribesNEXT account. RC2a speaks **plain HTTP on port 80
  only** — TCPObject has no TLS, and the patch's embedded Ruby 1.9.0 contains
  no socket or OpenSSL support (verified by binary inspection of
  `msvcrt-ruby190.dll` / `rubyintersect.dll`), so no Ruby HTTPS transport is
  possible. If the community server ever stops serving port 80, the RC flavor
  needs a local TLS-terminating proxy (e.g. stunnel) plus a host change in
  `wzclans/local.cs`.
- Either flavor: a loose `GameData/base/wzclans/local.cs` (never shipped) can
  override settings such as `$WZClans::Community::Host` without repacking.

Diagnostics: if the session doesn't come up, work through
`docs/live-diagnostics.md` (HTTPObject scheme probe, session checks).

## Building the vl2s

```bash
cd tribes2/wilderzoneClans
./build-vl2.sh        # or: python build-vl2.py
```

Produces the three vl2s in `dist/` next to the script. Python 3 required
(no `zip` binary needed). A `.vl2` is a plain PKZIP; inspect with any archiver.
GitHub Actions rebuilds all three on every change under `tribes2/` and
publishes them to the rolling `clans-vl2` release, linked from the Wilderzone
Auxiliary downloads page.

## Repo layout

```
tribes2/wilderzoneClans/
  README.md                    this file
  docs/protocol-notes.md       everything known about the robot/JSON APIs
  docs/probing.md              curl recipes to verify the live API (run locally)
  docs/live-diagnostics.md     in-game console diagnostics battery
  build-vl2.py / build-vl2.sh
  server-qol/                  server plugin source (local overrides only)
  client-common/wzclans/       shared client layers (session logic, browser,
                               mail, both UIs, launch-tab re-enabler) —
                               merged into each client vl2
  client-qol/                  QOL flavor: entry, settings, HTTPS transport,
                               native crypto glue
  client-rc/                   RC flavor: entry, settings, Ruby HTTPS transport
                               (+ TCPObject fallback), Ruby crypto glue
```

A design for a self-hosted replacement API (signed client certificates, no
server-side accounts) is shelved OUTSIDE this repo (see
`wilderzone-clans-api-plan.shelved.md` in the author's workspace) for the day
the TribesNEXT community service truly dies.

## Credential hygiene

No account names, passwords, API keys, or session tokens exist in this repo or
in any shipped vl2. The server plugin needs no credentials at all; clients
hold only their own session uuid in memory, and player authentication is RSA
challenge/response with the player's own account key — no password ever
leaves the client.

## Testing status

Written against build 25034 + TribesNEXT QoL patch (preview 2025-09) script
sources and the live API as of 2026-08-04, but **not yet exercised on a live
server/client** — treat the first deployment as a test run and check the
console for `WZClans` diagnostics. Known unverified points:

- `currentEpochTime()` client-side availability (confirmed server-side only).
- HTTPObject `.post(host, path, query, data)` argument semantics (inferred
  from a single in-tree call) and default scheme with a bare host (probe in
  `docs/live-diagnostics.md`).
- RC2a embedded-Ruby `net/http`/`openssl` availability and TLS-version
  compatibility with the live server (fallback: plain HTTP on port 80).
- Stock Dynamix clan/mail GUI element availability on QoL-era clients
  (`browserUI.cs`/`mailUI.cs` rewire them by name).
- Robot session compatibility of all mail/browser methods used by the shared
  layers (vocabulary taken from the 2013 t2-scripts sources).

See `docs/protocol-notes.md` for the API reference and `docs/probing.md` for
how to verify against the live service.
