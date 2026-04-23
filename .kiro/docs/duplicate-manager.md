# Duplicate Manager — Spec

## Overview

CRM feature that detects, reviews, and resolves duplicate client records. Duplicates arise from Shopify webhook syncs creating separate `customers_projection` rows for the same person (e.g. different email/phone on separate orders).

## Data Model

**Table:** `duplicate_candidates`

| Column | Type | Description |
|---|---|---|
| `id` | uuid (PK) | Auto-generated |
| `client_a` | text | Shopify customer ID |
| `client_b` | text | Shopify customer ID |
| `match_reason` | text | `exact_email`, `exact_phone`, `exact_name` |
| `confidence` | decimal(3,2) | 0.80–0.95 |
| `status` | text | `pending`, `merged`, `dismissed` |
| `created_at` | timestamp | Auto-generated |

## Features

### F-1: Duplicate Scan

- **Endpoint:** `POST /api/crm/clients/duplicates/scan`
- **Permission:** `org:clients:merge`
- **Behavior:**
  1. Loads all `customers_projection` rows
  2. Filters out clients with `merged-into-*` tags
  3. Loads existing `pending` + `merged` pairs to avoid re-inserting
  4. Groups active clients by:
     - Exact email (normalized lowercase, trimmed) → confidence 0.95
     - Exact phone (digits only) → confidence 0.90
     - Exact name (normalized alpha lowercase) → confidence 0.80
  5. Inserts new pairs into `duplicate_candidates` with status `pending`
  6. Dismissed pairs can resurface on next scan
- **Response:** `{ scanned, found, emailGroups, phoneGroups, nameGroups, skippedExisting }`

### F-2: List Pending Duplicates

- **Page SSR:** `/crm/clients/duplicates` (page.tsx) — direct DB query
- **API:** `GET /api/crm/clients/duplicates`
- **Permission:** `org:clients:read` (API), `org:clients:merge` (page)
- **Behavior:**
  1. Fetches up to 50 `pending` duplicate_candidates, ordered by `created_at`
  2. Collects unique client IDs from all pairs
  3. Fetches client details (name, email, phone, orderCount, totalSpent, tags)
  4. Returns enriched pairs with client data on both sides

### F-3: Dismiss Duplicate

- **Endpoint:** `POST /api/crm/clients/duplicates/[id]/dismiss`
- **Permission:** `org:clients:merge`
- **Behavior:** Sets candidate status to `dismissed`. Returns 404 if not found.
- **Note:** Dismissed pairs can resurface on next scan (by design — allows re-evaluation).

### F-4: Merge Clients

- **Endpoint:** `POST /api/crm/clients/merge`
- **Permission:** `org:clients:merge`
- **Input:** `{ primaryId, secondaryId }`
- **Behavior:**
  1. Re-links CRM data from secondary → primary: interactions, appointments, second_sight_intakes, credits_ledger
  2. Merges tags (union, excluding `merged-into-*`)
  3. Syncs merged tags to Shopify via Admin API for primary
  4. Archives secondary: adds `merged-into-{primaryId}` tag, syncs to Shopify
  5. Updates matching `duplicate_candidates` rows to status `merged`
  6. Writes audit log entry (`client_merge`)
- **Primary selection (UI):** Higher LTV client becomes primary

### F-5: Merge All (UI)

- **Client-side only** (DuplicatesClient.tsx)
- Iterates all visible pairs, auto-selects primary by higher LTV
- Sequential merge calls with progress feedback
- Confirmation dialog before execution

## UI

- **Page:** `/crm/clients/duplicates`
- **Components:** `DuplicatesClient.tsx` (client component), `ClientCard` (inline)
- **Layout:** Card per pair, side-by-side client cards, match reason + confidence footer
- **Actions:** Scan Now, Merge All, per-pair Merge/Dismiss
- **Empty state:** "No duplicate candidates found. Run a scan or check back after the nightly job."

## Requirements

| ID | Requirement | Status |
|---|---|---|
| REQ-DM-001 | Scan detects exact email matches | ✅ |
| REQ-DM-002 | Scan detects exact phone matches (digits only) | ✅ |
| REQ-DM-003 | Scan detects exact name matches (normalized) | ✅ |
| REQ-DM-004 | Scan skips clients tagged `merged-into-*` | ✅ |
| REQ-DM-005 | Scan skips existing pending/merged pairs | ✅ |
| REQ-DM-006 | Dismissed pairs can resurface on re-scan | ✅ |
| REQ-DM-007 | List returns max 50 pending pairs with client details | ✅ |
| REQ-DM-008 | Dismiss sets status to `dismissed`, returns 404 if missing | ✅ |
| REQ-DM-009 | Merge re-links interactions, appointments, intakes, credits | ✅ |
| REQ-DM-010 | Merge syncs tags to Shopify for both primary and secondary | ✅ |
| REQ-DM-011 | Merge archives secondary with `merged-into-{id}` tag | ✅ |
| REQ-DM-012 | Merge writes audit log | ✅ |
| REQ-DM-013 | All endpoints require Clerk auth with appropriate permission | ✅ |
| REQ-DM-014 | UI auto-selects higher-LTV client as merge primary | ✅ |

## Bug Fix Log

| Date | Issue | Fix |
|---|---|---|
| 2026-04-22 | GET route 500: `sql` template `ANY()` doesn't bind JS arrays as Postgres arrays | Replaced with Drizzle `inArray()` operator |
