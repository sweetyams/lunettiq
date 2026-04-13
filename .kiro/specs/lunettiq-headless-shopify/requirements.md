# Requirements Document

## Introduction

Lunettiq is a premium eyewear brand based in Montréal building a headless e-commerce storefront. The frontend is a Next.js 14 (App Router) application consuming the Shopify Storefront API (GraphQL) as its data layer. Shopify remains the source of truth for products, variants, inventory, cart, and checkout. The site features an editorial-first design language with full-bleed photography, eyewear-specific variant handling (Color + Lens), a slide-in cart drawer, Shopify-hosted checkout, and user authentication via Shopify unified login enabling favourites, saved prescriptions, and loyalty program access. Deployment targets Vercel.

## Glossary

- **Frontend**: The Next.js 14 App Router application serving the Lunettiq storefront to end users
- **Storefront_API**: The Shopify Storefront GraphQL API used to query products, collections, and perform cart mutations
- **Customer_Account_API**: The Shopify Customer Account API used for authentication, favourites, and prescription data
- **Cart_Drawer**: A slide-in side panel displaying the current shopping cart contents and controls
- **PLP**: Product Listing Page displaying a filtered, sortable grid of products within a collection
- **PDP**: Product Detail Page displaying full product information, variant selectors, and related content
- **Variant**: A Shopify product variant defined by two options — Color (Option 1) and Lens type (Option 2)
- **Announcement_Bar**: A dismissible top-of-page banner displaying promotional or informational messages
- **Primary_Nav**: The main navigation bar containing Optical, Sun, Explore mega-nav, and About links
- **Secondary_Nav**: The utility navigation containing Search, Stores, Account, Cart icon, and Stylist Appointment CTA
- **Mega_Nav**: An expanded dropdown navigation panel triggered by the Explore link in the Primary_Nav
- **Hero_Section**: The homepage full-bleed dual-image hero area with headline overlay and CTA
- **Category_Panel**: A homepage section displaying collection entry points as image cards
- **Product_Row**: A horizontally scrollable row of product cards on the homepage
- **Editorial_Panel**: A full-width lifestyle image section with overlaid text used on the homepage and PLP
- **Filter_Bar**: The inline filter/sort controls on the PLP for shape, colour, material, and size
- **Colour_Selector**: The PDP component displaying colour variant thumbnails for frame selection
- **Lens_Selector**: The PDP component allowing selection between Clear and Blue Light lens options
- **On_Faces_Section**: A PDP section showing the product worn on different face shapes using metafield images
- **Accordion_Section**: Collapsible content panels on the PDP for details, dimensions, care, and shipping
- **Eye_Test_CTA**: A call-to-action block on the PDP promoting eye test booking
- **Metafield**: A Shopify custom data field attached to products for storing eyewear-specific data (on_face_images, material, origin, rx_compatible, frame dimensions)
- **Metaobject**: A Shopify CMS content type used for editorial and page content
- **Store_Location**: A Shopify Metaobject type representing a physical Lunettiq retail store, containing fields for name, address, phone number, operating hours, and map/directions data
- **Wishlist**: A user-specific list of saved/favourited products persisted to the authenticated user's account
- **Prescription_Record**: Saved optometrist or prescription results associated with an authenticated user
- **Loyalty_Program**: A tiered membership system (Essential / CULT / VAULT) linked to the authenticated user account
- **Infinite_Scroll**: Cursor-based pagination that loads additional products as the user scrolls down the PLP
- **Newsletter_Signup**: A footer form collecting email addresses for marketing communications
- **Currency_Selector**: A footer control allowing users to switch display currency
- **Language_Selector**: A footer control allowing users to switch display language
- **Lens_Configurator**: The multi-step PDP component guiding the user through lens type, material, coatings, and prescription entry to fully configure eyewear before adding to cart
- **Lens_Type**: The vision correction category selected in step 1 of the Lens_Configurator — Single Vision, Progressive, Non-Prescription (Plano), or Readers
- **Lens_Index**: The lens material thickness/weight grade selected in step 2 — Standard (1.50), Thin (1.61), Ultra-Thin (1.67), Thinnest (1.74), or Polycarbonate
- **Lens_Coating**: An optional treatment applied to lenses — Anti-Reflective, Blue Light Filter, Photochromic (Transition), Scratch-Resistant, Hydrophobic, or Oleophobic
- **Prescription_Input**: The PDP form or upload step where the user provides sphere, cylinder, axis, and PD values for each eye (OD/OS)
- **PD**: Pupillary Distance — the measurement in millimetres between the centres of the pupils, required for prescription lens fabrication
- **OD**: Oculus Dexter — the right eye, used in prescription notation
- **OS**: Oculus Sinister — the left eye, used in prescription notation
- **Sphere**: The prescription value (in dioptres) indicating the degree of nearsightedness (negative) or farsightedness (positive)
- **Cylinder**: The prescription value (in dioptres) indicating the degree of astigmatism correction
- **Axis**: The angle (1–180 degrees) at which the Cylinder correction is applied
- **Configuration_Summary**: The review panel displayed after all Lens_Configurator steps are complete, showing frame selection, lens type, material, coatings, prescription status, and itemised pricing
- **Running_Price_Total**: A dynamically updated price display within the Lens_Configurator that reflects the cumulative cost of the frame plus all selected lens upgrades and coatings
- **Sun_Lens**: A lens category for sunglasses including tint colour, polarization, and mirror coating options
- **Polarization**: A lens filter that reduces glare from reflective surfaces, available as an add-on for Sun_Lens configurations
- **Mirror_Coating**: A reflective coating applied to the outer surface of Sun_Lens options, available in multiple colours
- **Tint_Colour**: The colour of the sunglass lens tint (e.g., Gray, Brown, Green, Rose, Yellow)
- **PD_Measurement_Guide**: An instructional overlay or tool that helps the user measure or estimate their Pupillary Distance at home

