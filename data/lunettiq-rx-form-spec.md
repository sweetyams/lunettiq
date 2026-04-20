# Lunettiq — Prescription Entry Form Specification

**Status:** Draft for review
**Last updated:** April 2026
**Cross-references:** `lunettiq-functionality-spec.md` §6.5 (lens selector) · `lunettiq-functionality-spec.md` §12 (open decision #2) · `lunettiq-crm-spec.md` §5.2 (Rx metafields)

---

## Framing

An Rx form has three audiences at once: the optical lab that has to fill the lens, the regulator that has to see a valid prescription on record, and the customer who just wants to order glasses without feeling like they're filing taxes. Most forms optimize for the lab and lose the customer. The good ones stage the form so complexity only appears when the prescription demands it.

Lunettiq sits at a specific point on the category axis. Warby Parker minimizes the form (let us call your doctor). Zenni and EyeBuyDirect expose everything (full customization). At the PJ.LOBSTER simplicity benchmark, the goal is the Warby Parker surface with the Zenni data model underneath. Minimal surface, complete capture.

**Design principles:**
- Staged disclosure. Complexity only appears when the prescription demands it.
- Named fields over abbreviations. "Sphere (SPH)" not "SPH".
- One decision per screen.
- Upload first, transcribe second. The file is the source of truth.
- Save to account, reuse. One-click on subsequent orders.

---

## Contents

1. [Three entry modes](#1-three-entry-modes)
2. [The staged flow](#2-the-staged-flow)
3. [Field specification by mode](#3-field-specification-by-mode)
4. [Validation rules](#4-validation-rules)
5. [File upload + verification](#5-file-upload--verification)
6. [Data model + CRM integration](#6-data-model--crm-integration)
7. [UX writing](#7-ux-writing)
8. [V1 scope vs V2 roadmap](#8-v1-scope-vs-v2-roadmap)
9. [Open decisions](#9-open-decisions)

---

## 1. Three entry modes

The form has three modes, gated by the customer's answer to "What are you buying?"

### 1.1 Non-prescription

For fashion sunglasses customers. No Rx fields. Roughly 60% of sunglasses orders across the category — forcing a prescription form on these customers kills conversion.

Fields shown:
- Lens tint (solid / gradient / mirror)
- Tint colour (brand palette)
- Polarization (yes / no, if frame supports it)
- UV protection noted as standard (not a checkbox — a baseline claim)

### 1.2 Single vision

The default for optical orders. Approximately 70% of Rx orders.

Includes SPH, CYL, Axis (conditional), PD, optional prism (hidden by default), prescription date, and file upload.

ADD is explicitly excluded from this mode. Customers with an ADD value need Mode 3.

### 1.3 Progressive / bifocal / reading

Multifocal lens mode. Approximately 15-20% of optical orders. V2 scope (see §8).

Includes everything in Mode 2 plus ADD (required) and Near PD (optional, auto-calculated if not provided).

---

## 2. The staged flow

Three screens, not one form. Every category leader that converts well uses some version of this pattern.

### Step 1. Lens type selection

"What are you buying?"

Options:
- Single vision glasses
- Progressive / bifocal glasses
- Reading glasses
- Non-prescription sunglasses
- Prescription sunglasses (single vision)
- Prescription sunglasses (progressive)

The answer gates which fields appear in Step 3.

### Step 2. Entry method selection

"How do you want to enter your prescription?"

Four options:
1. **Upload a file** (recommended, fastest)
2. **Type it in manually**
3. **We'll contact your optometrist** (Warby Parker's killer feature, Lunettiq version)
4. **Skip for now, submit later** (via account after purchase)

Option 3 requires the customer to provide their optometrist's name, clinic, and phone number. The Lunettiq team (or named optician for CULT+ members) makes the call. Turnaround target: 48 hours.

Option 4 creates an order with status "awaiting Rx" and holds production until the Rx is submitted through the account page.

### Step 3. The form

Conditional fields based on Step 1. Validation on the fly. Prism hidden behind a toggle.

---

## 3. Field specification by mode

### 3.1 Non-prescription mode

| Field | Type | Required | Notes |
|---|---|---|---|
| Lens tint | Radio (solid / gradient / mirror) | Yes | Frame-dependent — hide unsupported options |
| Tint colour | Visual swatches | Yes | Brand palette: grey, brown, green, blue, rose |
| Polarization | Toggle | No | Hidden if frame doesn't support it |
| UV protection | Static note | — | "100% UVA/UVB protection included" |

### 3.2 Single vision mode

**Prescription values (per eye — OD and OS rows):**

| Field | Type | Required | Notes |
|---|---|---|---|
| SPH (Sphere) | Dropdown, 0.25 steps, -20.00 to +20.00 | Yes | "Plano" / "0.00" allowed |
| CYL (Cylinder) | Dropdown, 0.25 steps, -6.00 to +6.00 | No | Blank allowed — most customers have none |
| Axis | Number input, 1-180 | Conditional | Required if CYL is non-zero |

**Prism (hidden behind "Add prism correction" toggle):**

| Field | Type | Required | Notes |
|---|---|---|---|
| Horizontal prism | Dropdown, 0.25 steps, 0.00 to 10.00 | No | Per eye |
| Horizontal base | Radio (In / Out) | Conditional | Required when horizontal prism > 0 |
| Vertical prism | Dropdown, 0.25 steps, 0.00 to 10.00 | No | Per eye |
| Vertical base | Radio (Up / Down) | Conditional | Required when vertical prism > 0 |

**Pupillary distance:**

| Field | Type | Required | Notes |
|---|---|---|---|
| PD entry mode | Toggle (single / dual) | Yes | Default: single |
| PD (single) | Number input, 50-80mm | Conditional | Required in single mode |
| PD Right | Number input, 25-40mm | Conditional | Required in dual mode |
| PD Left | Number input, 25-40mm | Conditional | Required in dual mode |

Help text: "The distance between your pupils. Check your prescription — if it's not there, we can measure it at any Lunettiq store."

**Compliance:**

| Field | Type | Required | Notes |
|---|---|---|---|
| Prescription date | Date picker | Yes | Warning banner if >24 months old |
| Rx file upload | File input (PDF, JPG, PNG) | Optional but encouraged | Max 10MB |
| Prescriber name | Text input | No | Free text |
| Prescriber clinic | Text input | No | Free text |

### 3.3 Progressive / bifocal / reading mode

Everything in §3.2, plus:

| Field | Type | Required | Notes |
|---|---|---|---|
| ADD (OD) | Dropdown, 0.25 steps, +0.25 to +3.50 | Yes | Typically same both eyes |
| ADD (OS) | Dropdown, 0.25 steps, +0.25 to +3.50 | Yes | |
| Near PD | Number input, 50-80mm | No | Auto-calc as distance PD minus 3mm if blank |

---

## 4. Validation rules

Real-time validation. Errors shown inline, not in a summary list at the top.

### 4.1 Cross-field rules

- **CYL + Axis dependency.** If CYL is entered, Axis becomes required. Inverse is true only for the display indicator (Axis becomes greyed out if CYL is blank).
- **Prism + Base dependency.** If any prism value > 0, the corresponding Base direction becomes required.
- **ADD + mode dependency.** ADD cannot be entered in single-vision mode. The field isn't rendered.
- **Near PD validity.** Must be less than distance PD. Typical delta: 2-4mm.

### 4.2 Range warnings (soft, not blocking)

- **High SPH.** SPH magnitude > 6.00 triggers a gentle note: "High prescriptions may require a high-index lens. We'll recommend the right lens material at review."
- **Mismatched CYL signs.** CYL values have opposite signs on OD and OS — warning: "This is unusual. Please double-check your prescription."
- **Axis rounded to unusual values.** Any Axis value ending in 5 that isn't 5, 15, 25 etc — not blocking, but flagged for review.

### 4.3 Prescription date

- **More than 24 months old.** Warning banner: "Prescriptions older than 2 years may not reflect your current vision. We recommend scheduling an eye exam. [Book an exam]"
- **Future date.** Blocked with inline error: "Please enter the date on your prescription."
- **More than 5 years old.** Blocked. Customer prompted to get a current Rx or use the "Skip for now, submit later" flow with a current prescription.

### 4.4 PD validation

- Single PD: 50-80mm range.
- Dual PD: each value 25-40mm, sum 50-80mm.
- Delta between OD and OS in dual mode > 5mm: warning, "Large difference between left and right PD is unusual. Please check your measurement."

---

## 5. File upload + verification

The manual-entry form as a standalone is a liability. Customers mis-transcribe. The fix is to offer both: upload the Rx as a file *and* have the form filled.

### 5.1 Upload flow

- Accept: PDF, JPG, PNG
- Max size: 10MB
- Stored in Cloudflare R2 (CRM spec §23.1), referenced by `custom.rx_file` metafield
- Preview rendered in the form so the customer can read their own prescription while transcribing

### 5.2 Verification workflow

Every order with a prescription routes through verification before production:

1. **Automated check.** File is present and readable. Required fields populated. No cross-field validation failures.
2. **Human review.** An optician on the Lunettiq team opens the order, compares the form entries against the uploaded file, and flags mismatches.
3. **Customer confirmation.** If mismatches found, customer receives an email with the discrepancy and a one-click correction link.
4. **Production release.** Order released to lab only after verification passes.

Target turnaround: 4 business hours for standard orders, 1 business hour for CULT+ members (part of the loyalty value).

### 5.3 OCR (V2+)

When V2 ships, uploaded prescriptions are pre-parsed using OCR to auto-fill the form fields. Customer reviews and confirms. Reduces transcription error risk.

Not V1 scope — the verification workflow handles transcription errors for launch.

---

## 6. Data model + CRM integration

### 6.1 Storage

The full Rx is stored as a structured metafield on the customer profile:

```json
{
  "prescription_type": "single_vision" | "progressive" | "bifocal" | "reading",
  "od": {
    "sph": "-3.00",
    "cyl": "-1.00",
    "axis": 30,
    "add": null,
    "prism_h": 0,
    "base_h": null,
    "prism_v": 0,
    "base_v": null
  },
  "os": {
    "sph": "-1.50",
    "cyl": "-0.75",
    "axis": 60,
    "add": null,
    "prism_h": 0,
    "base_h": null,
    "prism_v": 0,
    "base_v": null
  },
  "pd_mode": "single" | "dual",
  "pd_single": 64,
  "pd_right": null,
  "pd_left": null,
  "near_pd": null,
  "prescription_date": "2025-11-14",
  "prescriber_name": "Dr. Szasz Arpad",
  "prescriber_clinic": null,
  "rx_file_url": "r2://rx/customer_123/rx_2025_11_14.pdf",
  "verified_at": null,
  "verified_by": null
}
```

Stored on the customer record as `custom.prescription_current` (JSON metafield). Previous prescriptions archived in `custom.prescription_history` (JSON array).

### 6.2 CRM sync

Fields that sync to existing CRM metafields (spec §5.2):

| CRM metafield | Source |
|---|---|
| `custom.rx_on_file` | Boolean — true if `prescription_current` is non-null |
| `custom.rx_last_updated` | Copies `prescription_date` |
| `custom.rx_file` | Copies `rx_file_url` |

### 6.3 Reuse across orders

On subsequent orders:
- Customer sees a "Use prescription on file" card at Step 2
- Card shows: lens type, date, abbreviated summary ("OD: -3.00, OS: -1.50")
- One-click confirms reuse, order proceeds to checkout
- If prescription is >24 months old, the card includes an update prompt

### 6.4 Expiry reminders

Integrated with the existing Klaviyo flows (CRM spec §10.6):

- 90 days before `rx_last_updated` + 24 months → email: "Time for an eye exam?"
- 60 days before → on-site nudge in account page (per personalization spec §2.4)
- Day of expiry → email with exam booking CTA

---

## 7. UX writing

The form should feel like it was designed by an optician, not a checkout optimizer.

### 7.1 Field labels

Use the full name with the abbreviation in parentheses:
- "Sphere (SPH)"
- "Cylinder (CYL)"
- "Axis"
- "Pupillary Distance (PD)"
- "Addition (ADD)"
- "Prism"
- "Base direction"

### 7.2 Help text tone

Not clinical. Not cute. An optician talking to you.

**Good:**
- PD help: "The distance between your pupils. Check your prescription — if it's not there, we can measure it at any Lunettiq store."
- Axis help: "A number between 1 and 180. It tells us which way your astigmatism correction should sit."
- Prism help: "Most prescriptions don't have this. If yours does, your optometrist would have written it next to a direction like 'base up' or 'base in'."

**Bad:**
- "Enter your pupillary distance in millimetres" (clinical, unhelpful)
- "Don't worry, we've got you! 🤗" (wrong register)
- "PD (mm)" with no explanation (lazy)

### 7.3 Error messages

Specific. Actionable. Never "Invalid input."

**Good:**
- "Axis is required when Cylinder is filled in. Check your prescription for a number between 1 and 180."
- "This PD looks unusually low. Typical adult PD is between 55 and 75mm. Please double-check."

**Bad:**
- "Invalid"
- "Required field"
- "Please try again"

### 7.4 Empty states and prompts

- First time in form: "No prescription on file. Enter one below, upload a file, or we can reach out to your optometrist."
- Returning customer: "Your prescription from [date]. Use this, or enter a new one."
- Expired prescription warning: "The prescription on file is from [date]. Prescriptions should be updated every two years. [Book an exam]"

---

## 8. V1 scope vs V2 roadmap

### 8.1 V1 — ship with functionality spec V1

- Non-prescription mode (Mode 1) — full
- Single vision mode (Mode 2) — full, including prism behind toggle
- Staged flow — full (all four entry methods)
- File upload + human verification workflow
- CRM metafield sync
- Save to account, reuse on next order

V1 uses simple pill UI for lens selection (Clear / Blue light) per functionality spec §6.5. The Rx form is triggered when "Clear" or a prescription option is selected.

### 8.2 V2 — with customer accounts launch

- Progressive / bifocal / reading mode (Mode 3)
- OCR auto-fill from uploaded file
- Prescription history panel on account page
- Klaviyo flows for Rx expiry reminders
- Named optician routing for Rx verification (CULT+ benefit)

### 8.3 V2.1 — later

- Virtual vision test integration (Warby Parker-style) — partner-dependent
- Optometrist directory with direct booking (requires external integration)
- Rx sharing between family members (household accounts)

### 8.4 Explicitly out of scope

- Contact lens prescriptions (different data model, different regulatory regime)
- Base curve, lens diameter, vertex distance fields (lab-internal, not customer-facing)
- OU (both eyes) entry shortcut (saves 2 clicks, adds ambiguity — always show OD and OS separately)

---

## 9. Open decisions

Each needs an answer before build.

| # | Decision | Options | Recommendation |
|---|---|---|---|
| 1 | **Default entry method** | A: Upload. B: Type it in. C: No default, customer chooses. | **A** — Upload first. Reduces transcription error, matches category best practice. |
| 2 | **Post-purchase Rx submission deadline** | A: 7 days. B: 14 days. C: 30 days. | **B** — 14 days. Long enough to find a paper prescription, short enough to hold inventory. |
| 3 | **Rx verification turnaround for non-members** | A: 4 business hours. B: 1 business day. C: 2 business days. | **B** — 1 business day baseline, 1 hour for CULT+. Creates tier differentiation. |
| 4 | **Prescription older than 5 years** | A: Block entirely. B: Allow with strong warning. C: Allow only with optometrist verification. | **A** — Block. Regulatory and duty-of-care reasons. |
| 5 | **Dual PD default** | A: Default to single PD. B: Default to dual PD. | **A** — Single PD. Dual is progressive-specific; single works for 85% of cases. |
| 6 | **"We'll contact your optometrist" flow** | A: Phone call by Lunettiq staff. B: Email to clinic. C: Customer-signed release form faxed. | **A** for CULT+, **B** for others. Phone call is a perk that costs optician time. |
| 7 | **Rx file deletion policy** | A: Keep indefinitely. B: Delete after 5 years. C: Delete on account deletion only. | **B** — 5 years. Matches Quebec medical records retention norms. Law 25 compliant. |
