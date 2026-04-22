# Requirements Document

## Introduction

Cart & Draft Orders covers two complementary flows for Lunettiq eyewear purchases:

1. **CRM Staff Cart Builder** — Staff build carts for clients inside the CRM, convert them to Shopify draft orders, and manage product setup via the Admin API. Custom designs already reference a `draftOrderId`; this feature completes that pipeline.

2. **Storefront Custom Cart & Draft Order Checkout** — The headless Next.js storefront renders a custom cart page (replacing the default Storefront API cookie cart for configured eyewear). Each line item represents one configured pair (frame + lens configuration + treatments). Because Lunettiq does not use Shopify Plus, checkout is handled by creating a Shopify Draft Order via the Admin API and redirecting the customer to the Shopify invoice/payment page. The cart integrates with the CRM pricing engine for quote-based pricing, supports discount code validation, shipping option selection, loyalty credits application, and Rx references per line item.

3. **Shared Infrastructure** — Shopify Admin API client, line-item attribute mapping, discount validation, shipping rate resolution, and anonymous-to-account cart migration serve both flows.

## Glossary

- **CRM_Cart**: A server-side cart object stored in the local database, built by CRM staff on behalf of a client. Distinct from the storefront cookie-based cart.
- **Storefront_Cart**: The custom client-side cart on the headless storefront. Stores configured eyewear line items in localStorage (anonymous) or CRM-backed storage (logged-in). Distinct from the Shopify Storefront API cookie cart.
- **Cart_Line_Item**: A single configured pair in either CRM_Cart or Storefront_Cart. Model: shopifyProductId, shopifyVariantId, productHandle, title, image, configuration snapshot, quoteId, rxReference, quantity, unitTotal.
- **Draft_Order**: A Shopify Admin API draft order — an unpaid order that can be sent to the client for payment or marked as paid manually.
- **Cart_Builder**: The CRM UI component where staff search products, select variants, set quantities, apply discounts, and attach line-item attributes (lens type, Rx, coatings).
- **Product_Setup_Form**: The CRM UI form for creating a new product in Shopify via the Admin API, including title, variants, pricing, images, and metafields.
- **Shopify_Admin_Client**: A server-side module that wraps Shopify Admin GraphQL API calls, conditional on Shopify integration being enabled.
- **Line_Item**: A single product variant entry in a CRM_Cart, including quantity, price overrides, discounts, and custom attributes.
- **Staff_User**: An authenticated Clerk user with CRM permissions (e.g., `org:orders:write`, `org:products:write`).
- **Client**: A customer record in `customers_projection`, identified by `shopifyCustomerId`.
- **Credits_Ledger**: The existing `credits_ledger` table tracking loyalty credits and points per customer.
- **Pricing_Engine**: The CRM-side pricing module that computes quote-based pricing for configured eyewear. Base prices: optical $290 (single vision all-in), sunglasses $250. Lens-service uplifts (progressive, blue light, transitions, thinning, etc.) computed per configuration.
- **Quote**: A CRM pricing engine output attached to a Cart_Line_Item via `quoteId`. Contains the computed unit total for a specific frame + lens configuration.
- **Discount_Validator**: A server-side module (`POST /api/cart/validate-discount`) that validates discount codes against Shopify discount definitions, checks expiry/scope/usage limits, and verifies compatibility with loyalty credits.
- **Shipping_Resolver**: A server-side module (`POST /api/cart/shipping-options`) that returns available shipping methods, prices, labels, and delivery estimates for a given cart snapshot and shipping address.
- **Rx_Reference**: A reference to a customer's prescription record. Affects lens recommendations, thickness, and cart display status per line item.
- **Checkout_Orchestrator**: The backend service (`POST /checkout/create-draft-order`) that validates the storefront cart, re-validates pricing, applies shipping/discounts/credits, creates a Shopify Draft Order via Admin API, and returns the invoice URL for customer payment.
- **Addon_Catalog**: A CRM-managed collection of lens add-ons and treatments stored in the database. Each addon has a slug, display name, price, product context (optical/sunglasses/reglaze), and active flag. Staff can create, edit, deactivate, and reorder addons from CRM settings.
- **Stacking_Rule**: A rule that defines which addons can or cannot be combined on a single line item. Rules are stored in the database and enforced by the Pricing_Engine. Types: "exclusive" (only one from a group), "requires" (addon A needs addon B), "incompatible" (addon A cannot coexist with addon B).
- **Product_Context**: One of three pricing contexts: `optical` (base $290), `sunglasses` (base $250), or `reglaze` (no frame, lens-only service). Determines which addons are available and which base price applies.
- **Reglaze_Service**: A lens-replacement service where customers send existing frames for new lenses. Uses its own pricing table (no frame base price). Treated as a separate Product_Context in the Pricing_Engine.