## Requirements

### Requirement 1: Announcement Bar

**User Story:** As a visitor, I want to see a promotional banner at the top of every page, so that I am informed of current offers or brand messages.

#### Acceptance Criteria

1. THE Frontend SHALL render the Announcement_Bar as the topmost element on every page
2. WHEN a visitor clicks the dismiss button on the Announcement_Bar, THE Frontend SHALL hide the Announcement_Bar for that session
3. WHEN the Announcement_Bar is dismissed, THE Frontend SHALL persist the dismissal state in localStorage so the Announcement_Bar remains hidden on subsequent page loads within the same browser session
4. WHEN a visitor loads a page and localStorage contains a valid dismissal record for the current Announcement_Bar message, THE Frontend SHALL not render the Announcement_Bar
5. THE Frontend SHALL retrieve Announcement_Bar content from a Shopify Metaobject so that store administrators can update the message without code changes

### Requirement 2: Primary Navigation

**User Story:** As a visitor, I want a clear primary navigation bar, so that I can browse Optical, Sun, Explore, and About sections easily.

#### Acceptance Criteria

1. THE Frontend SHALL render the Primary_Nav containing links for Optical, Sun, Explore, and About
2. WHEN a visitor clicks the Optical link, THE Frontend SHALL navigate to the Optical collection page at /collections/optical
3. WHEN a visitor clicks the Sun link, THE Frontend SHALL navigate to the Sun collection page at /collections/sun
4. WHEN a visitor clicks the Explore link, THE Frontend SHALL open the Mega_Nav dropdown panel displaying sub-collection links (Signature, Permanent, Archives, Collaborations)
5. WHEN a visitor clicks the About link, THE Frontend SHALL navigate to the About page at /pages/about
6. WHEN a visitor clicks outside the Mega_Nav or presses the Escape key, THE Frontend SHALL close the Mega_Nav dropdown

### Requirement 3: Secondary Navigation

**User Story:** As a visitor, I want quick access to search, stores, my account, cart, and stylist booking, so that I can perform utility actions from any page.

#### Acceptance Criteria

1. THE Frontend SHALL render the Secondary_Nav containing Search, Stores, Account, Cart icon, and a Stylist Appointment pill-shaped CTA button
2. WHEN a visitor clicks the Search icon in the Secondary_Nav, THE Frontend SHALL open a search overlay or navigate to the search page
3. WHEN a visitor clicks the Stores link, THE Frontend SHALL navigate to the stores page at /pages/stores
4. WHEN a visitor clicks the Account icon, THE Frontend SHALL navigate to the account page or trigger the authentication flow if the user is not logged in
5. WHEN a visitor clicks the Cart icon, THE Frontend SHALL open the Cart_Drawer
6. THE Frontend SHALL display the current cart item count as a badge on the Cart icon
7. WHEN a visitor clicks the Stylist Appointment CTA, THE Frontend SHALL navigate to the stylist appointment booking page

### Requirement 4: Mobile Navigation

**User Story:** As a mobile visitor, I want a responsive navigation experience, so that I can access all navigation items on smaller screens.

#### Acceptance Criteria

1. WHILE the viewport width is below the desktop breakpoint, THE Frontend SHALL collapse the Primary_Nav and Secondary_Nav into a hamburger menu icon
2. WHEN a mobile visitor taps the hamburger menu icon, THE Frontend SHALL open a full-screen or slide-in mobile navigation panel displaying all Primary_Nav and Secondary_Nav items
3. WHEN a mobile visitor taps a navigation link within the mobile panel, THE Frontend SHALL navigate to the target page and close the mobile navigation panel
4. WHEN a mobile visitor taps outside the mobile navigation panel or taps a close button, THE Frontend SHALL close the mobile navigation panel

### Requirement 5: Homepage Hero Section

**User Story:** As a visitor, I want to see an impactful editorial hero on the homepage, so that I immediately understand the brand identity and current campaign.

