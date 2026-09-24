# Guide: test, deploy, run several stores

The short version. The details live in [TEMPLATE_SETUP.md](TEMPLATE_SETUP.md).

The template runs in two modes:

| Mode | `DATA_ADAPTER` | Use it for |
| --- | --- | --- |
| **Demo** | `local` (default) | Sales demos. Catalog from `content/products.json`, no admin, stock never moves. |
| **Live** | `db` | Real stores. SQLite database in `.data/`, admin panel at `/admin`. |

Everything below is about **live** mode unless it says otherwise.

---

## 1. Test on your computer

You need Node 22.18 or newer.

### Automated checks (run them before every deploy)

```bash
npm install
npm test            # 19 tests: pricing, stock race, order statuses, logins, CSV, uploads, roles
npm run lint
npm run typecheck
npm run build
```

All four must pass. If `npm test` fails on "role matrix", someone added an admin action
without a permission check: fix that before going further.

### Try it by hand

1. Create `.env.local` (it's never committed):

   ```bash
   DATA_ADAPTER=db
   SESSION_SECRET=paste-the-output-of-openssl-rand-base64-32
   TZ=Africa/Algiers
   ```

2. Fill the database and create your login:

   ```bash
   npm run db:seed
   npm run admin:user -- --username me --role owner
   npm run dev          # http://localhost:3000
   ```

3. Walk through this list on a phone-sized window (375 px):

   **Shop**
   - [ ] Home, catalog filters, search, one product page
   - [ ] Add to cart, order once with delivery, once with pickup
   - [ ] The confirmation page and its WhatsApp link

   **Admin** (`/admin`)
   - [ ] Your test order is in *Commandes*. Move it: Confirmée → Prête → Terminée
   - [ ] Place a second order and cancel it with a reason: its stock comes back (*Stock* page, movement log)
   - [ ] *Produits*: change a price inline, then check the product page in the shop
   - [ ] Create a product with a photo; it's on the shop right away
   - [ ] *Stock*: export the CSV, change one number, import it, check the preview, confirm
   - [ ] Create a `staff` user in *Utilisateurs*, log in with it: it can adjust stock but not change prices, open the product editor or the users page

4. Test the real production build once, since that's what the server runs:

   ```bash
   npm run build && npm start
   ```

### Start over with clean data

```bash
# stop the server first
rm -rf .data/store.db* .data/uploads
npm run db:seed
npm run admin:user -- --username me --role owner
```

---

## 2. Deploy to production (VPS)

The default host is a VPS **physically in Algeria** (Algérie Télécom, ICOSNET…). Many "VPS Algeria"
offers are foreign resellers: ask where the machine is. One small VPS (1 vCPU, 4 GB) holds several stores.

Each store is: **one folder, one port, one domain, one database file**.

### Once per server

On Ubuntu:

1. Install Node 22+ (for example through NodeSource), `git`, and **Caddy** (HTTPS reverse proxy,
   installation steps at caddyserver.com/docs/install).
2. Create a user that runs the stores: `sudo adduser --disabled-password store`.
3. Keep `/srv` for the stores: `sudo mkdir /srv && sudo chown store /srv`.

### Once per store

Say the store is `mystore`, on `mystore.dz`, on port `3001` (next store: 3002, and so on).

```bash
sudo -iu store
git clone <this-store's-repo> /srv/mystore && cd /srv/mystore
npm ci                  # always install on the server; never copy node_modules from Windows
nano .env.local         # DATA_ADAPTER=db, a NEW SESSION_SECRET, TZ=Africa/Algiers
npm run db:migrate
npm run db:seed
npm run admin:user -- --username owner --role owner --name "Owner name"
npm run build
```

Run it as a service, in `/etc/systemd/system/mystore.service`:

```ini
[Unit]
Description=mystore
After=network.target

[Service]
User=store
WorkingDirectory=/srv/mystore
Environment=NODE_ENV=production
Environment=PORT=3001
ExecStart=/usr/bin/npm start
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now mystore
```

(`PORT` must be set here: Next.js ignores it in `.env` files.)

Add the domain to `/etc/caddy/Caddyfile`, then `sudo systemctl reload caddy`:

```
mystore.dz {
	reverse_proxy localhost:3001
}
www.mystore.dz {
	redir https://mystore.dz{uri}
}
```

Point the domain's DNS (A record) at the server's IP. Caddy gets the HTTPS certificate by itself.

### Backups (the same day, not later)

In the `store` user's crontab (`crontab -e`), a copy every night at 3:00, sent to another machine:

```cron
0 3 * * * cd /srv/mystore && npm run db:backup && rsync -a .data/backups .data/uploads backup@other-host:mystore/
```

Do a restore test once before going live (steps in TEMPLATE_SETUP.md §7).

### Go-live checklist

- [ ] `https://mystore.dz` loads, and `http://` redirects to it
- [ ] Demo contact values replaced (phone, WhatsApp, email, address, map) in `store.config.ts`
- [ ] `seo.siteUrl` is the real domain (check `/sitemap.xml`)
- [ ] `SESSION_SECRET` is new for this store (not copied from another one)
- [ ] One real order placed, called, confirmed, and cancelled, from a phone
- [ ] A backup file exists in `.data/backups/` and reached the other machine
- [ ] The owner can log in; nobody else knows the password

### Updating a live store

```bash
cd /srv/mystore
git pull
npm ci
npm run db:migrate      # safe to run every time
npm run build && sudo systemctl restart mystore
```

The store can show errors for a few seconds during the build. Update outside opening hours.

Photos added through the admin appear right away. Files you add to `public/` by hand (logo, OG image)
only appear after `npm run build` and a restart.

---

## 3. One template, many stores

### How to organise it

- **The template** is one git repo. Only generic code changes go there.
- **Each store** is its own repo (or branch) cloned from the template. It only changes the files in the
  table below.
- Fixing a bug or adding a feature: do it in the template, then pull it into each store:

  ```bash
  git remote add template <template-repo-url>    # once per store
  git fetch template && git merge template/main
  ```

  Merge conflicts can only happen in the store's own files (config, tokens, content), which is expected.

**If you're editing `app/` or `components/` in a store's copy, stop**: that change belongs in the template.

### What changes per store

| What | Where |
| --- | --- |
| Name, phone, WhatsApp, address, hours, map, delivery fee, order prefix, toggles | `lib/config/store.config.ts` |
| Colours, fonts, corner radius, spacing | `styles/tokens.css` (+ fonts in `public/fonts/`) |
| Logo, social preview image | `public/logo.svg`, `public/og.png` |
| Starting catalog | `content/products.json` (+ photos in `public/products/`) |
| Texts, trust points, legal pages | `content/locales/*.json`, `content/pages/*.md` |
| Secrets, mode | `.env.local` on the server |

The config file is checked at build time: a typo stops `npm run build` and names the exact field.

### New store, step by step

1. Clone the template into a new repo for the client.
2. Edit `store.config.ts`: every demo value (MobiStore, `0555 00 00 00`…) must go.
3. Replace `tokens.css`, the logo and `og.png` with the client's branding.
4. Catalog: either write the client's phones into `products.json`, or start from the demo catalog and
   replace it in the admin **before** launch (archive the demo phones). Once `npm run db:seed` has run,
   **the admin is the catalog**: edits to
   `products.json` are ignored for products that already exist.
5. Test locally (section 1), then deploy on the next free port (section 2).
6. Give the owner their login and show them the daily routine: call every *Nouvelle* order, move orders
   through their statuses, fix stock after a sale in the shop.

### Sales demos

Run a copy with no `.env.local` (demo mode): no database, no admin, nothing to back up.
Use a separate copy with `DATA_ADAPTER=db` and made-up orders when you want to demo the admin.

---

## 4. When something goes wrong

| Symptom | Fix |
| --- | --- |
| `/admin` shows "page not found" | `DATA_ADAPTER=db` is missing from `.env.local`; restart after adding it |
| Error mentioning `SESSION_SECRET` | Set it to 32+ characters: `openssl rand -base64 32` |
| `no such table` | `npm run db:migrate` |
| Owner forgot the password | `npm run admin:user -- --username <same name> --role owner` resets it |
| Changing `SESSION_SECRET` | Logs everyone out; that's expected |
| A new photo in `public/` doesn't show | Rebuild and restart (or upload it through the admin instead) |
| Customers see "no longer available" | That variant's stock reached 0; restock it in *Produits* or *Stock* |
| Server down after an update | `journalctl -u mystore -n 50` shows why; the last backup is in `.data/backups/` |