## Requirements

### Requirement 1: Shopify Admin API Client

**User Story:** As a developer, I want a reusable Shopify Admin GraphQL API client, so that CRM features can create draft orders and products without duplicating HTTP/auth logic.

#### Acceptance Criteria

1. THE Shopify_Admin_Client SHALL authenticate using the `SHOPIFY_ADMIN_ACCESS_TOKEN` environment variable and target the store's Admin GraphQL endpoint.
2. THE Shopify_Admin_Client SHALL implement retry logic with exponential backoff for 429 and 5xx responses, matching the existing Storefront API client pattern.
3. IF the `SHOPIFY_ADMIN_ACCESS_TOKEN` environment variable is not configured, THEN THE Shopify_Admin_Client SHALL return a descriptive error without throwing unhandled exceptions.
4. THE Shopify_Admin_Client SHALL be conditionally imported — no Admin API code loads when the token is absent.

### Requirement 2: CRM Cart Builder

**User Story:** As a staff user, I want to build a cart for a client inside the CRM, so that I can assist them with product selection during in-store or remote consultations.

#### Acceptance Criteria

1. WHEN a Staff_User opens the Cart_Builder, THE Cart_Builder SHALL allow searching products from `products_projection` and `product_variants_projection` by title, vendor, SKU, or tag.
2. WHEN a Staff_User selects a product variant, THE Cart_Builder SHALL add a Line_Item with the variant's current price, a default quantity of 1, and empty custom attributes.
3. WHILE a CRM_Cart contains Line_Items, THE Cart_Builder SHALL display each Line_Item with product image, title, variant title, unit price, quantity, and line total.
4. WHEN a Staff_User changes the quantity of a Line_Item, THE Cart_Builder SHALL recalculate the line total and cart subtotal.
5. WHEN a Staff_User removes a Line_Item, THE Cart_Builder SHALL remove the item and recalculate the cart subtotal.
6. THE Cart_Builder SHALL allow attaching custom attributes to each Line_Item (lens type, lens index, coatings, Rx status) using the same `CartLineAttribute` key format as the storefront cart.
7. WHEN a Staff_User applies a line-level discount (percentage or fixed amount), THE Cart_Builder SHALL reduce the Line_Item price and display both original and discounted prices.
8. THE Cart_Builder SHALL require a Client to be associated with the CRM_Cart before conversion to a Draft_Order.
9. WHEN a Staff_User adds a note to the CRM_Cart, THE Cart_Builder SHALL persist the note and include it in the Draft_Order.

### Requirement 3: CRM Cart Persistence

**User Story:** As a staff user, I want my in-progress carts to be saved, so that I can resume building a cart across sessions without losing work.

#### Acceptance Criteria

1. THE CRM_Cart SHALL be stored in a new `crm_carts` database table with fields: id, staffId, shopifyCustomerId, lineItems (JSONB), discounts (JSONB), note, status (draft/converted/abandoned), createdAt, updatedAt.
2. WHEN a Staff_User creates or modifies a CRM_Cart, THE system SHALL persist changes to the database within the same request.
3. WHEN a Staff_User navigates away from the Cart_Builder and returns, THE Cart_Builder SHALL restore the CRM_Cart from the database.
4. THE system SHALL allow a Staff_User to have multiple draft CRM_Carts simultaneously.
5. WHEN a Staff_User lists their carts, THE system SHALL display all draft CRM_Carts sorted by most recently updated.