#### Acceptance Criteria

1. WHEN a visitor loads the homepage, THE Frontend SHALL render the Hero_Section with full-bleed dual images, a headline overlay, and a CTA button
2. THE Frontend SHALL retrieve Hero_Section content (images, headline, CTA text, CTA link) from Shopify Metaobjects
3. WHEN a visitor clicks the Hero_Section CTA button, THE Frontend SHALL navigate to the linked collection or page

### Requirement 6: Homepage Category Panels

**User Story:** As a visitor, I want to see collection entry points on the homepage, so that I can quickly navigate to product categories that interest me.

#### Acceptance Criteria

1. WHEN a visitor loads the homepage, THE Frontend SHALL render Category_Panel components displaying image cards for key collections (Optical, Sun, and featured sub-collections)
2. WHEN a visitor clicks a Category_Panel card, THE Frontend SHALL navigate to the corresponding collection page at /collections/[handle]
3. THE Frontend SHALL retrieve Category_Panel data (images, titles, links) from Shopify Metaobjects or collection data via the Storefront_API

### Requirement 7: Homepage Product Rows

**User Story:** As a visitor, I want to see featured products on the homepage, so that I can discover products without navigating to a collection page.

#### Acceptance Criteria

1. WHEN a visitor loads the homepage, THE Frontend SHALL render one or more Product_Row sections displaying product cards from the homepage-featured collection
2. THE Frontend SHALL query the Storefront_API for products in the homepage-featured collection to populate the Product_Row
3. WHEN a visitor clicks a product card in the Product_Row, THE Frontend SHALL navigate to the corresponding PDP at /products/[handle]
4. THE Frontend SHALL render each product card with the product image, title, and price
5. THE Product_Row SHALL be horizontally scrollable when the number of product cards exceeds the visible viewport width

### Requirement 8: Homepage Editorial and Lifestyle Sections

**User Story:** As a visitor, I want to see editorial lifestyle imagery on the homepage, so that I experience the brand's visual storytelling.

#### Acceptance Criteria

1. WHEN a visitor loads the homepage, THE Frontend SHALL render Editorial_Panel sections with full-width lifestyle images and overlaid text
2. THE Frontend SHALL retrieve Editorial_Panel content from Shopify Metaobjects
3. WHEN a visitor loads the homepage, THE Frontend SHALL render a stores/location teaser section linking to the stores page

### Requirement 9: Product Listing Page — Collection Display

**User Story:** As a visitor, I want to browse products within a collection on a dedicated listing page, so that I can find eyewear that matches my preferences.

#### Acceptance Criteria

1. WHEN a visitor navigates to /collections/[handle], THE Frontend SHALL query the Storefront_API for products in the specified collection and render them in a 3-column grid layout
2. THE Frontend SHALL display each product card with the product image, title, price, and available colour swatches
3. THE Frontend SHALL inject Editorial_Panel images at defined intervals within the product grid to maintain the editorial aesthetic
4. WHEN a visitor scrolls to the bottom of the currently loaded products, THE Frontend SHALL load the next page of products using cursor-based Infinite_Scroll via the Storefront_API pagination cursor
5. IF the Storefront_API returns an error or the collection handle is invalid, THEN THE Frontend SHALL display a user-friendly error message

### Requirement 10: Product Listing Page — Filters and Sorting

**User Story:** As a visitor, I want to filter and sort products on the collection page, so that I can narrow down options by shape, colour, material, or size.

#### Acceptance Criteria

1. THE Frontend SHALL render the Filter_Bar at the top of the PLP with inline filter controls for shape, colour, material, and size
2. WHEN a visitor selects one or more filter values, THE Frontend SHALL re-query the Storefront_API with the selected filters and update the product grid without a full page reload
3. WHEN a visitor selects a sort option (e.g., price low-to-high, price high-to-low, newest), THE Frontend SHALL re-query the Storefront_API with the selected sort order and update the product grid
4. WHEN a visitor clears all filters, THE Frontend SHALL reset the product grid to the unfiltered collection state
5. THE Frontend SHALL reflect active filter selections visually in the Filter_Bar so the visitor can see which filters are applied

### Requirement 11: Product Detail Page — Image Gallery

**User Story:** As a visitor, I want to view multiple high-quality images of a product, so that I can evaluate the eyewear from different angles.

#### Acceptance Criteria

1. WHEN a visitor navigates to /products/[handle], THE Frontend SHALL query the Storefront_API for the product data and render an image gallery displaying all product images
2. WHEN a visitor selects a different colour variant via the Colour_Selector, THE Frontend SHALL update the image gallery to show images associated with the selected colour variant
3. THE Frontend SHALL support swipe gestures on mobile for navigating between gallery images
4. IF the product has no images, THEN THE Frontend SHALL display a placeholder image

### Requirement 12: Product Detail Page — Product Information Panel

**User Story:** As a visitor, I want to see the product name, price, and description alongside the images, so that I can make an informed purchase decision.

