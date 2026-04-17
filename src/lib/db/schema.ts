import {
  pgTable,
  text,
  timestamp,
  jsonb,
  boolean,
  integer,
  decimal,
  uuid,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ─── Enums ───────────────────────────────────────────────

export const interactionTypeEnum = pgEnum('interaction_type', [
  'note',
  'phone_call',
  'email',
  'sms',
  'in_store_visit',
  'fitting',
  'purchase_assist',
  'follow_up',
  'complaint',
  'product_recommendation',
  'preferences_updated',
]);

export const interactionDirectionEnum = pgEnum('interaction_direction', [
  'inbound',
  'outbound',
  'internal',
]);

export const secondSightStatusEnum = pgEnum('second_sight_status', [
  'draft',
  'submitted',
  'graded',
  'credited',
  'rejected',
]);

export const secondSightGradeEnum = pgEnum('second_sight_grade', [
  'A',
  'B',
  'C',
  'D',
]);

export const appointmentStatusEnum = pgEnum('appointment_status', [
  'scheduled',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
]);

export const customDesignStatusEnum = pgEnum('custom_design_status', [
  'draft',
  'submitted',
  'in_review',
  'approved',
  'in_production',
  'completed',
  'cancelled',
]);

export const creditTransactionTypeEnum = pgEnum('credit_transaction_type', [
  'issued_membership',
  'issued_birthday',
  'issued_manual',
  'issued_second_sight',
  'redeemed_order',
  'expired',
  'adjustment',
]);

export const auditActionEnum = pgEnum('audit_action', [
  'create',
  'update',
  'delete',
  'login',
  'consent_change',
  'tag_change',
  'credit_adjustment',
  'sync',
]);

export const surfaceEnum = pgEnum('surface', [
  'web',
  'tablet',
  'phone',
  'storefront',
  'system',
]);

// ─── Shopify Projection Tables ───────────────────────────

export const customersProjection = pgTable(
  'customers_projection',
  {
    shopifyCustomerId: text('shopify_customer_id').primaryKey(),
    email: text('email'),
    phone: text('phone'),
    firstName: text('first_name'),
    lastName: text('last_name'),
    totalSpent: decimal('total_spent', { precision: 12, scale: 2 }),
    orderCount: integer('order_count').default(0),
    tags: text('tags').array(),
    defaultAddress: jsonb('default_address'),
    addresses: jsonb('addresses'),
    metafields: jsonb('metafields'),
    acceptsMarketing: boolean('accepts_marketing').default(false),
    smsConsent: boolean('sms_consent').default(false),
    createdAt: timestamp('created_at'),
    shopifyUpdatedAt: timestamp('shopify_updated_at'),
    syncedAt: timestamp('synced_at').defaultNow(),
  },
  (t) => [
    index('idx_customers_email').on(t.email),
    index('idx_customers_name').on(t.lastName, t.firstName),
  ]
);

export const ordersProjection = pgTable(
  'orders_projection',
  {
    shopifyOrderId: text('shopify_order_id').primaryKey(),
    shopifyCustomerId: text('shopify_customer_id'),
    orderNumber: text('order_number'),
    financialStatus: text('financial_status'),
    fulfillmentStatus: text('fulfillment_status'),
    totalPrice: decimal('total_price', { precision: 12, scale: 2 }),
    subtotalPrice: decimal('subtotal_price', { precision: 12, scale: 2 }),
    currency: text('currency'),
    lineItems: jsonb('line_items'),
    shippingAddress: jsonb('shipping_address'),
    tags: text('tags').array(),
    cancelledAt: timestamp('cancelled_at'),
    processedAt: timestamp('processed_at'),
    createdAt: timestamp('created_at'),
    shopifyUpdatedAt: timestamp('shopify_updated_at'),
    syncedAt: timestamp('synced_at').defaultNow(),
  },
  (t) => [
    index('idx_orders_customer').on(t.shopifyCustomerId),
  ]
);

export const productsProjection = pgTable('products_projection', {
  shopifyProductId: text('shopify_product_id').primaryKey(),
  handle: text('handle'),
  title: text('title'),
  description: text('description'),
  productType: text('product_type'),
  vendor: text('vendor'),
  tags: text('tags').array(),
  collections: text('collections').array(),
  images: jsonb('images'),
  metafields: jsonb('metafields'),
  priceMin: decimal('price_min', { precision: 12, scale: 2 }),
  priceMax: decimal('price_max', { precision: 12, scale: 2 }),
  createdAt: timestamp('created_at'),
  shopifyUpdatedAt: timestamp('shopify_updated_at'),
  syncedAt: timestamp('synced_at').defaultNow(),
});

export const productVariantsProjection = pgTable(
  'product_variants_projection',
  {
    shopifyVariantId: text('shopify_variant_id').primaryKey(),
    shopifyProductId: text('shopify_product_id'),
    title: text('title'),
    sku: text('sku'),
    price: decimal('price', { precision: 12, scale: 2 }),
    compareAtPrice: decimal('compare_at_price', { precision: 12, scale: 2 }),
    inventoryQuantity: integer('inventory_quantity'),
    selectedOptions: jsonb('selected_options'),
    imageUrl: text('image_url'),
    availableForSale: boolean('available_for_sale').default(true),
    metafields: jsonb('metafields'),
    syncedAt: timestamp('synced_at').defaultNow(),
  },
  (t) => [
    index('idx_variants_product').on(t.shopifyProductId),
  ]
);

export const collectionsProjection = pgTable('collections_projection', {
  shopifyCollectionId: text('shopify_collection_id').primaryKey(),
  handle: text('handle'),
  title: text('title'),
  productIds: text('product_ids').array(),
  syncedAt: timestamp('synced_at').defaultNow(),
});

// ─── CRM-Owned Tables ────────────────────────────────────

export const interactions = pgTable(
  'interactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopifyCustomerId: text('shopify_customer_id').notNull(),
    type: interactionTypeEnum('type').notNull(),
    direction: interactionDirectionEnum('direction').notNull(),
    subject: text('subject'),
    body: text('body'),
    metadata: jsonb('metadata'),
    staffId: text('staff_id'),
    locationId: text('location_id'),
    occurredAt: timestamp('occurred_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [
    index('idx_interactions_customer').on(t.shopifyCustomerId),
    index('idx_interactions_occurred').on(t.occurredAt),
  ]
);

export const secondSightIntakes = pgTable(
  'second_sight_intakes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopifyCustomerId: text('shopify_customer_id').notNull(),
    status: secondSightStatusEnum('status').default('draft'),
    grade: secondSightGradeEnum('grade'),
    photoUrls: text('photo_urls').array(),
    currentFrames: jsonb('current_frames'),
    notes: text('notes'),
    gradedBy: text('graded_by'),
    gradedAt: timestamp('graded_at'),
    creditAmount: decimal('credit_amount', { precision: 12, scale: 2 }),
    staffId: text('staff_id'),
    locationId: text('location_id'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    index('idx_intakes_customer').on(t.shopifyCustomerId),
    index('idx_intakes_status').on(t.status),
  ]
);

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopifyCustomerId: text('shopify_customer_id'),
    title: text('title').notNull(),
    status: appointmentStatusEnum('status').default('scheduled'),
    startsAt: timestamp('starts_at').notNull(),
    endsAt: timestamp('ends_at').notNull(),
    notes: text('notes'),
    staffId: text('staff_id'),
    locationId: text('location_id'),
    externalId: text('external_id'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    index('idx_appointments_customer').on(t.shopifyCustomerId),
    index('idx_appointments_date').on(t.startsAt),
    index('idx_appointments_location').on(t.locationId),
  ]
);

