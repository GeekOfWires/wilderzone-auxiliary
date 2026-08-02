---
title: Format Mappings
nav_order: 4
---

# CIDR Format Mappings

Every CIDR source carries a `format` JSON object that tells the worker how to
parse its body. New list styles plug in without code changes.

## `cidr-lines`

One CIDR per line. Lines starting with `skipPrefix` are ignored.

```json
{ "type": "cidr-lines", "skipPrefix": "#" }
```

Used by the seeded [X4BNet VPN list](https://github.com/X4BNet/lists_vpn).

## `ip-lines`

One bare IP per line; each expands to a `/32`.

```json
{ "type": "ip-lines", "skipPrefix": "#" }
```

## `csv`

CSV (or any single-character delimiter) with an IP or CIDR column.
`cidrColumn` wins when both are set.

```json
{
  "type": "csv",
  "ipColumn": 0,
  "cidrColumn": 1,
  "delimiter": ",",
  "hasHeader": true
}
```

Bare IPs in either column expand to `/32`. Surrounding quotes on fields are
stripped.

## `json`

A JSON array located by a simple path: `arrayPath[*].field` — `field` is
optional when the array holds plain strings.

```json
{ "type": "json", "path": "items[*].ip" }
```

For `{ "items": [ {"ip": "1.2.3.4"}, ... ] }` this yields `1.2.3.4/32`, etc.
`[*]` alone parses a top-level string array.

## How they run

- The daily cron (and **Refresh now**) fetches each enabled source, parses it
  with its mapping, and stores the normalized CIDRs (one per line) in KV.
- At check time the worker merges all enabled sources into one sorted range
  set per isolate and binary-searches it — sub-millisecond steady state.
- A parse producing zero entries is treated as an error and shown as
  `last_error` in the panel; the previous good body stays live.