#### Acceptance Criteria

1. WHEN a visitor navigates to /products/[handle], THE Frontend SHALL render a sticky product information panel displaying the product title, price, and description
2. THE Frontend SHALL display the price of the currently selected variant
3. WHEN the selected variant changes, THE Frontend SHALL update the displayed price to reflect the new variant price

### Requirement 13: Product Detail Page — Colour Selector

**User Story:** As a visitor, I want to select a frame colour using visual thumbnails, so that I can see available colour options and choose my preferred one.

#### Acceptance Criteria

1. THE Frontend SHALL render the Colour_Selector displaying thumbnail images for each available Color option (Option 1) of the product
2. WHEN a visitor clicks a colour thumbnail, THE Frontend SHALL select that colour, update the image gallery, and update the selected variant
3. THE Frontend SHALL visually indicate the currently selected colour thumbnail with a distinct border or highlight
4. THE Frontend SHALL display the colour name label below or adjacent to the Colour_Selector

### Requirement 14: Product Detail Page — Eyewear Configurator (Multi-Step Lens Configuration)

**User Story:** As a visitor, I want to fully configure my eyewear through a guided multi-step flow covering lens type, material, coatings, and prescription, so that I can customise glasses or sunglasses to my exact needs before adding to cart.

#### Acceptance Criteria

1. THE Frontend SHALL render the Lens_Configurator on the PDP as a multi-step flow with sequential steps: Lens Type → Lens Material → Coatings & Add-Ons → Prescription Input (conditional) → Configuration Summary
2. WHEN a visitor begins the Lens_Configurator, THE Frontend SHALL display step 1 (Lens_Type selection) with options for Single Vision, Progressive, Non-Prescription (Plano), and Readers
3. WHEN the product belongs to a sunglasses collection, THE Frontend SHALL display additional Lens_Type options for Prescription Sun and Non-Prescription Sun
4. WHEN a visitor selects a Lens_Type, THE Frontend SHALL advance to step 2 (Lens_Index selection) and display available lens material options with the price differential for each upgrade tier
5. THE Frontend SHALL render the Running_Price_Total at all times during the Lens_Configurator, updating dynamically as the visitor selects options in each step
6. WHEN a visitor completes all required Lens_Configurator steps, THE Frontend SHALL display the Configuration_Summary showing frame colour, lens type, lens material, selected coatings, prescription status, and an itemised price breakdown (frame price + lens upgrades + coatings)
7. THE Frontend SHALL allow the visitor to navigate back to any previous step in the Lens_Configurator to change a selection without losing selections in other steps
8. WHEN a visitor changes a selection in an earlier step that invalidates a later selection, THE Frontend SHALL clear the invalidated selection and prompt the visitor to re-select
9. THE Frontend SHALL visually indicate the current step, completed steps, and remaining steps using a progress indicator
10. IF a Lens_Type or Lens_Index option is unavailable for the selected frame, THEN THE Frontend SHALL display that option as disabled with a reason label

### Requirement 15: Product Detail Page — Add to Cart

**User Story:** As a visitor, I want to add the fully configured eyewear to my cart, so that I can proceed toward purchasing.

#### Acceptance Criteria

1. THE Frontend SHALL render an Add to Cart button on the PDP
2. WHILE the visitor has not completed all required Lens_Configurator steps, THE Frontend SHALL disable the Add to Cart button and display a label indicating that configuration must be completed
3. WHEN a visitor clicks the Add to Cart button after completing the Lens_Configurator, THE Frontend SHALL call the Storefront_API cartLinesAdd mutation with the selected variant ID and all Lens_Configurator selections (lens type, material, coatings, prescription reference) stored as cart line item attributes
4. WHEN the cartLinesAdd mutation succeeds, THE Frontend SHALL open the Cart_Drawer showing the updated cart contents including the configuration summary for the added item
5. IF no cart exists yet, THEN THE Frontend SHALL call the cartCreate mutation before adding the line item
6. IF the selected variant is out of stock, THEN THE Frontend SHALL disable the Add to Cart button and display a Sold Out label
7. THE Frontend SHALL include the itemised price breakdown (frame + lens upgrades + coatings) in the cart line item so the Cart_Drawer displays the full configuration cost

### Requirement 16: Product Detail Page — Accordion Sections

**User Story:** As a visitor, I want to expand collapsible sections for product details, dimensions, care instructions, and shipping info, so that I can access detailed information without cluttering the page.

#### Acceptance Criteria

1. THE Frontend SHALL render Accordion_Section components on the PDP for Details, Dimensions, Care, and Shipping
2. WHEN a visitor clicks an Accordion_Section header, THE Frontend SHALL expand that section to reveal its content
3. WHEN a visitor clicks an already-expanded Accordion_Section header, THE Frontend SHALL collapse that section
4. THE Frontend SHALL populate the Dimensions accordion with frame dimension data from the product Metafield (bridge, lens width, temple length)
5. THE Frontend SHALL populate the Details accordion with material and origin data from product Metafields