### Requirement 4: Draft Order Creation

**User Story:** As a staff user, I want to convert a CRM cart into a Shopify draft order, so that the client can complete payment through Shopify's checkout or I can mark it paid manually.

#### Acceptance Criteria

1. WHEN a Staff_User converts a CRM_Cart to a Draft_Order, THE system SHALL call the Shopify Admin API `draftOrderCreate` mutation with the cart's line items, customer, note, and applied discounts.
2. WHEN the Shopify Admin API returns a successful Draft_Order, THE system SHALL store the `draftOrderId` on the CRM_Cart record and update the cart status to "converted".
3. WHEN the Shopify Admin API returns a successful Draft_Order, THE system SHALL return the draft order's invoice URL so the Staff_User can send it to the Client.
4. IF the Shopify Admin API returns an error during draft order creation, THEN THE system SHALL display the error message to the Staff_User and keep the CRM_Cart in "draft" status.
5. WHEN a CRM_Cart is linked to a `custom_designs` record, THE system SHALL update the `draftOrderId` field on the corresponding `custom_designs` row.
6. WHEN a Staff_User applies loyalty credits to a CRM_Cart, THE system SHALL create a line-level discount on the Draft_Order and record a `redeemed_order` transaction in the Credits_Ledger.

### Requirement 5: Draft Order Management

**User Story:** As a staff user, I want to view and manage draft orders from the CRM, so that I can track pending orders and complete or cancel them.

#### Acceptance Criteria

1. THE system SHALL display a "Draft Orders" section within the existing Orders page, listing all draft orders with status, customer name, total, and creation date.
2. WHEN a Staff_User views a Draft_Order, THE system SHALL show line items, discounts, notes, invoice URL, and current Shopify status (open/invoice_sent/completed).
3. WHEN a Staff_User marks a Draft_Order as paid, THE system SHALL call the Shopify Admin API `draftOrderComplete` mutation to convert it into a finalized order.
4. WHEN a Staff_User cancels a Draft_Order, THE system SHALL call the Shopify Admin API `draftOrderDelete` mutation and update the CRM_Cart status to "abandoned".
5. IF loyalty credits were applied to a cancelled Draft_Order, THEN THE system SHALL reverse the credits by creating an `adjustment` transaction in the Credits_Ledger.

### Requirement 6: Product Setup from CRM

**User Story:** As a staff user, I want to create new products in Shopify from the CRM, so that I can add custom or one-off eyewear configurations without switching to the Shopify admin.

#### Acceptance Criteria

1. WHEN a Staff_User opens the Product_Setup_Form, THE Product_Setup_Form SHALL require: title, product type, vendor, and at least one variant with a price.
2. THE Product_Setup_Form SHALL allow adding multiple variants with distinct option values (e.g., color, size), individual pricing, and SKU.
3. THE Product_Setup_Form SHALL allow uploading product images and associating them with specific variants.
4. THE Product_Setup_Form SHALL allow setting Lunettiq-specific metafields: material, origin, bridge width, lens width, temple length, frame width, lens height, acetate source, hinge type, Rx compatible flag.
5. WHEN a Staff_User submits the Product_Setup_Form, THE system SHALL call the Shopify Admin API `productCreate` mutation with all provided fields.
6. WHEN the Shopify Admin API returns a successful product, THE system SHALL insert a corresponding row into `products_projection` and `product_variants_projection` so the product is immediately searchable in the CRM.
7. IF the Shopify Admin API returns an error during product creation, THEN THE system SHALL display the error message and preserve the form state so the Staff_User can correct and retry.
8. THE Product_Setup_Form SHALL require `org:products:write` permission to access.

### Requirement 7: Product Setup — Tags and Collections

