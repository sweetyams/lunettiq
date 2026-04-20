# Lunettiq API — Tablet / Native App Reference

Base URL: `https://lunettiq.vercel.app` (production) or `http://localhost:3000` (dev)

## Authentication

All `/api/crm/*` routes require a Clerk session token as a Bearer token:

```
Authorization: Bearer <clerk_session_token>
```

Get the token from Clerk's `getToken()` in your Expo app. The API verifies it server-side via Clerk's session verification endpoint.

### Headers

| Header | Required | Purpose |
|---|---|---|
| `Authorization` | Yes | `Bearer <clerk_token>` |
| `Content-Type` | Yes (POST/PUT/PATCH) | `application/json` |
| `X-CRM-Surface` | Recommended | `tablet` — used for audit logging |

### Roles

Staff roles are stored in Clerk `publicMetadata.role`:
- `owner` — full access
- `manager` — most access, no system settings
- `sa` — sales associate, client + product access
- `readonly` — view only

---

## Response Format

All responses follow a consistent shape:

```json
// Success (single)
{ "data": { ... } }

// Success (list)
{ "data": [...], "meta": { "total": 100, "limit": 50, "offset": 0 } }

// Error
{ "error": "message", "status": 401 }
```

---

## Endpoints

### Clients

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/crm/clients?q=&tag=&sort=&dir=&limit=&offset=` | `org:clients:read` | Search clients (fuzzy, pg_trgm) |
| POST | `/api/crm/clients` | `org:clients:create` | Create client (syncs to Shopify) |
| GET | `/api/crm/clients/[id]` | `org:clients:read` | Client profile + metafields |
| PATCH | `/api/crm/clients/[id]` | `org:clients:update` | Update client fields/metafields |
| POST | `/api/crm/clients/[id]/tags` | `org:clients:update` | Add/remove tags |
| GET | `/api/crm/clients/[id]/timeline` | `org:clients:read` | Interaction timeline |
| GET | `/api/crm/clients/[id]/suggestions` | `org:products:read` | Product suggestions (scored) |
| POST | `/api/crm/clients/[id]/recommend` | `org:products:recommend` | Recommend a product |
| POST | `/api/crm/clients/[id]/credits` | `org:credits:manage` | Issue/adjust credits |
| GET | `/api/crm/clients/[id]/export` | `org:clients:read` | Export client data (Law 25) |
| POST | `/api/crm/clients/[id]/photo` | `org:clients:update` | Upload client photo |

### Products

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/crm/products?q=&type=&vendor=&material=&rx=&tag=&limit=` | `org:products:read` | Search products (fuzzy) |
| GET | `/api/crm/products/search?q=&customerId=&limit=` | `org:products:read` | Search with client-specific scoring |
| GET | `/api/crm/products/[id]` | `org:products:read` | Product detail + variants + analytics |

### Appointments

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/crm/appointments?date=&locationId=&staffId=` | `org:appointments:read` | List appointments |
| POST | `/api/crm/appointments` | `org:appointments:create` | Create appointment |
| PATCH | `/api/crm/appointments/[id]` | `org:appointments:update` | Update appointment |
| DELETE | `/api/crm/appointments/[id]` | `org:appointments:delete` | Cancel appointment |

### Interactions

| Method | Path | Permission | Description |
|---|---|---|---|
| POST | `/api/crm/clients/[id]/timeline` | `org:interactions:create` | Log interaction (note, call, visit, etc.) |

### Second Sight (Trade-in)

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/crm/second-sight` | `org:second_sight:read` | List intakes |
| POST | `/api/crm/second-sight` | `org:second_sight:create` | Create intake |
| PATCH | `/api/crm/second-sight/[id]` | `org:second_sight:grade` | Grade + issue credit |

### Try-On Sessions

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/crm/clients/[id]/tryon-sessions` | `org:clients:read` | List try-on sessions |
| POST | `/api/crm/clients/[id]/tryon-sessions` | `org:clients:update` | Create try-on session |

### Returns

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/crm/returns?status=&customerId=` | `org:returns:read` | List returns |
| PATCH | `/api/crm/returns/[id]` | `org:returns:manage` | Update return status |

### Segments

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/crm/segments` | `org:segments:read` | List segments |
| GET | `/api/crm/segments/[id]` | `org:segments:read` | Segment detail + members |

### Reports

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/crm/reports/[type]` | `org:reports:read` | Types: `overview`, `loyalty`, `products`, `staff` |

### Settings

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/api/crm/settings/locations` | any | List locations |
| GET | `/api/crm/settings/staff` | `org:staff:read` | List staff |

---

## Tablet-Specific Patterns

### Session Mode (client-facing)

1. `GET /api/crm/clients/[id]` — load client profile
2. `GET /api/crm/clients/[id]/suggestions?limit=10` — get recommendations
3. `POST /api/crm/clients/[id]/tryon-sessions` — start session
4. `POST /api/crm/clients/[id]/photo` — capture try-on photos
5. `POST /api/crm/clients/[id]/recommend` — save recommendation
6. `POST /api/crm/clients/[id]/timeline` — log session notes

### Discovery Mode (walk-in)

1. `GET /api/crm/products?q=&limit=24` — browse catalogue
2. `POST /api/crm/clients` — create prospect on email capture

### Fitting Mode

1. `GET /api/crm/clients/[id]` — load fit profile from metafields
2. `POST /api/crm/clients/[id]/photo` — capture frame photos
3. `PATCH /api/crm/clients/[id]` — save fit measurements
4. `POST /api/crm/clients/[id]/timeline` — log fitting notes

---

## CORS

The API allows cross-origin requests from:
- `http://localhost:8081` (Expo dev)
- `http://localhost:19006` (Expo web)
- `*.lunettiq.com` (production)

Preflight `OPTIONS` requests are handled automatically.
