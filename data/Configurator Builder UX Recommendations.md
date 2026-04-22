# Configurator Builder UX Recommendations

## Reframe the product

Stop thinking of this screen as **Product Options**. Treat it as a **Configurator Builder**.

The tool should help an admin:

1. define the customer flow
2. define the choices within each step
3. set the conditions that control those choices
4. preview the customer experience
5. publish changes safely

That is a configurator mindset, not a settings-table mindset.

---

## Use configurator-native terms

Replace internal or schema-heavy language with terms that match how merchandisers and ops teams think.

| Current | Better |
|---|---|
| Product Options | Configurator Builder |
| Lens Path | Lens Type |
| Finish State | Lens Finish |
| Option | Choice |
| Availability | Shown when / Available when |
| Exceptions | Conditions |
| Rules | Logic |
| Single select | Choose one |
| Multi select | Choose any |
| Required | Customer must choose |
| Always available | Always shown |
| Code | Internal name |
| Active | Visible to customers |
| Price | Price change |
| Advanced | Logic & Diagnostics |

---

## Core product structure

The app should follow this order:

### 1. Flow
What steps does the customer move through?

### 2. Choice group
What kind of selection happens in each step?

### 3. Choices
What can the customer choose?

### 4. Conditions
When is each choice shown, hidden, or unavailable?

### 5. Pricing
How does the price change?

### 6. Preview
What does the customer experience look like?

---

## Recommended page structure

### Header
**Configurator Builder**

Supporting line:
Build the customer journey for Optical, Sun, and Reglaze.

Top actions:
- Save draft
- Preview
- Publish

Status area:
- Draft saved
- Last published
- Warning count

This makes the tool feel like a real configuration system, not a static admin page.

---

### Left panel: Steps
Treat this as a flow builder, not just navigation.

Example:

- **Lens Type**  
  Choose one · required · 6 choices
- **Lens Finish**  
  Choose one · required · 5 choices
- **Enhancements**  
  Choose any · optional · 2 choices
- **Summary**

The left panel should also show warnings when logic becomes risky.

Example:
- unreachable choice
- empty required state possible
- conflicting conditions

---

### Main panel: Step editor
For the selected step, show a clean step summary first.

Example:

## Lens Finish
Customers choose **one** finish in this step.

Controls:
- Choose one / Choose any
- Customer must choose / Optional
- Add choice
- Reorder choices
- Duplicate step

Then show each choice as a **card row**, not as a dense table row.

---

### Right panel: Inspector and preview
This panel changes based on what is selected.

If a step is selected, show step settings.

If a choice is selected, show:
- internal name
- price change
- visibility
- conditions
- affected steps or channels

Also include a live preview that shows what the customer would see based on current selections.

This is one of the most important additions. A configurator tool should make the logic visible, not force the admin to simulate it mentally.

---

## Replace table rows with choice cards

A configurator app is easier to understand when each choice reads like an object with behaviour.

### Example card

## Prescription Tint
- **Price change:** +$120
- **Shown when:** Always shown
- **Conditions:** Not available with 6 other finish choices
- **Visible to customers:** Yes

Actions:
- Edit
- Duplicate
- Add condition
- View logic

This is easier to scan than long columns full of rule text.

---

## Show summaries first, details second

Do not surface raw rule syntax in the main list.

### Instead of
- Not available with Standard Sun Finish, Polarized, Custom Dipped Tint, Transitions, Interior Tint (Movie Star), Prescription Polarized

### Show
- Not available with **6 other finish choices**

Then let the user expand the details in the inspector.

This keeps the UI light while still preserving full control.

---

## Separate built-in behaviour from custom logic

This is critical.

If a step is **Choose one**, then sibling choices are already mutually exclusive by default.

That means the UI should not show or ask the user to manage sibling exclusions in that step.

The UI should simply state:

> In “Choose one” steps, selecting one choice automatically deselects the others.

Only show **custom cross-step logic** and **real exceptions**.

This will dramatically reduce noise and improve trust in the system.

---

## Replace “rules” with plain-language conditions

A configurator tool should not make people think in schema or engineering terms.

Use a sentence-style condition builder.

### Example
**Show this choice when**
- [Lens Type] [is any of] [Single Vision, Progressive Premium, Anti-Fatigue]

**Hide this choice when**
- [Channel] [is] [Sun]

**Make unavailable when**
- [Transitions] [is selected]

**Price change**
- [+120]

This feels like configuring behaviour, not editing database logic.

---

## Make “why” visible everywhere

For each choice, the app should answer:

- Why is this shown?
- Why is this hidden?
- Why is this unavailable?
- Which earlier selection affects it?
- Which condition is responsible?