### Requirement 17: Product Detail Page — On Faces Section

**User Story:** As a visitor, I want to see how the eyewear looks on different face shapes, so that I can judge how the frames might look on me.

#### Acceptance Criteria

1. WHEN the product has on_face_images Metafield data, THE Frontend SHALL render the On_Faces_Section displaying those images
2. THE Frontend SHALL display face_notes Metafield content alongside the On_Faces_Section images when available
3. IF the product has no on_face_images Metafield, THEN THE Frontend SHALL not render the On_Faces_Section

### Requirement 18: Product Detail Page — Recommendations

**User Story:** As a visitor, I want to see recommended products on the PDP, so that I can discover related eyewear I might also like.

#### Acceptance Criteria

1. THE Frontend SHALL render a recommendations section on the PDP displaying related products
2. THE Frontend SHALL query the Storefront_API product recommendations endpoint to populate this section
3. WHEN a visitor clicks a recommended product card, THE Frontend SHALL navigate to that product's PDP at /products/[handle]

### Requirement 19: Product Detail Page — Eye Test CTA

**User Story:** As a visitor, I want to see a prompt to book an eye test on the PDP, so that I am reminded of the optical service offering.

#### Acceptance Criteria

1. THE Frontend SHALL render the Eye_Test_CTA block on the PDP below the recommendations section
2. WHEN a visitor clicks the Eye_Test_CTA, THE Frontend SHALL navigate to the eye test booking page
3. THE Frontend SHALL retrieve Eye_Test_CTA content (text, link) from a Shopify Metaobject

### Requirement 20: Cart Drawer

**User Story:** As a visitor, I want a slide-in cart panel, so that I can review and modify my cart without leaving the current page.

#### Acceptance Criteria

1. WHEN the Cart_Drawer is opened, THE Frontend SHALL display a slide-in panel from the right side of the viewport showing all cart line items with product image, title, variant info, quantity, and line price
2. THE Frontend SHALL store the Shopify cart ID in a browser cookie so the cart persists across page loads and sessions
3. WHEN a visitor changes the quantity of a line item, THE Frontend SHALL call the Storefront_API cartLinesUpdate mutation and update the Cart_Drawer display
4. WHEN a visitor removes a line item, THE Frontend SHALL call the Storefront_API cartLinesRemove mutation and update the Cart_Drawer display
5. THE Frontend SHALL display the cart subtotal at the bottom of the Cart_Drawer
6. WHEN a visitor clicks outside the Cart_Drawer or clicks the close button, THE Frontend SHALL close the Cart_Drawer
7. IF the cart is empty, THEN THE Frontend SHALL display an empty cart message with a CTA to continue shopping

### Requirement 21: Checkout Redirect

**User Story:** As a visitor, I want to proceed to checkout from the cart, so that I can complete my purchase.

#### Acceptance Criteria

1. THE Frontend SHALL render a Checkout button in the Cart_Drawer
2. WHEN a visitor clicks the Checkout button, THE Frontend SHALL redirect the visitor to the Shopify-hosted checkout URL obtained from the cart object's checkoutUrl field
3. THE Frontend SHALL not render a custom checkout UI; all checkout processing occurs on the Shopify-hosted checkout page

### Requirement 22: User Authentication

**User Story:** As a returning customer, I want to log in using Shopify's unified login, so that I can access my account, favourites, prescriptions, and loyalty status.

#### Acceptance Criteria

1. WHEN an unauthenticated visitor clicks the Account icon, THE Frontend SHALL initiate the Shopify unified login OAuth flow redirecting the visitor to the Shopify login page
2. WHEN the Shopify login flow completes successfully, THE Frontend SHALL store the authentication token securely and redirect the user back to the account page
3. WHEN an authenticated user navigates to the account page, THE Frontend SHALL query the Customer_Account_API and display the user's profile information, order history, and saved addresses
4. THE Frontend SHALL persist the authentication session using secure HTTP-only cookies
5. WHEN an authenticated user clicks the logout action, THE Frontend SHALL clear the authentication session and redirect the user to the homepage
6. IF the Shopify login flow fails or the user cancels, THEN THE Frontend SHALL redirect the user back to the previous page and display no error to avoid confusion

### Requirement 23: Wishlist / Favourites

**User Story:** As an authenticated customer, I want to save products to a favourites list, so that I can easily find and revisit products I am interested in.

#### Acceptance Criteria

1. WHEN an authenticated user views a product card (on PLP, homepage, or recommendations), THE Frontend SHALL display a favourite/heart icon on the product card
2. WHEN an authenticated user clicks the favourite icon on a product, THE Frontend SHALL add that product to the user's Wishlist via the Customer_Account_API or a Shopify Metafield on the customer record
3. WHEN an authenticated user clicks the favourite icon on an already-favourited product, THE Frontend SHALL remove that product from the Wishlist
4. WHEN an authenticated user navigates to the account page, THE Frontend SHALL display a Wishlist section listing all favourited products with links to their PDPs
5. WHILE the user is not authenticated, THE Frontend SHALL not display the favourite icon on product cards
6. THE Frontend SHALL visually distinguish favourited products (filled heart) from non-favourited products (outline heart)