export const customDesigns = pgTable(
  'custom_designs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopifyCustomerId: text('shopify_customer_id').notNull(),
    status: customDesignStatusEnum('status').default('draft'),
    specs: jsonb('specs'),
    referenceImages: text('reference_images').array(),
    revisions: jsonb('revisions'),
    draftOrderId: text('draft_order_id'),
    staffId: text('staff_id'),
    locationId: text('location_id'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => [
    index('idx_designs_customer').on(t.shopifyCustomerId),
  ]
);

export const creditsLedger = pgTable(
  'credits_ledger',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopifyCustomerId: text('shopify_customer_id').notNull(),
    transactionType: creditTransactionTypeEnum('transaction_type').notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    runningBalance: decimal('running_balance', { precision: 12, scale: 2 }).notNull(),
    reason: text('reason'),
    relatedOrderId: text('related_order_id'),
    relatedIntakeId: uuid('related_intake_id'),
    staffId: text('staff_id'),
    locationId: text('location_id'),
    occurredAt: timestamp('occurred_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [
    index('idx_credits_customer').on(t.shopifyCustomerId),
  ]
);

export const preferencesDerived = pgTable('preferences_derived', {
  shopifyCustomerId: text('shopify_customer_id').primaryKey(),
  derivedShapes: jsonb('derived_shapes'),
  derivedMaterials: jsonb('derived_materials'),
  derivedColours: jsonb('derived_colours'),
  derivedPriceRange: jsonb('derived_price_range'),
  derivedLensTypes: jsonb('derived_lens_types'),
  lastComputedAt: timestamp('last_computed_at').defaultNow(),
  sourceOrderCount: integer('source_order_count').default(0),
});

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    action: auditActionEnum('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    staffId: text('staff_id'),
    actorRole: text('actor_role'),
    surface: surfaceEnum('surface').default('web'),
    locationId: text('location_id'),
    diff: jsonb('diff'),
    status: text('status').default('success'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [
    index('idx_audit_entity').on(t.entityType, t.entityId),
    index('idx_audit_created').on(t.createdAt),
    index('idx_audit_staff').on(t.staffId, t.createdAt),
  ]
);

// ─── Segments (CRM-owned) ────────────────────────────────

export const segments = pgTable('segments', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  rules: jsonb('rules').notNull(),
  memberCount: integer('member_count').default(0),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ─── Client Dedup + Linking ──────────────────────────────

export const duplicateCandidates = pgTable(
  'duplicate_candidates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientA: text('client_a').notNull(),
    clientB: text('client_b').notNull(),
    matchReason: text('match_reason').notNull(),
    confidence: decimal('confidence', { precision: 3, scale: 2 }).notNull(),
    status: text('status').default('pending'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [
    index('idx_dedup_status').on(t.status),
  ]
);

export const clientLinks = pgTable(
  'client_links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    clientA: text('client_a').notNull(),
    clientB: text('client_b').notNull(),
    relationship: text('relationship').notNull(),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [
    index('idx_links_a').on(t.clientA),
    index('idx_links_b').on(t.clientB),
  ]
);

// ─── Locations ────────────────────────────────────────────

export const locations = pgTable('locations', {
  id: text('id').primaryKey(),
  shopifyLocationId: text('shopify_location_id'),
  name: text('name').notNull(),
  address: jsonb('address'),
  active: boolean('active').default(true),
  syncedAt: timestamp('synced_at').defaultNow(),
});

// ─── Product Interactions & Try-On ───────────────────────

export const productInteractionTypeEnum = pgEnum('product_interaction_type', [
  'viewed', 'recommended', 'tried_on', 'liked', 'disliked', 'shared', 'saved', 'purchased',
]);

export const productInteractionSourceEnum = pgEnum('product_interaction_source', [
  'crm_web', 'tablet', 'storefront', 'klaviyo_click', 'system',
]);

export const productInteractions = pgTable('product_interactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  shopifyCustomerId: text('shopify_customer_id').notNull(),
  shopifyProductId: text('shopify_product_id').notNull(),
  shopifyVariantId: text('shopify_variant_id'),
  interactionType: productInteractionTypeEnum('interaction_type').notNull(),
  source: productInteractionSourceEnum('source').notNull(),
  staffId: text('staff_id'),
  locationId: text('location_id'),
  sessionId: text('session_id'),
  metadata: jsonb('metadata'),
  occurredAt: timestamp('occurred_at').defaultNow().notNull(),
}, (t) => [
  index('idx_pi_customer').on(t.shopifyCustomerId, t.occurredAt),
  index('idx_pi_product').on(t.shopifyProductId, t.occurredAt),
  index('idx_pi_type').on(t.interactionType),
  index('idx_pi_session').on(t.sessionId),
]);

export const productSentimentEnum = pgEnum('product_sentiment', ['love', 'like', 'neutral', 'dislike']);

export const productFeedback = pgTable('product_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  shopifyCustomerId: text('shopify_customer_id').notNull(),
  shopifyProductId: text('shopify_product_id').notNull(),
  sentiment: productSentimentEnum('sentiment'),
  tryOnCount: integer('try_on_count').default(0),
  viewCount: integer('view_count').default(0),
  lastInteractionAt: timestamp('last_interaction_at'),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => [
  uniqueIndex('idx_pf_unique').on(t.shopifyCustomerId, t.shopifyProductId),
]);

export const tryOnOutcomeEnum = pgEnum('try_on_outcome', ['purchased', 'saved_for_later', 'no_match', 'needs_followup']);

export const tryOnSessions = pgTable('try_on_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  shopifyCustomerId: text('shopify_customer_id').notNull(),
  staffId: text('staff_id'),
  locationId: text('location_id'),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
  framesTried: integer('frames_tried').default(0),
  outcomeTag: tryOnOutcomeEnum('outcome_tag'),
  notes: text('notes'),
}, (t) => [
  index('idx_tryon_customer').on(t.shopifyCustomerId, t.startedAt),
]);

// ─── AI Request Tracking ─────────────────────────────────

export const aiRequests = pgTable('ai_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  endpoint: text('endpoint').notNull(),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  costEstimateCents: integer('cost_estimate_cents'),
  requestedAt: timestamp('requested_at').defaultNow(),
});