### Example
**Prescription Tint**
- Shown because channel = Optical
- Available because Lens Type is compatible
- Unavailable when Polarized is selected
- Unavailable when Standard Sun Finish is selected

This is much easier to understand than a long string of exclusions.

---

## Add a true preview mode

A configurator app should support live simulation.

### Preview panel example
- **Channel:** Optical
- **Step 1:** Lens Type → Single Vision
- **Step 2:** Lens Finish → available choices update live
- **Step 3:** Enhancements → available choices update live

The preview should clearly show:
- shown choices
- hidden choices
- unavailable choices
- price impact
- why those states happened

This is one of the highest-value improvements for admin confidence.

---

## Improve the common authoring actions

A good configurator builder should make common tasks fast.

### Add a choice
Guide the user through:
- label
- internal name
- price change
- where it appears
- optional conditions

### Duplicate a choice
Most new choices are variations on existing ones.

### Reorder choices
Should be simple and obvious.

### Visibility toggle
Use **Visible to customers** instead of **Active**.

### Copy from another channel
Useful when Optical, Sun, and Reglaze share common structures.

---

## Better top-level tabs

Instead of:
- Configurator
- Advanced

Use:
- **Builder**
- **Preview**
- **Logic**

Why this is better:
- **Builder** = day-to-day authoring
- **Preview** = simulate the customer journey
- **Logic** = conditions, compatibility, diagnostics, power-user tools

“Advanced” is vague. “Logic” is clearer.

---

## Suggested hierarchy

The app should clearly express:

**Channel → Step → Choice Group → Choice → Conditions**

Example:

**Optical**  
→ **Step 2: Lens Finish**  
→ **Choice group: Finish choices**  
→ choices:
- Clear
- Prescription Tint
- Prescription Polarized
- Transitions
- Interior Tint

That hierarchy will make the system easier to reason about.

---

## Example rewritten screen

### Header
**Configurator Builder**  
Build the customer journey for Optical, Sun, and Reglaze.

Actions:
- Save draft
- Preview
- Publish

Status:
- Draft saved
- Last published 2h ago
- 1 warning

---

### Left panel
**Optical**

1. **Lens Type**  
   Choose one · required · 6 choices
2. **Lens Finish**  
   Choose one · required · 5 choices
3. **Enhancements**  
   Choose any · optional · 2 choices
4. **Summary**

Button:
- Add step

---

### Main panel
## Lens Finish
Customers choose **one** finish in this step.

Controls:
- Choose one / Choose any
- Customer must choose / Optional
- Add choice

### Choice cards

#### Clear
- Price change: $0
- Shown when: Always shown
- Conditions: None
- Visible to customers: Yes

Actions:
- Edit
- Duplicate
- Add condition

#### Prescription Tint
- Price change: +$120
- Shown when: Always shown
- Conditions: Not available with 6 finish choices
- Visible to customers: Yes

Actions:
- Edit
- Duplicate
- View logic

#### Interior Tint (Movie Star)
- Price change: +$160
- Shown when: Always shown
- Conditions: Not available with 5 finish choices
- Visible to customers: Yes

Actions:
- Edit
- Duplicate
- View logic

---

### Right panel
## Prescription Tint
- Internal name: `prescription_tint`
- Price change: +$120
- Visible to customers: Yes

### Conditions
- Not available when **Standard Sun Finish** is selected
- Not available when **Polarized** is selected
- Not available when **Custom Dipped Tint** is selected
- Not available when **Transitions** is selected
- Not available when **Interior Tint** is selected
- Not available when **Prescription Polarized** is selected

Button:
- Add condition

### Preview impact
Affects:
- Lens Finish
- Sun channel

---

## Recommended microcopy

### Group header
**Lens Finish**  
Customers choose **one** finish in this step.

### Step setting
**Customer must choose an option before continuing**

### Choice summary
- **Shown when:** Always shown
- **Conditions:** 2 conditions
- **Price change:** +$120

### Empty state
No conditions yet. This choice is always shown when the step appears.

### Condition builder helper text
Add a condition to control when this choice is shown, hidden, or unavailable.

---

## Five highest-priority improvements

If only a few changes can be made, do these first:

1. Rename the language to fit a configurator app
2. Replace dense table rows with choice cards
3. Move condition details into a side inspector
4. Add a live preview mode
5. Treat default group behaviour as automatic and hide sibling exclusions

---

## Final principle

People using this tool are not trying to edit records.

They are trying to shape a customer journey:
- what the customer chooses
- in what order
- under what conditions
- with what pricing impact
- without breaking the flow

The UI should always be designed around those outcomes.
