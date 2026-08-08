# Live diagnostics (in-game console)

Run these in the Tribes 2 console (`~` key) when something doesn't work.
Paste results back with any `WZClans` / `Session negotiation error` lines.

## 1. QOL client: does HTTPObject speak HTTPS by default?

The QoL patch's HTTPObject is libcurl-backed, but it is undocumented whether a
bare host uses HTTP or HTTPS. Find out:

```cs
new HTTPObject(T);
function T::onLine(%this, %line) { echo("BODY: " @ %line); }
function T::onConnectFailed(%this) { echo("CONNECT FAILED"); }
function T::onDNSFailed(%this) { echo("DNS FAILED"); }
T.get("tribesnext.thyth.com", "/tn/robot/robot_login.php");
```

- If you see `BODY: ERR: No GUID specified.` → the default scheme works
  against the live API; no host change needed.
- If connect fails or you get a redirect/HTML page instead → retry with a
  scheme: `T.get("https://tribesnext.thyth.com", "/tn/robot/robot_login.php");`
  If THAT works, put this in `GameData/base/wzclans/local.cs`:
  `$WZClans::Community::Host = "https://tribesnext.thyth.com";`
  and report it so the default can be pinned.

## 2. QOL client: is the session up?

After logging in online at the login screen:

```cs
echo(getField(t2csri_getAccountCertificate(), 1));   // your account GUID (not empty)
echo($WZClans::Community::UUID);                      // session token (not empty)
```

The session lines (`CHALLENGE: …`, `UUID: …`) are echoed to the console as
they arrive. `ERR:` / `Unmatched nonce` / `Hostile challenge` lines mean the
RSA round-trip failed — capture them.

## 3. RC2a client: can Ruby do HTTPS?

```cs
rubyExec("wzclans/https.rb");
rubyEval("tsEval '$temp=\"openssl: \" + (defined?(OpenSSL) ? OpenSSL::OPENSSL_VERSION : \"missing\") + \" nethttp: \" + (defined?(Net::HTTP) ? \"ok\" : \"missing\") + \"\";'");
echo($temp);
```

- `openssl: OpenSSL 0.9.x …` — the 2009-era OpenSSL may not negotiate TLS with
  modern Caddy; the client will fall back to plain HTTP on port 80 (watch for
  `WZClans: HTTPS request failed … falling back` warnings).
- `nethttp: missing` — Ruby HTTPS is unavailable entirely; the fallback
  covers you while Thyth serves port 80.

## 4. RC2a client: is the session up?

```cs
echo($LoginCertificate);            // cert with fields name/guid/e/n/sig
echo($WZClans::Community::UUID);    // session token
```

## 5. Server plugin

```cs
echo($WZClans::LocalTag[<a guid>]);   // override is loaded
```

`prefs/wzClansConfig.cs` is re-exec'd by `/wzclansreload` (super admin chat).
The server plugin makes no network requests; there is nothing else to probe.
