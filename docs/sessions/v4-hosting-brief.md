# V4 Hosting Brief — putting the online server on the internet

- **Date:** October 24, 2026
- **Author:** Vega (online systems)
- **Status:** Research only. Nothing has been signed up for,
  deployed, or paid for. Picking an option is **Brett's call**;
  deploying is a separate, later step that needs its own go-ahead.
- **Pricing/limits below were checked against vendor docs and
  current pricing coverage on Oct 24, 2026** (sources at the end).
  Free tiers move often — re-verify at signup time.

## What we are hosting

`net/game-server.js` — one Node process (Node ≥ 18, zero
dependencies), configured by `PORT`/`HOST` env vars, holding all
rooms and match state **in memory** (nothing to persist between
restarts; a restart just clears empty rooms). Load is tiny: the
sim measures ~0.04 ms/tick against a 33.3 ms budget, snapshots
are 20 Hz at ≤ 4 KB per message. Any 512 MB instance is already
oversized for friends-and-testers scale.

## Two hard constraints

1. **`wss://` is mandatory.** The game client is served from
   GitHub Pages over HTTPS. Browsers block plain `ws://` from an
   HTTPS page (mixed content), so the host must terminate TLS in
   front of the server — either the platform does it (PaaS
   options, tunnels), or we add a reverse proxy (bare VPS).
2. **Not ready for the open public yet.** Stage 2 (accounts &
   signed sessions) does not exist; `hello` session tokens are
   shape-checked only (MULTIPLAYER.md §11 risk 4). Until Stage 2
   lands, hosting should stay **invite-scale**: share the address
   with the people testing, don't post it publicly. Every option
   below works for that; none of them fixes the auth gap.

## The options

| Option | Cost | Always on? | TLS / wss | Effort | Main catch |
|---|---|---|---|---|---|
| **Render (free tier)** | **$0, no card** | No — sleeps after 15 idle min, ~1 min wake | Native (`*.onrender.com`) | Low: connect repo, one start command | Cold start; 750 free hrs/month/workspace |
| **Railway** | $5 one-time trial credit (no card), then Free plan $1/mo usage credit; Hobby $5/mo | Yes while credit lasts | Native (`*.up.railway.app`) | Low | Free credit is small; real always-on ≈ Hobby $5/mo |
| **Fly.io** | No free tier for new accounts (trial: 2 VM-hours / 7 days) | Paid, ~$2–5/mo for the smallest machine | Native (`*.fly.dev`) | Medium (flyctl, Dockerfile-style config) | Card required after trial; not free |
| **Koyeb** | Free Starter **closed to new users** (acquired by Mistral AI, early 2026) | — | — | — | Dead end — listed so nobody re-researches it |
| **Oracle Cloud Always Free** | **$0 forever** | Yes | DIY (Caddy/nginx on the VM, or a tunnel) | High: full VM to set up and maintain | Card for identity check; ARM capacity + idle-reclaim quirks |
| **Hetzner Cloud CX22 (VPS)** | ~€3.79/mo (~$4.10) + €0.50 IPv4 | Yes | DIY (Caddy auto-TLS, needs a domain) | High: you are the sysadmin | Cheapest *predictable* always-on; all upkeep is ours |
| **Brett's Mac + Cloudflare Tunnel** | **$0** | Only while the Mac is awake and the tunnel runs | Native (Cloudflare edge) | Very low (quick) / low (named) | Quick tunnel URL changes every run; named needs a domain on Cloudflare |
| **Brett's Mac + Tailscale Funnel** | **$0** (Personal plan) | Only while the Mac is awake | Native (`*.ts.net`) | Very low | Public ports limited to 443/8443/10000; unpublished bandwidth caps; no custom domain |

### Notes per option

**Render (free tier).** Free web services exist and support
WebSockets; inbound HTTP requests *and* WebSocket messages
count as traffic. A service spins down after 15 traffic-free
minutes and takes about a minute to spin back up (visitors see a
loading page meanwhile). 750 free instance hours per workspace
per month (≈ one service awake around the clock), 512 MB RAM,
no card required on the Hobby workspace. Filesystem is ephemeral
— fine for us, we persist nothing. Render itself says free
instances aren't for production; for scheduled playtests with
friends, the one real cost is the first player eating a ~1
minute "server is waking up" wait after idle time.

**Railway.** New accounts get a 30-day trial with a one-time $5
credit (no card); after that a permanent Free plan gives $1/month
of usage credit (services capped at 1 vCPU / 0.5 GB). A small
always-on Node service meters ≈ $2.90/month at current rates
(256 MB, 0.1 vCPU), so free/trial credit covers roughly the first
month or two of light use, not forever. Hobby ($5/mo, includes
$5 of usage) covers this server outright. Git-push deploys, TLS
included.

**Fly.io.** The free allowances were retired for new
organizations in Oct 2024; new signups get a 2-VM-hour / 7-day
trial, then pay-as-you-go (smallest always-on machine ≈
$1.94–2.19/mo, plus card on file). Technically excellent
(WebSockets, many regions) but it is not a free option anymore.