**User Story:** As a staff user, I want to assign tags and collections when creating a product, so that the product is properly categorized from the start.

#### Acceptance Criteria

1. THE Product_Setup_Form SHALL allow selecting existing tags from a searchable list and adding new free-text tags.
2. THE Product_Setup_Form SHALL allow selecting one or more collections from `collections_projection`.
3. WHEN a product is created with collection assignments, THE system SHALL call the Shopify Admin API to add the product to each selected collection.

### Requirement 8: Cart-to-Draft Order Line Item Attribute Mapping

**User Story:** As a developer, I want cart line attributes to map correctly to draft order line item properties, so that lens/Rx customization data flows through to Shopify order fulfillment.

#### Acceptance Criteria

1. THE system SHALL map CRM_Cart Line_Item attributes (keys: `_lensType`, `_lensIndex`, `_coatings`, `_rxStatus`) to Shopify draft order line item `customAttributes` using the same key-value format.
2. FOR ALL valid CRM_Cart Line_Items, converting to a Draft_Order and reading back the line item properties SHALL produce equivalent attribute key-value pairs (round-trip property).
3. IF a Line_Item has no custom attributes, THEN THE system SHALL create the draft order line item with an empty `customAttributes` array.

### Requirement 9: API Authorization and Audit

**User Story:** As an admin, I want all cart and draft order operations to be authorized and audited, so that only permitted staff can perform these actions and all changes are traceable.

#### Acceptance Criteria

1. THE system SHALL require `org:orders:write` permission for creating, modifying, and converting CRM_Carts and Draft_Orders.
2. THE system SHALL require `org:products:write` permission for creating products via the Product_Setup_Form.
3. WHEN a Staff_User creates a Draft_Order, THE system SHALL write an entry to the `audit_log` table with action "create", entityType "draft_order", and the staff user's ID.
4. WHEN a Staff_User creates a product, THE system SHALL write an entry to the `audit_log` table with action "create", entityType "product", and the staff user's ID.
5. WHEN a Staff_User applies or reverses loyalty credits on a Draft_Order, THE system SHALL write an entry to the `audit_log` table with action "credit_adjustment".

### Requirement 10: Storefront Custom Cart — Line Item Model

**User Story:** As a customer, I want each item in my cart to represent one fully configured pair of eyewear, so that I can review my frame, lens configuration, and pricing before checkout.

#### Acceptance Criteria

1. THE Storefront_Cart SHALL represent each Cart_Line_Item with the following fields: shopifyProductId, shopifyVariantId, productHandle, title, image, configuration snapshot (lens type, coatings, tinting), quoteId, rxReference, quantity, and unitTotal.
2. WHEN a customer adds a configured pair to the Storefront_Cart, THE Storefront_Cart SHALL store the full configuration snapshot so the customer can review lens type, coatings, and treatments for each line item.
3. THE Storefront_Cart SHALL display each Cart_Line_Item with product image, frame title, lens configuration summary, Rx status, unit price, quantity, and line total.
4. WHEN a Cart_Line_Item has an associated Rx_Reference, THE Storefront_Cart SHALL display the Rx status for that line item.
5. IF a Cart_Line_Item does not have an associated Rx_Reference, THEN THE Storefront_Cart SHALL display "Lens thickness to be confirmed after Rx" for that line item.
6. THE Storefront_Cart SHALL compute and display a cart subtotal as the sum of all Cart_Line_Item line totals.

### Requirement 11: Storefront Cart Persistence

**User Story:** As a customer, I want my cart to persist across browser sessions, so that I do not lose my configured eyewear selections.

#### Acceptance Criteria

1. WHILE a customer is anonymous (not logged in), THE Storefront_Cart SHALL persist Cart_Line_Items in localStorage.
2. WHILE a customer is logged in, THE Storefront_Cart SHALL persist Cart_Line_Items in CRM-backed server-side storage associated with the customer's account.
3. WHEN a customer reloads the page or returns to the storefront, THE Storefront_Cart SHALL restore all previously saved Cart_Line_Items from the appropriate persistence layer.
4. WHEN a customer modifies a Cart_Line_Item quantity, THE Storefront_Cart SHALL persist the change to the active storage layer within the same user action.
5. WHEN a customer removes a Cart_Line_Item, THE Storefront_Cart SHALL remove the item from the active storage layer and recalculate the cart subtotal.

