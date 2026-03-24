# CDN Manager — E-commerce Acceleration Platform

> Developed by [iddigital.pt](https://iddigital.pt)

A self-hosted CDN (Content Delivery Network) server purpose-built for **WooCommerce** and **PrestaShop** stores. Caches static assets (CSS, JS, images, fonts), provides a full admin backoffice with image generation, a live debug panel, and ready-to-use store plugins.

---

## Feature Overview

| Feature | Description |
|---|---|
| **Reverse Proxy + Cache** | LRU in-memory cache for static assets with configurable TTL |
| **Admin Backoffice** | Dashboard with stats, origin management, cache inspection & purge |
| **Image Generator** | Generate placeholder, banner, and OG images directly from the backoffice |
| **Debug Panel** | Real-time request log, cache hit/miss inspector, origin health checks |
| **WooCommerce Plugin** | PHP plugin that rewrites asset URLs → CDN with zero config |
| **PrestaShop Module** | PHP module with identical functionality for PS 1.7 / 8.x |
| **Docker ready** | Single `docker-compose up` deployment |
| **REST API** | Full JSON API for automation and CI/CD integration |
| **One-Command Install** | Single `./install.sh` sets up everything you need |

---

## One-Command Install

Install all required software with a single command:

```bash
# 1. Clone the repo
git clone https://github.com/markgir/cdn.git
cd cdn

# 2. Run the installer
chmod +x install.sh
./install.sh

# 3. Start the server
cd server && node index.js
```

The installer will:
- ✅ Verify Node.js ≥ 18 is installed
- ✅ Verify npm is available
- ✅ Install all server dependencies
- ✅ Create the `.env` configuration file
- ✅ Set up the data directory
- ✅ Verify all dependencies are working

---

## Quick Start (Docker — recommended)

```bash
# 1. Clone the repo
git clone https://github.com/markgir/cdn.git
cd cdn

# 2. Configure (optional — defaults work out of the box)
cp .env.example .env

# 3. Start
docker-compose up -d

# Admin panel  → http://localhost:3001
# CDN proxy    → http://localhost:3000
# Debug page   → http://localhost:3001/debug
```

---

## Quick Start (Node.js)

Requires **Node.js ≥ 18**.

```bash
cd server
npm install
node index.js
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Store visitors                                                  │
│     │                                                            │
│     ▼ (DNS → CDN IP)                                             │
│  ┌─────────────────────────────────┐                            │
│  │  CDN Proxy  :3000               │                            │
│  │  ┌──────────────────────────┐   │                            │
│  │  │   LRU In-Memory Cache    │   │   HIT → serve immediately  │
│  │  └────────────┬─────────────┘   │                            │
│  │               │ MISS            │                            │
│  │               ▼                 │                            │
│  │   HTTP/S reverse proxy          │                            │
│  └────────────────┬────────────────┘                            │
│                   │                                              │
│       ┌───────────┴──────────────┐                              │
│       ▼                          ▼                              │
│  WooCommerce store        PrestaShop store                      │
│  (origin server)          (origin server)                       │
│                                                                  │
│  ┌─────────────────────────────────┐                            │
│  │  Admin Backoffice  :3001         │                            │
│  │  /           → Dashboard        │                            │
│  │  /debug      → Debug Panel      │                            │
│  │  /api/*      → REST API         │                            │
│  └─────────────────────────────────┘                            │
└──────────────────────────────────────────────────────────────────┘
```

---

## Admin Backoffice

Open **http://localhost:3001** after starting the server.

### Dashboard
- Live cache hit/miss counters and hit-rate percentage
- Server uptime and memory usage
- Last 30 requests with method, URL, status, cache status and latency

### Origins
Add as many upstream stores as needed:

| Field | Description |
|---|---|
| **Name** | Friendly label shown in the UI |
| **Origin URL** | Full URL of the store (e.g. `https://mystore.com`) |
| **Platform Type** | `woocommerce`, `prestashop`, or `generic` |
| **CDN Hostname** | Optional — the hostname clients use to reach this CDN instance |
| **Cache TTL** | Override the default TTL (seconds) for this origin |

Each origin has a **Test** button that checks connectivity and shows latency.

### Cache Management
- **Purge by key** — remove a single cached URL
- **Purge by prefix** — remove all entries for an origin (`<originId>::`)
- **Flush all** — clear the entire cache immediately
- Browse and search all cached keys

### Image Generator

Generate placeholder, banner, and social media images directly from the backoffice:

- **Custom dimensions** — set width and height (1–4096 px)
- **Colors** — pick background and text colors with a color picker
- **Custom text** — add any label or leave blank for automatic dimensions text
- **Quick presets** — Product (800×800), OG Image (1200×630), Banner (728×90), Thumbnail (150×150)
- **Download** — save generated images as SVG
- **Direct URL** — copy a direct URL for embedding in your store

Images are generated as lightweight SVG graphics — no external dependencies required.

---

## Debug Panel

Open **http://localhost:3001/debug**

- Auto-refreshing request log (every 5 s, can be paused)
- Filter by URL, cache status (HIT/MISS/NO-ORIGIN) or HTTP status class
- Click any row for a full JSON detail view
- Origin health cards with on-demand latency tests
- Server health metrics (Node version, cache size, uptime, memory)

---

## REST API Reference

All endpoints are served on the admin port (`3001` by default).

### System
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/status` | Server health, uptime, cache stats |

### Origins
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/origins` | List all origins |
| `POST` | `/api/origins` | Add an origin |
| `PUT` | `/api/origins/:id` | Update an origin |
| `DELETE` | `/api/origins/:id` | Remove an origin |
| `POST` | `/api/origins/:id/test` | Test connectivity to an origin |

### Cache
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/cache/stats` | Cache statistics |
| `GET` | `/api/cache/keys` | List cache keys (`?prefix=`, `?limit=`) |
| `POST` | `/api/cache/purge` | Purge `{ key }` or `{ prefix }` |
| `POST` | `/api/cache/flush` | Flush entire cache |

### Images
| Method | Path | Description |
|---|---|---|
| `POST` | `/api/images/generate` | Generate a placeholder/banner image (SVG or base64) |
| `GET` | `/api/images/preview` | Preview an image with query params (`?width=`, `?height=`, `?bgColor=`, `?textColor=`, `?text=`, `?fontSize=`) |

### Logs
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/logs` | Recent request logs (`?limit=`, `?status=`, `?cacheStatus=`) |

---

## WooCommerce Integration

1. Download `plugins/woocommerce/cdn-optimizer.php`
2. In WordPress admin: **Plugins → Add New → Upload Plugin**
3. Upload and activate
4. Go to **Settings → CDN Optimizer**
5. Set **CDN URL** to `http://<your-cdn-host>:3000`
6. Tick the asset types to rewrite and click **Save**

The plugin rewrites all matching static asset URLs in page output using PHP output buffering — no theme changes required.

---

## PrestaShop Integration

1. Download `plugins/prestashop/cdnoptimizer/` as a ZIP
2. In PrestaShop back-office: **Modules → Module Manager → Upload a module**
3. Upload ZIP and install
4. Configure the CDN URL in the module settings
5. Enable the module and flush PrestaShop smart cache

Compatible with PrestaShop **1.7.x** and **8.x**.

---

## Configuration

All settings are read from environment variables (or a `.env` file in the project root):

| Variable | Default | Description |
|---|---|---|
| `CDN_PORT` | `3000` | CDN proxy port |
| `ADMIN_PORT` | `3001` | Admin backoffice port |
| `CACHE_TTL` | `3600` | Default cache TTL in seconds |
| `CACHE_MAX_ITEMS` | `10000` | Maximum in-memory cache entries |
| `LOG_LEVEL` | `info` | Winston log level (`debug`, `info`, `warn`, `error`) |
| `PROXY_TIMEOUT` | `30000` | Upstream request timeout in ms |
| `MAX_REQUEST_LOGS` | `1000` | Number of request log entries kept in memory |

---

## Comparison with Existing Solutions

| Solution | Self-hosted | WooCommerce ready | PrestaShop ready | Backoffice | Debug panel | Image Gen | Cost |
|---|---|---|---|---|---|---|---|
| **CDN Manager (this)** | ✅ | ✅ plugin | ✅ module | ✅ full UI | ✅ real-time | ✅ | Free |
| Cloudflare | ❌ SaaS | Manual config | Manual config | Limited | Limited | ❌ | Paid tiers |
| Varnish Cache | ✅ | Manual config | Manual config | 3rd party | None | ❌ | Free (complex) |
| Nginx proxy_cache | ✅ | Manual config | Manual config | None | None | ❌ | Free (complex) |
| WP Rocket CDN | ❌ SaaS | ✅ | ❌ | ✅ | ❌ | ❌ | Paid |
| KeyCDN | ❌ SaaS | Plugin available | Plugin available | ✅ | Limited | ❌ | Paid |

---

## Development

```bash
cd server
npm install
npm run dev    # nodemon auto-reload
npm test       # Jest test suite
```

---

## Security Notes

- The admin backoffice has no authentication by default. **For production**, place it behind a reverse proxy (nginx/Caddy) with HTTP Basic Auth or IP allowlisting.
- Set a strong `ADMIN_SECRET` in `.env` if you extend the API with authentication middleware.
- The CDN proxy forwards `X-Forwarded-For` headers to preserve client IPs at the origin.

---

## Credits

Developed by [iddigital.pt](https://iddigital.pt)

---

## License

MIT