**Oracle Cloud Always Free.** The most generous free offer that
exists: an always-on ARM VM, free forever — note the allowance
was **halved in June 2026 to 2 OCPU / 12 GB RAM** (older guides
still say 4/24), plus 200 GB storage and 10 TB/month egress. The
catches are operational: a card is required for identity
verification, the home region picked at signup is permanent, A1
capacity is often unavailable in popular regions, and Oracle can
reclaim instances it judges idle. And it's a bare VM — Node
install, process supervision, firewall, and TLS (Caddy) are all
set up by hand. Most power, most work.

**Hetzner CX22.** 2 vCPU / 4 GB / 40 GB for ~€3.79/mo (US regions
exist: Virginia, Oregon), 20 TB traffic included, hourly billing
capped at the monthly price. Same bare-VM duties as Oracle, plus
TLS needs a domain name pointed at it (or front it with a free
Cloudflare Tunnel and skip the domain). The predictable paid
floor if free tiers ever fall short.

**Brett's Mac + a tunnel.** Zero cost, zero signup for the
quick-tunnel flavor: run the server locally, run one
`cloudflared tunnel --url http://localhost:8081` command, get a
random `https://<words>.trycloudflare.com` URL — the `wss://`
endpoint is that host + `/play`. Perfect for "three friends,
tonight, test the build." Limits: quick tunnels are
testing-grade (Cloudflare documents a 200 in-flight request
cap, no SLA), the URL is different every run (share it fresh
each session), and the Mac must stay on and awake. A *named*
tunnel fixes the URL permanently but needs a (free) Cloudflare
account and Brett's own domain on Cloudflare DNS. Tailscale
Funnel is the same idea with a stable `ts.net` hostname and
Tailscale handling TLS, traded against fixed public ports and
unpublished bandwidth limits. Both keep the server on Brett's
hardware and schedule — fine for playtests, not a public launch.

## Recommendation

**Render's free tier.** It is the only option that is $0, needs
no card, needs no domain, terminates TLS for us (`wss://` works
out of the box), and deploys from the GitHub repo Brett already
has — while Oracle/Hetzner would make Brett a sysadmin and the
tunnels keep his Mac on duty. The trade is explicit and small:
after 15 idle minutes the server sleeps, and the first player of
the next session waits about a minute for it to wake (the client
can say "waking the server…" — a Coordinator-side nicety, not a
blocker). At playtest scale the 750 free hours/month are not a
real limit.

- **Runner-up, for tonight-style testing:** Cloudflare quick
  tunnel from Brett's Mac — nothing to set up, nothing to keep;
  accept the throwaway URL per session.
- **Growth path, in order:** (1) Render's paid starter (~$7/mo)
  removes the sleep; (2) Hetzner CX22 (~€3.79/mo) or Oracle
  Always Free if we ever outgrow PaaS free tiers or want the
  server somewhere we fully control.

## What Brett decides / what happens next

1. **Pick the host** (recommendation: Render free). The §10.1
   overrule to the `ws` package is *not* needed by any option
   here — the hand-rolled transport deploys as-is.
2. Whoever deploys needs Brett's go-ahead for the account signup
   (Render connects to the `silencer7777` GitHub account) — that
   step is deliberately **not** part of this brief.
3. After a deploy exists: point `js/online.js` at the `wss://`
   URL (Coordinator), share the address invite-only, and keep
   the §11 risk-4 warning in force until Stage 2 is real.

## Sources (checked Oct 24, 2026)

- Render — free tier terms (spin-down, 750 hours, WebSocket
  traffic counts): https://render.com/docs/free
- Railway — plans/credits verified against Railway's pricing
  page, Oct 2026: https://www.budgetforge.dev/tools/railway-pricing-2026
- Fly.io — free tier removal and current trial/paid minimums:
  https://www.saaspricepulse.com/blog/flyio-pricing-history
- Koyeb — free Starter closed after Mistral AI acquisition:
  https://flyio.alternative.to/
- Oracle — Always Free halved to 2 OCPU / 12 GB (June 2026):
  https://dev.to/karthik_yk/oracles-famous-free-4-core24gb-arm-tier-is-now-2-core12gb-check-the-docs-2jln
  and https://site2us.com/en/servers/oracle-cloud-free-tier
- Hetzner — CX22 price/specs 2026: https://gauravtiwari.org/hetzner-vs-vultr-vs-racknerd/
- Cloudflare Tunnel — quick tunnels (random trycloudflare.com
  URL, no account): https://developers.cloudflare.com/workers/wrangler/commands/tunnel/
  ; quick-tunnel limits: https://www.localcan.com/blog/best-ngrok-alternative
- Tailscale Funnel — ports and unpublished bandwidth limits:
  https://www.ssdnodes.com/learn/tailscale-funnel-limits-and-ports