### Requirement 24: Saved Prescriptions

**User Story:** As an authenticated customer, I want to save my optometrist and prescription results, so that I can reference them when ordering optical frames.

#### Acceptance Criteria

1. WHEN an authenticated user navigates to the prescriptions section of the account page, THE Frontend SHALL display a list of saved Prescription_Records
2. WHEN an authenticated user submits a new prescription form, THE Frontend SHALL save the Prescription_Record to the customer's account via the Customer_Account_API or a Shopify Metafield on the customer record
3. THE Frontend SHALL validate that required prescription fields (sphere, cylinder, axis, PD) are provided before saving
4. WHEN an authenticated user deletes a Prescription_Record, THE Frontend SHALL remove it from the customer's account and update the displayed list
5. THE Frontend SHALL display each Prescription_Record with the optometrist name, date, and prescription values

### Requirement 25: Loyalty Program

**User Story:** As an authenticated customer, I want to see my loyalty tier and benefits, so that I am motivated to engage with the brand and earn rewards.

#### Acceptance Criteria

1. WHEN an authenticated user navigates to the account page, THE Frontend SHALL display the user's current Loyalty_Program tier (Essential, CULT, or VAULT) and progress toward the next tier
2. THE Frontend SHALL retrieve loyalty tier data from the customer's Shopify Metafield or a dedicated loyalty Metaobject
3. WHEN an authenticated user views the loyalty section, THE Frontend SHALL display the benefits associated with the current tier
4. THE Frontend SHALL display a progress indicator showing how close the user is to the next loyalty tier

### Requirement 26: Footer

**User Story:** As a visitor, I want a comprehensive footer on every page, so that I can access newsletter signup, help links, company information, and locale settings.

#### Acceptance Criteria

1. THE Frontend SHALL render the footer on every page containing a Newsletter_Signup form, four columns of links (Shop, Help, Company, Legal), and a footer bar
2. WHEN a visitor submits an email address in the Newsletter_Signup form, THE Frontend SHALL submit the email to the Shopify customer marketing subscription endpoint
3. IF the submitted email address is invalid, THEN THE Frontend SHALL display a validation error message inline
4. THE Frontend SHALL render the Currency_Selector in the footer bar allowing visitors to switch display currency
5. THE Frontend SHALL render the Language_Selector in the footer bar allowing visitors to switch display language
6. THE Frontend SHALL display copyright information and payment method icons in the footer bar

### Requirement 27: Shopify Data Layer Integration

**User Story:** As a developer, I want the frontend to correctly query and mutate Shopify data, so that all product, collection, cart, and customer data is accurate and consistent.

#### Acceptance Criteria

1. THE Frontend SHALL use the Shopify Storefront API (GraphQL) for all product, collection, and cart data operations
2. THE Frontend SHALL use the Shopify Customer Account API for all authenticated user data operations (profile, orders, addresses, wishlist, prescriptions, loyalty)
3. THE Frontend SHALL handle Storefront_API rate limiting by implementing retry logic with exponential backoff
4. THE Frontend SHALL query product Metafields (on_face_images, face_notes, material, origin, rx_compatible, frame dimensions) as part of product queries
5. IF a Storefront_API query fails, THEN THE Frontend SHALL display a graceful fallback UI rather than an unhandled error

### Requirement 28: Routing and Information Architecture

**User Story:** As a developer, I want a well-defined route structure, so that all pages are accessible at predictable URLs.

#### Acceptance Criteria

1. THE Frontend SHALL serve the homepage at the root path /
2. THE Frontend SHALL serve collection pages at /collections/[handle] where handle matches a Shopify collection handle
3. THE Frontend SHALL serve product detail pages at /products/[handle] where handle matches a Shopify product handle
4. THE Frontend SHALL serve static content pages at /pages/[handle] (about, stores, eye-test, stylist-appointment)
5. THE Frontend SHALL serve journal/editorial pages at /journal/[slug]
6. THE Frontend SHALL serve the account page at /account for authenticated users
7. IF a visitor navigates to a route that does not match any defined page, THEN THE Frontend SHALL render a 404 Not Found page

### Requirement 29: Responsive Design

**User Story:** As a visitor on any device, I want the site to be fully responsive, so that I have a consistent and usable experience on desktop, tablet, and mobile.

#### Acceptance Criteria