### Requirement 12: Anonymous-to-Account Cart Migration

**User Story:** As a customer who was browsing anonymously, I want my cart items to transfer to my account when I log in, so that I do not lose items I selected before signing in.

#### Acceptance Criteria

1. WHEN an anonymous customer logs in, THE system SHALL migrate all Cart_Line_Items from localStorage to the CRM-backed server-side storage for that account.
2. IF the customer's account already contains Cart_Line_Items, THEN THE system SHALL merge the anonymous cart items with the existing account cart items, preserving both sets without duplicating identical configurations.
3. WHEN cart migration completes, THE system SHALL clear the localStorage cart data.
4. IF a conflict exists between an anonymous Cart_Line_Item and an existing account Cart_Line_Item for the same product variant and configuration, THEN THE system SHALL keep the higher quantity.

### Requirement 13: Storefront Shipping Options

**User Story:** As a customer, I want to enter my shipping address and see available shipping methods with prices before checkout, so that I can choose my preferred delivery option.

#### Acceptance Criteria

1. THE Storefront_Cart SHALL collect a shipping address from the customer before proceeding to checkout.
2. WHEN a customer provides a shipping address, THE Shipping_Resolver SHALL accept a cart snapshot and shipping address via `POST /api/cart/shipping-options` and return available shipping methods with name, price, and estimated delivery time.
3. THE Shipping_Resolver SHALL return shipping rates based on destination: Canada $35 CAD, United States $45 CAD, International $59 CAD.
4. THE Storefront_Cart SHALL display all available shipping methods returned by the Shipping_Resolver and allow the customer to select one.
5. WHEN a customer selects a shipping method, THE Storefront_Cart SHALL add the shipping cost to the cart total and display the updated total.
6. IF the shipping address is incomplete or invalid, THEN THE Shipping_Resolver SHALL return a descriptive error indicating the missing or invalid fields.

### Requirement 14: Storefront Discount Code Validation

**User Story:** As a customer, I want to enter a discount code and see the recalculated total, so that I can apply promotions to my order.

#### Acceptance Criteria

1. THE Storefront_Cart SHALL provide a discount code input field.
2. WHEN a customer submits a discount code, THE Discount_Validator SHALL validate the code via `POST /api/cart/validate-discount` against Shopify discount definitions.
3. THE Discount_Validator SHALL check discount expiry date, product/collection scope exclusions, and per-customer usage limits.
4. THE Discount_Validator SHALL check compatibility between the discount code and any applied loyalty credits, rejecting the discount if the combination is not permitted.
5. WHEN the Discount_Validator returns a valid result, THE Storefront_Cart SHALL display the discount amount and recalculated cart total.
6. IF the Discount_Validator returns an invalid result, THEN THE Storefront_Cart SHALL display the rejection reason to the customer.
7. THE Discount_Validator SHALL return the recalculated subtotal, discount amount, and new total in the response payload.

### Requirement 15: Storefront Loyalty Credits Application

**User Story:** As a loyalty member, I want to apply my available credits toward my cart total, so that I can use earned rewards on my purchase.

#### Acceptance Criteria

1. WHILE a customer is logged in and has a positive credit balance in the Credits_Ledger, THE Storefront_Cart SHALL display the available credit balance and an option to apply credits.
2. WHEN a customer applies loyalty credits, THE Storefront_Cart SHALL reduce the cart total by the applied credit amount, up to the remaining cart balance after discounts.
3. THE Storefront_Cart SHALL not allow applying credits that exceed the cart total after discounts and shipping.
4. WHEN loyalty credits are applied alongside a discount code, THE Discount_Validator SHALL verify the combination is permitted before accepting.
5. THE Storefront_Cart SHALL display the applied credit amount and the final cart total after credits.

