# Over n' Out — Test-Night Runbook (Cloudflare quick tunnel from Brett's Mac)

**For:** Brett, on test night. No experience needed — one command per
step, and each step says what success looks like.
**Chosen hosting (Brett, Oct 24, 2026):** the game server runs on
your Mac; a Cloudflare quick tunnel gives your friends a way in.
Render (always-on) stays parked as the alternative.

## Read this first — the three realities

1. **The tunnel address is new every time.** Each test night gets a
   fresh `….trycloudflare.com` address. You share the new one each
   session — last night's link will not work.
2. **Your Mac is the server.** It must stay **awake, plugged in, and
   online** for the whole session. If it sleeps, everyone's game
   freezes until it wakes.
3. **Invite-only.** There are no accounts or passwords yet. Anyone
   with the tunnel address + your room code can join — so share them
   only with the people testing, and don't post them publicly.

**Before the first test night:** the V4 code must be **pushed to
GitHub** (your Mac clones the game from there, and your friends play
the pushed build on the website). Pushing is a separate go-ahead —
nothing in this runbook works until it's done.

---

## One-time setup (first night only)

### Step 1 — Open Terminal
Applications → Utilities → **Terminal**. (Or press ⌘+Space, type
`Terminal`, hit Enter.)
✅ *Success: a window with a blinking cursor and your name in it.*

### Step 2 — Check Node.js
Type this and press Enter:
```
node --version
```
✅ *Success: a version prints, like `v20.x.x` or higher.*
❌ If it says "command not found": go to **https://nodejs.org**,
download the **LTS** installer for Mac, run it, then close and
reopen Terminal and try again.

### Step 3 — Check cloudflared
```
cloudflared --version
```
✅ *Success: a version prints.*
❌ If "command not found", install it with Homebrew:
```
brew install cloudflared
```
(No Homebrew either? Install it from **https://brew.sh** first —
one copy-paste command on that page — then run the line above.)

---

## Every test night

### Step 4 — Get the latest game code
First night (clone):
```
git clone https://github.com/silencer7777/Over-n-Out.git
cd Over-n-Out
```
Every night after (update):
```
cd Over-n-Out
git pull
```
✅ *Success: the clone finishes at 100%, or pull says files updated
/ "Already up to date".*

### Step 5 — Start the game server (Terminal window #1)
```
node net/game-server.js
```
✅ *Success: a line like*
`[game-server] Over n' Out online server → ws://…:8081/play`
**Leave this window open and running.** This is the server — if you
close it, the game ends for everyone.

### Step 6 — Start the tunnel (Terminal window #2)
Open a **second** Terminal window (⌘+N) and run:
```
cloudflared tunnel --url http://localhost:8081
```
✅ *Success: after a few seconds it prints a box containing an
address like:*
```
https://random-words-here.trycloudflare.com
```
**That is tonight's address.** Copy it exactly.

### Step 7 — Join the game yourself
1. Open the game: **https://silencer7777.github.io/Over-n-Out/**
2. In the **SERVER** field, paste tonight's tunnel address exactly
   as printed (the game converts it to the secure form and adds
   what it needs — you don't have to edit it).
3. Type your **CALLSIGN**.
4. In **ROOM**, type a 4-letter code you invent (e.g. `TEST`).
5. Click **🌐 JOIN ONLINE**.
✅ *Success: the status line says you're connected and the game
starts. You're in a room with bot fill until friends arrive.*

### Step 8 — Bring your friends in
Send each tester two things:
- The game link: **https://silencer7777.github.io/Over-n-Out/**
- Tonight's tunnel address + your 4-letter room code.

They paste the address into **SERVER**, pick a callsign, type the
**same room code**, and click **JOIN ONLINE**.
✅ *Success: you see each other in the match. Up to 4 humans per
room; bots fill the empty slots.*

### Step 9 — Shut down (when you're done)
1. In the **tunnel window** (window #2): press **Ctrl+C**.
2. In the **server window** (window #1): press **Ctrl+C**.
✅ *Success: both commands stop and you're back at the blinking
cursor. Tonight's tunnel address is now dead — that's expected.*

---

## If something's wrong

- **"Could not connect" in the game:** check the tunnel window is
  still running and you pasted tonight's address (not last night's).
  The server window must also still be running.
- **Friends connect but you don't see them:** everyone must use the
  **same 4-letter room code** and the **same tunnel address**.
- **Everything froze:** your Mac probably slept. Wake it, and if the
  tunnel died, restart from Step 5 (you'll get a new address —
  re-share it).
- **First connection is slow:** the tunnel takes a few seconds to
  warm up after Step 6. Wait ~10 seconds and try JOIN again.

## Later, if test nights become regular

- **Named Cloudflare tunnel** — same setup, but the address never
  changes (needs a free Cloudflare account + your own domain).
- **Render free tier** (Vega's brief) — always-on, nobody's Mac on
  duty; the server sleeps when idle and takes ~1 minute to wake.
  Pick either when you're ready; the game doesn't change.