1. THE Frontend SHALL render all pages responsively across desktop (1200px+), tablet (768px–1199px), and mobile (below 768px) viewport widths
2. WHILE the viewport is at mobile width, THE Frontend SHALL display the PLP product grid in a single-column or two-column layout instead of three columns
3. WHILE the viewport is at mobile width, THE Frontend SHALL convert horizontal Product_Row scrolling to a swipeable carousel
4. THE Frontend SHALL ensure all interactive elements (buttons, links, selectors) meet a minimum touch target size of 44x44 pixels on mobile

### Requirement 30: Performance and Deployment

**User Story:** As a developer, I want the application deployed on Vercel with optimized performance, so that visitors experience fast page loads.

#### Acceptance Criteria

1. THE Frontend SHALL be deployed on Vercel using the Next.js build output
2. THE Frontend SHALL use Next.js Image component for all product and editorial images to enable automatic optimization, lazy loading, and responsive sizing
3. THE Frontend SHALL implement server-side rendering or static generation for collection and product pages to ensure fast initial page loads and SEO indexability
4. THE Frontend SHALL store the Shopify Storefront API access token in environment variables and not expose it in client-side code

### Requirement 31: Store Locator and Physical Store Locations

**User Story:** As a visitor, I want to find Lunettiq physical retail locations with their details, so that I can visit a store near me to try on eyewear in person.

#### Acceptance Criteria

1. WHEN a visitor navigates to /pages/stores, THE Frontend SHALL query Shopify Metaobjects of type "store_location" and render a store locator page listing all physical Lunettiq retail locations
2. THE Frontend SHALL display each store location entry with the store name, street address, city, province/state, postal code, phone number, and operating hours
3. WHEN a visitor clicks a store location entry, THE Frontend SHALL expand or navigate to a detail view displaying the full store information including a map embed or directions link
4. THE Frontend SHALL render a link or button for each store location that opens directions in an external mapping service (e.g., Google Maps) using the store address
5. WHEN a store administrator creates, edits, or removes a store_location Metaobject in Shopify, THE Frontend SHALL reflect the change on the stores page without requiring code changes or redeployment
6. IF no store_location Metaobjects exist, THEN THE Frontend SHALL display a message indicating that no store locations are currently available
7. THE Frontend SHALL render each store's operating hours in a structured format showing hours for each day of the week
8. WHEN a visitor loads the stores page on a mobile viewport, THE Frontend SHALL render the store list in a single-column stacked layout

### Requirement 32: Prescription Input

**User Story:** As a visitor ordering prescription eyewear, I want to provide my prescription details through multiple convenient methods, so that my lenses are fabricated to my exact vision needs.

#### Acceptance Criteria

1. WHEN a visitor selects a prescription-based Lens_Type (Single Vision, Progressive, or Prescription Sun), THE Frontend SHALL display the Prescription_Input step within the Lens_Configurator
2. THE Frontend SHALL render a manual prescription entry form with fields for OD (right eye) and OS (left eye) including Sphere, Cylinder, Axis, and PD
3. WHEN a visitor selects Progressive as the Lens_Type, THE Frontend SHALL display an additional Add Power field for each eye in the Prescription_Input form
4. THE Frontend SHALL validate Sphere values within the range of -20.00 to +20.00 dioptres in 0.25 increments
5. THE Frontend SHALL validate Cylinder values within the range of -6.00 to +6.00 dioptres in 0.25 increments
6. THE Frontend SHALL validate Axis values as integers within the range of 1 to 180 degrees
7. THE Frontend SHALL validate PD values within the range of 50 to 80 millimetres in 0.5 increments
8. IF a visitor enters a Cylinder value without a corresponding Axis value, THEN THE Frontend SHALL display a validation error indicating that Axis is required when Cylinder is specified
9. THE Frontend SHALL offer an option to upload a prescription image (photo or scanned document) as an alternative to manual entry
10. THE Frontend SHALL offer a "Send Later" option allowing the visitor to complete the purchase and email the prescription after checkout
11. WHILE the visitor is authenticated and has saved Prescription_Records, THE Frontend SHALL display an option to select a previously saved prescription from the user's account
12. THE Frontend SHALL render a PD_Measurement_Guide accessible from the Prescription_Input step that provides instructions or a visual tool to help the visitor measure their PD at home
13. IF the visitor selects Non-Prescription or Readers as the Lens_Type, THEN THE Frontend SHALL skip the Prescription_Input step entirely
14. WHEN a visitor selects Readers as the Lens_Type, THE Frontend SHALL display a magnification strength selector with values from +1.00 to +3.50 in 0.25 increments

### Requirement 33: Lens Material and Index Selection

**User Story:** As a visitor configuring eyewear, I want to choose my lens material and thickness, so that I can balance weight, thickness, and cost based on my prescription strength and preferences.

#### Acceptance Criteria