### Requirement 16: Pricing Engine Integration

**User Story:** As a customer, I want my cart to reflect accurate quote-based pricing from the CRM pricing engine, so that the price I see includes all lens-service uplifts for my configuration.

#### Acceptance Criteria

1. WHEN a configured pair is added to the Storefront_Cart, THE system SHALL request a Quote from the Pricing_Engine with the selected frame, lens type, and treatments.
2. THE Pricing_Engine SHALL compute the unit total using base prices (optical $290 single vision all-in, sunglasses $250) plus all applicable lens-service uplifts (progressive, blue light, transitions, thinning, and other add-ons).
3. THE Storefront_Cart SHALL store the returned quoteId on the Cart_Line_Item and use the quoted unitTotal as the displayed price.
4. WHEN the Checkout_Orchestrator processes a cart for draft order creation, THE Checkout_Orchestrator SHALL re-validate each Cart_Line_Item price against the Pricing_Engine to confirm the quoted price is still current.
5. IF a re-validated price differs from the stored quote price, THEN THE Checkout_Orchestrator SHALL reject the checkout and return the updated prices so the Storefront_Cart can display the corrected totals.

### Requirement 17: Draft Order Checkout Flow

**User Story:** As a customer, I want to complete my purchase through a secure checkout flow, so that my configured eyewear order is placed and paid for.

#### Acceptance Criteria

1. WHEN a customer initiates checkout from the Storefront_Cart, THE Storefront_Cart SHALL require a shipping address, a selected shipping method, and at least one Cart_Line_Item.
2. WHEN the customer confirms checkout, THE Storefront_Cart SHALL call the Checkout_Orchestrator at `POST /checkout/create-draft-order` with the full cart snapshot, shipping address, selected shipping method, discount code (if any), and applied loyalty credits (if any).
3. THE Checkout_Orchestrator SHALL validate all Cart_Line_Items, re-validate prices against the Pricing_Engine, verify the shipping method and cost, validate the discount code (if provided), and verify loyalty credit availability (if applied).
4. WHEN all validations pass, THE Checkout_Orchestrator SHALL create a Shopify Draft Order via the Admin API `draftOrderCreate` mutation with line items, customer, shipping address, shipping line, discount, note, and custom attributes.
5. WHEN the Shopify Admin API returns a successful Draft_Order, THE Checkout_Orchestrator SHALL return the draft order invoice URL to the Storefront_Cart.
6. WHEN the Storefront_Cart receives the invoice URL, THE Storefront_Cart SHALL redirect the customer to the Shopify invoice/payment page.
7. IF the Checkout_Orchestrator detects a validation failure (price mismatch, invalid discount, insufficient credits, out-of-stock), THEN THE Checkout_Orchestrator SHALL return a descriptive error and the Storefront_Cart SHALL display the error to the customer without clearing the cart.
8. WHEN loyalty credits are applied to a successful Draft_Order, THE Checkout_Orchestrator SHALL record a `redeemed_order` transaction in the Credits_Ledger before returning the invoice URL.

### Requirement 18: Draft Order Webhook — Order Completion

**User Story:** As a system operator, I want completed draft order payments to automatically sync into the CRM, so that order records are up to date without manual intervention.

#### Acceptance Criteria

1. WHEN Shopify fires a `draft_orders/update` or `orders/create` webhook for a draft order that has been paid, THE system SHALL process the webhook and create or update the corresponding record in `orders_projection`.
2. THE webhook handler SHALL match the incoming order to the originating CRM_Cart or Storefront_Cart using the stored `draftOrderId`.
3. WHEN the webhook confirms payment, THE system SHALL update the CRM_Cart or Storefront_Cart status to "completed".
4. IF the webhook handler receives an event for a draft order not tracked in the local database, THEN THE webhook handler SHALL log a warning and skip processing without error.

### Requirement 19: Rx Integration in Cart

