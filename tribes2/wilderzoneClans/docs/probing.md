# Probing recipes (run these yourself — never commit the output)

These curl recipes verify the live TribesNEXT endpoints against a real account.
Use a throwaway shell session; replace the placeholders. Do NOT paste real
values into any repo file, and treat the command output as sensitive (it
contains a session uuid).

```bash
# set these in your shell only (not in any file):
TN_USER='your-account-name'
TN_PASS='your-password'
BASE='https://tribesnext.thyth.com'
```

## 1. JSON session login (what the server plugin does)

```bash
curl -s "$BASE/tn/json/json_session.php?method=login&un=$TN_USER&pw=$TN_PASS"
# expect: {"status":"success","uuid":"...","guid":"...","message":"logged in"}
TN_UUID='paste-uuid-here'
TN_GUID='paste-guid-here'
```

## 2. JSON userview (what the server plugin fetches per player)

```bash
curl -s "$BASE/tn/json/json_browser.php?guid=$TN_GUID&uuid=$TN_UUID&method=userview&payload=%7B%22id%22%3A%22$TN_GUID%22%7D"
# expect: {"guid":"...","name":"...","tag":"...","append":0,...,"memberships":[...]}
```

## 3. Session expiry behavior

Re-run the userview after >30 minutes (or with a garbage uuid):

```bash
curl -s -i "$BASE/tn/json/json_browser.php?guid=$TN_GUID&uuid=bogus&method=userview&payload=%7B%22id%22%3A%22$TN_GUID%22%7D" | head -5
# expect: HTTP/1.1 401 ... body contains "401 Authentication Required"
```

## 4. Robot session round-trip (what the game clients do)

This needs an RSA decryption, so it is easiest done in-game with the client
vl2 installed (watch the console for the echoed `CHALLENGE:` / `UUID:` session
lines). If you want to verify by hand, the flow is:

```bash
curl -s "$BASE/tn/robot/robot_login.php?guid=$TN_GUID&nonce=1abc"
# expect: CHALLENGE: <hex>   (decrypting this requires your account private key)
```

## 5. Robot uuid against the JSON API (optional, informational)

If you capture a robot-negotiated uuid from a client session, check whether it
also authorizes json_browser (both use the same session store):

```bash
curl -s "$BASE/tn/json/json_browser.php?guid=$TN_GUID&uuid=$ROBOT_UUID&method=userview&payload=%7B%22id%22%3A%22$TN_GUID%22%7D"
```

## 6. Mail vocabulary smoke test

With any valid uuid:

```bash
curl -s "$BASE/tn/robot/robot_mail.php?guid=$TN_GUID&uuid=$TN_UUID&method=count"
# compare against the methods implemented in client-common/wzclans/mail.cs
```

Report anything that deviates from `docs/protocol-notes.md`.