1. WHEN a visitor completes the Lens_Type step, THE Frontend SHALL display the Lens_Index selection step with available material options
2. THE Frontend SHALL display the following Lens_Index options: Standard (1.50 index, included in base price), Thin (1.61 index), Ultra-Thin (1.67 index), Thinnest (1.74 index), and Polycarbonate (impact-resistant)
3. THE Frontend SHALL display the price differential for each Lens_Index upgrade relative to the Standard (1.50) option
4. THE Frontend SHALL display a brief description for each Lens_Index option explaining the benefit (e.g., "Recommended for prescriptions above ±4.00" for Ultra-Thin)
5. WHEN a visitor selects a Lens_Index option, THE Frontend SHALL update the Running_Price_Total to include the selected material upgrade cost
6. THE Frontend SHALL pre-select or recommend a Lens_Index option based on the entered prescription strength when prescription data is available
7. IF a Lens_Index option is not compatible with the selected Lens_Type, THEN THE Frontend SHALL display that option as disabled with an explanation

### Requirement 34: Lens Coatings and Add-Ons

**User Story:** As a visitor configuring eyewear, I want to select lens coatings and treatments, so that I can enhance durability, comfort, and visual performance of my lenses.

#### Acceptance Criteria

1. WHEN a visitor completes the Lens_Index step, THE Frontend SHALL display the Lens_Coating selection step with available coating and add-on options
2. THE Frontend SHALL display the following Lens_Coating options as individually selectable add-ons: Anti-Reflective (Standard or Premium tier), Blue Light Filter, Photochromic (Transition — clear to dark), Scratch-Resistant, Hydrophobic, and Oleophobic
3. THE Frontend SHALL include UV Protection as a standard feature on all lenses and display it as included at no additional cost
4. THE Frontend SHALL display the price for each optional Lens_Coating add-on
5. WHEN a visitor toggles a Lens_Coating on or off, THE Frontend SHALL update the Running_Price_Total to reflect the change
6. THE Frontend SHALL allow the visitor to select multiple compatible Lens_Coating options simultaneously
7. IF two Lens_Coating options are mutually exclusive, THEN THE Frontend SHALL disable the conflicting option and display an explanation when one is selected
8. THE Frontend SHALL display a brief description for each Lens_Coating explaining its benefit (e.g., "Reduces glare from screens and artificial lighting" for Anti-Reflective)

### Requirement 35: Sunglasses-Specific Lens Configuration

**User Story:** As a visitor configuring sunglasses, I want to choose tint colour, polarization, and mirror coating options, so that I can personalise my sunglasses for style and function.

#### Acceptance Criteria

1. WHEN the product belongs to a sunglasses collection, THE Frontend SHALL display sunglasses-specific options within the Lens_Coating step of the Lens_Configurator
2. THE Frontend SHALL display a Tint_Colour selector with options including Gray, Brown, Green, Rose, and Yellow, each shown with a colour swatch preview
3. THE Frontend SHALL display a Polarization toggle allowing the visitor to add or remove polarized lenses, with the price differential displayed
4. THE Frontend SHALL display Mirror_Coating options (e.g., Silver, Gold, Blue, Green) as an optional add-on with colour swatch previews and price displayed
5. WHEN a visitor selects a Tint_Colour, Polarization, or Mirror_Coating option, THE Frontend SHALL update the Running_Price_Total accordingly
6. IF the visitor selected Prescription Sun as the Lens_Type, THEN THE Frontend SHALL display both the sunglasses-specific options and the standard Lens_Coating options (Anti-Reflective, Scratch-Resistant) applicable to prescription sun lenses
7. THE Frontend SHALL display a default Tint_Colour pre-selected for sunglasses products so the visitor has a starting point

### Requirement 36: Configuration Summary and Price Breakdown

**User Story:** As a visitor who has completed the eyewear configuration, I want to review a clear summary of all my selections with an itemised price breakdown, so that I can confirm my choices before adding to cart.

#### Acceptance Criteria

1. WHEN a visitor completes all required Lens_Configurator steps, THE Frontend SHALL display the Configuration_Summary as the final step before Add to Cart
2. THE Configuration_Summary SHALL display the selected frame name and colour, Lens_Type, Lens_Index, all selected Lens_Coatings, and prescription status (entered, uploaded, send later, or not applicable)
3. THE Configuration_Summary SHALL display an itemised price breakdown listing the frame base price, lens material upgrade cost, each selected coating cost, and the total price
4. THE Frontend SHALL render an Edit button next to each configuration section in the Configuration_Summary that navigates the visitor back to the corresponding Lens_Configurator step
5. WHEN a visitor clicks an Edit button in the Configuration_Summary, THE Frontend SHALL navigate to the corresponding step with the current selection preserved
6. THE Frontend SHALL display the Configuration_Summary on mobile viewports in a vertically stacked layout that remains readable without horizontal scrolling
7. WHEN the product is a sunglasses product, THE Configuration_Summary SHALL additionally display the selected Tint_Colour, Polarization status, and Mirror_Coating selection
8. IF the visitor selected "Send Later" for the prescription, THEN THE Configuration_Summary SHALL display a notice reminding the visitor to email the prescription after checkout