**User Story:** As a customer, I want my cart to show prescription status for each pair, so that I know which items need Rx information before my order can be fulfilled.

#### Acceptance Criteria

1. WHEN a Cart_Line_Item has an associated Rx_Reference, THE Storefront_Cart SHALL display the Rx status (e.g., "Rx on file", "Rx pending verification") for that line item.
2. THE Storefront_Cart SHALL allow a customer to attach or update an Rx_Reference on a Cart_Line_Item before checkout.
3. WHEN an Rx_Reference is attached to a Cart_Line_Item, THE system SHALL pass the Rx_Reference to the Pricing_Engine so lens recommendations and thickness can be factored into the quote.
4. THE Checkout_Orchestrator SHALL include the Rx_Reference as a custom attribute on the corresponding Draft_Order line item so fulfillment staff can access it.


### Requirement 20: CRM-Managed Addon Catalog

**User Story:** As a staff user, I want to manage all lens add-ons and treatments from the CRM, so that pricing stays current without code changes and new add-ons can be introduced at any time.

#### Acceptance Criteria

1. THE system SHALL store addons in a `pricing_addons` database table with fields: id, slug (unique), displayName, description, price (decimal), productContext (optical/sunglasses/reglaze), category (lens_type/thinning/coating/tint/service), active (boolean), sortOrder (integer), createdAt, updatedAt.
2. THE system SHALL seed the `pricing_addons` table with the following initial optical addons (all prices in CAD, added on top of the $290 optical base): Progressive Premium $275, Computer/Degressive $275, Super Progressive $500, Anti-Fatigue $90, Thinning 1.6 $60, Ultra Thin 1.67 $100, Super Thin 1.74 $200, Blue Light $75, Blue Light no Rx $10, Prescription with Tint $120, Prescription with Polarized $180, Transitions $180, Interior Tint $160.
3. THE system SHALL seed the `pricing_addons` table with the following initial sunglasses addons (all prices in CAD, added on top of the $250 sunglasses base): Polarized $100, Custom Dipped Tint $50, Interior Tint $160, Transitions $100.
4. THE system SHALL seed the `pricing_addons` table with the following initial reglaze addons (all prices in CAD, standalone service pricing): Single Vision Lenses $180, Blue Light $60, Thinning 1.6 $50, Thinning 1.67 $85, Thinning 1.74 $200, Progressive/Computer $325, Transitions $130, Prescription + Tint $250, Anti-Fatigue $290, Prescription Polarized $290, Tint No Prescription $125, Polarized No Prescription $150, Progressive Sun $430, Progressive Sun Polarized $490, Super Progressive $500, Super Progressive Polarized $650, Super Progressive + Tint $600.
5. WHEN a Staff_User accesses the addon management UI in CRM settings, THE system SHALL require `org:settings:write` permission.
6. THE addon management UI SHALL allow a Staff_User to create, edit, deactivate, and reorder addons.
7. WHEN a Staff_User edits an addon price, THE system SHALL persist the change immediately and THE Pricing_Engine SHALL use the updated price for all subsequent quotes.
8. THE system SHALL NOT delete addon records; deactivating an addon SHALL hide it from new configurations while preserving it on existing quotes and orders.

### Requirement 21: Addon Stacking and Exclusion Rules

**User Story:** As a staff user, I want to define which add-ons can be combined and which are mutually exclusive, so that customers and staff cannot create invalid lens configurations.

#### Acceptance Criteria

1. THE system SHALL store stacking rules in a `pricing_stacking_rules` database table with fields: id, ruleType (exclusive_group/requires/incompatible), addonSlugs (text array — the addons involved), productContext (optical/sunglasses/reglaze or null for all), description, active (boolean), createdAt.
2. WHEN ruleType is "exclusive_group", THE Pricing_Engine SHALL allow at most one addon from the listed addonSlugs to be selected on a single line item.
3. WHEN ruleType is "requires", THE Pricing_Engine SHALL enforce that selecting the first addon in addonSlugs requires the second addon to also be selected.
4. WHEN ruleType is "incompatible", THE Pricing_Engine SHALL prevent any two addons in addonSlugs from being selected together on the same line item.
5. THE system SHALL seed the following initial exclusive groups for optical: lens type group (Single Vision, Progressive Premium, Computer/Degressive, Super Progressive, Anti-Fatigue — only one allowed), thinning group (Thinning 1.6, Ultra Thin 1.67, Super Thin 1.74 — only one allowed), tint/transitions group (Prescription with Tint, Prescription with Polarized, Transitions, Interior Tint — only one allowed).
6. THE system SHALL seed the following initial incompatible rules: Blue Light is incompatible with Prescription with Tint, Prescription with Polarized, and Transitions. Blue Light no Rx is incompatible with any prescription lens type.
7. WHEN a customer or Staff_User attempts to add an addon that violates a stacking rule, THE system SHALL reject the selection and return a human-readable explanation of the conflict.
8. THE addon management UI SHALL allow a Staff_User to create, edit, and deactivate stacking rules.
9. THE Pricing_Engine SHALL evaluate all active stacking rules for the relevant productContext before computing a quote, and SHALL reject invalid configurations before returning a price.

### Requirement 22: Reglaze Service Flow

**User Story:** As a customer, I want to order a lens replacement for my existing frames, so that I can get new lenses without buying a new frame.

#### Acceptance Criteria

1. THE system SHALL treat reglaze as a distinct Product_Context with its own set of addons and pricing (no frame base price; the reglaze addon prices are the full service price).
2. THE Storefront_Cart SHALL support reglaze Cart_Line_Items that have no shopifyProductId or shopifyVariantId, identified by productContext "reglaze".
3. WHEN a customer configures a reglaze service, THE Pricing_Engine SHALL compute the total from the selected reglaze addons only, without adding a frame base price.
4. THE reglaze configurator SHALL enforce stacking rules specific to the reglaze Product_Context (e.g., only one base lens type, thinning exclusivity).
5. WHEN a reglaze Cart_Line_Item is converted to a Draft_Order line item, THE system SHALL create a custom line item (not tied to a Shopify product variant) with the service description and computed price.
6. THE Checkout_Orchestrator SHALL handle reglaze line items alongside standard frame line items in the same Draft_Order.

### Requirement 23: Pricing Engine — Base Price Management

**User Story:** As a staff user, I want to manage base prices for optical and sunglasses from the CRM, so that base pricing can be updated without code changes.

#### Acceptance Criteria

1. THE system SHALL store base prices in a `pricing_base_prices` database table with fields: id, productContext (optical/sunglasses), price (decimal), currency (text, default "CAD"), active (boolean), effectiveFrom (timestamp), createdAt.
2. THE system SHALL seed initial base prices: optical $290 CAD, sunglasses $250 CAD.
3. WHEN a Staff_User updates a base price, THE system SHALL create a new row with the updated price and effectiveFrom timestamp, preserving the previous price for historical quotes.
4. THE Pricing_Engine SHALL use the active base price for the relevant productContext when computing new quotes.
5. THE base price management UI SHALL require `org:settings:write` permission.

### Requirement 24: Shipping Rate Management

**User Story:** As a staff user, I want to manage shipping rates from the CRM, so that shipping prices can be updated without code changes.

#### Acceptance Criteria

1. THE system SHALL store shipping rates in a `shipping_rates` database table with fields: id, region (text, e.g., "canada", "us", "international"), displayName, price (decimal), currency (text, default "CAD"), active (boolean), sortOrder, createdAt, updatedAt.
2. THE system SHALL seed initial shipping rates: Canada $35 CAD, United States $45 CAD, International $59 CAD.
3. WHEN a Staff_User updates a shipping rate, THE system SHALL persist the change and THE Shipping_Resolver SHALL use the updated rate for all subsequent requests.
4. THE shipping rate management UI SHALL require `org:settings:write` permission.
5. THE Shipping_Resolver SHALL read rates from the `shipping_rates` table rather than using hardcoded values.
