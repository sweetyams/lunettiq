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
  // V2 points
  'points_issued_signup',
  'points_issued_purchase',
  'points_issued_birthday',
  'points_issued_review',
  'points_issued_referral_referrer',
  'points_issued_referral_referred',
  'points_issued_milestone',
  'points_redeemed_order',
  'points_redeemed_membership_conversion',
  'points_expired',
  // V2 trials
  'membership_trial_started',
  'membership_trial_converted',
  'membership_trial_cancelled',
  'membership_trial_clawback',
  // V2 referral
  'referral_qualified',
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

export const ledgerCurrencyEnum = pgEnum('ledger_currency', ['credit', 'points']);

export const referralStatusEnum = pgEnum('referral_status', ['pending', 'qualified', 'fraudulent', 'expired']);

export const trialOutcomeEnum = pgEnum('trial_outcome', ['pending', 'converted', 'cancelled', 'clawback_applied']);

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
    source: text('source').default('shopify'), // 'shopify' | 'square'
    locationId: text('location_id'), // references locations.id
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
  status: text('status').default('active'), // 'active' | 'draft' | 'archived'
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
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    notes: text('notes'),
    staffId: text('staff_id'),
    locationId: text('location_id'),
    externalId: text('external_id'),
    // Recurrence
    recurrenceRule: text('recurrence_rule'),       // iCal RRULE string e.g. "FREQ=WEEKLY;BYDAY=MO;COUNT=10"
    seriesId: uuid('series_id'),                   // shared UUID across all instances in a series
    seriesIndex: integer('series_index'),           // 0-based position in the series
    seriesExceptions: jsonb('series_exceptions'),   // only on index=0: array of ISO dates to skip
    reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_appointments_customer').on(t.shopifyCustomerId),
    index('idx_appointments_date').on(t.startsAt),
    index('idx_appointments_location').on(t.locationId),
    index('idx_appointments_series').on(t.seriesId),
  ]
);

export const staffSchedules = pgTable(
  'staff_schedules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    staffId: text('staff_id').notNull(),
    dayOfWeek: integer('day_of_week').notNull(), // 0=Sun, 1=Mon … 6=Sat
    startTime: text('start_time').notNull(),     // "09:00"
    endTime: text('end_time').notNull(),         // "18:00"
    locationId: text('location_id'),
  },
  (t) => [
    index('idx_staff_schedules_staff').on(t.staffId, t.dayOfWeek),
  ]
);

export const loyaltyTiers = pgTable('loyalty_tiers', {
  id: text('id').primaryKey(),                    // e.g. "essential", "cult", "vault"
  label: text('label').notNull(),                 // Display name
  tag: text('tag').notNull(),                     // Shopify tag e.g. "member-essential"
  monthlyCredit: decimal('monthly_credit', { precision: 8, scale: 2 }).notNull(),
  birthdayCredit: decimal('birthday_credit', { precision: 8, scale: 2 }).default('20'),
  tradeInRate: decimal('trade_in_rate', { precision: 4, scale: 3 }).notNull(), // e.g. 0.200
  lensRefresh: boolean('lens_refresh').default(false),
  frameRotation: text('frame_rotation'),          // null, "25% off", "Free swap"
  sortOrder: integer('sort_order').default(0),
  active: boolean('active').default(true),
  // V2 fields
  monthlyFee: decimal('monthly_fee', { precision: 8, scale: 2 }),
  annualFee: decimal('annual_fee', { precision: 8, scale: 2 }),
  secondSightRate: decimal('second_sight_rate', { precision: 4, scale: 3 }),
  earlyAccessHours: integer('early_access_hours').default(0),
  namedOptician: boolean('named_optician').default(false),
  freeRepairs: text('free_repairs'),
  styleConsultation: text('style_consultation'),
  eventsPerYear: integer('events_per_year').default(0),
  annualGift: boolean('annual_gift').default(false),
  archiveVote: boolean('archive_vote').default(false),
  privateWhatsapp: boolean('private_whatsapp').default(false),
  // V2 shipping & referral
  shippingTier: text('shipping_tier'),            // null, "standard", "priority", "overnight"
  referralRewardCredit: decimal('referral_reward_credit', { precision: 8, scale: 2 }),
  referralExtensionMonths: integer('referral_extension_months').default(0),
  referredDiscount: decimal('referred_discount', { precision: 8, scale: 2 }),
  referredTrialTier: text('referred_trial_tier'), // e.g. "cult", "essential"
  createdAt: timestamp('created_at').defaultNow(),
});

// ─── Referrals ───────────────────────────────────────────

export const referrals = pgTable(
  'referrals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    referrerCustomerId: text('referrer_customer_id').notNull(),
    referrerCode: text('referrer_code').notNull(),
    referredCustomerId: text('referred_customer_id'),
    referredEmail: text('referred_email'),
    status: referralStatusEnum('status').default('pending'),
    clickedAt: timestamp('clicked_at', { withTimezone: true }).defaultNow(),
    signedUpAt: timestamp('signed_up_at', { withTimezone: true }),
    qualifiedAt: timestamp('qualified_at', { withTimezone: true }),
    qualifyingOrderId: text('qualifying_order_id'),
    referrerTierAtQualification: text('referrer_tier_at_qualification'),
    referrerRewardAmount: decimal('referrer_reward_amount', { precision: 12, scale: 2 }),
    referrerRewardCurrency: ledgerCurrencyEnum('referrer_reward_currency'),
    fraudSignals: jsonb('fraud_signals'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_referrals_referrer').on(t.referrerCustomerId),
    uniqueIndex('idx_referrals_code').on(t.referrerCode),
    index('idx_referrals_status').on(t.status),
  ]
);

// ─── Membership Trials ──────────────────────────────────

export const membershipTrials = pgTable(
  'membership_trials',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    shopifyCustomerId: text('shopify_customer_id').notNull(),
    tier: text('tier').notNull().default('cult'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow(),
    creditsIssuedAtStart: decimal('credits_issued_at_start', { precision: 12, scale: 2 }),
    creditsUsedDuringTrial: decimal('credits_used_during_trial', { precision: 12, scale: 2 }).default('0'),
    outcome: trialOutcomeEnum('outcome').default('pending'),
    convertsAt: timestamp('converts_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    clawbackAmount: decimal('clawback_amount', { precision: 12, scale: 2 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => [
    index('idx_trials_customer').on(t.shopifyCustomerId),
  ]
);

export const appointmentTypes = pgTable('appointment_types', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  durationMinutes: integer('duration_minutes').notNull().default(30),
  bufferMinutes: integer('buffer_minutes').notNull().default(0),
  locationId: text('location_id'),
  active: boolean('active').default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

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
    currency: ledgerCurrencyEnum('currency').default('credit').notNull(),
    transactionType: creditTransactionTypeEnum('transaction_type').notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
    runningBalance: decimal('running_balance', { precision: 12, scale: 2 }).notNull(),
    reason: text('reason'),
    relatedOrderId: text('related_order_id'),
    relatedIntakeId: uuid('related_intake_id'),
    relatedReferralId: uuid('related_referral_id'),
    staffId: text('staff_id'),
    locationId: text('location_id'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    occurredAt: timestamp('occurred_at').defaultNow(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [
    index('idx_credits_customer').on(t.shopifyCustomerId),
    index('idx_credits_currency').on(t.shopifyCustomerId, t.currency),
    index('idx_credits_expiry').on(t.expiresAt),
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
  squareLocationId: text('square_location_id'),
  name: text('name').notNull(),
  address: jsonb('address'),
  timezone: text('timezone').default('America/Montreal'),
  maxConcurrent: integer('max_concurrent').default(1),
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

// ─── Gift Memberships ────────────────────────────────────

export const giftMembershipStatusEnum = pgEnum('gift_membership_status', ['purchased', 'redeemed', 'expired']);

export const giftMemberships = pgTable('gift_memberships', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull(),
  purchaserCustomerId: text('purchaser_customer_id').notNull(),
  recipientCustomerId: text('recipient_customer_id'),
  recipientEmail: text('recipient_email'),
  tier: text('tier').notNull(),
  durationMonths: integer('duration_months').notNull().default(12),
  status: giftMembershipStatusEnum('status').default('purchased'),
  purchasedAt: timestamp('purchased_at', { withTimezone: true }).defaultNow(),
  redeemedAt: timestamp('redeemed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  message: text('message'),
}, (t) => [
  uniqueIndex('idx_gift_code').on(t.code),
  index('idx_gift_purchaser').on(t.purchaserCustomerId),
]);

// ─── VAULT Events ────────────────────────────────────────

export const brandEventStatusEnum = pgEnum('brand_event_status', ['draft', 'published', 'cancelled', 'completed']);
export const eventInviteStatusEnum = pgEnum('event_invite_status', ['invited', 'accepted', 'declined', 'attended', 'no_show']);

export const brandEvents = pgTable('brand_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  location: text('location'),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  capacity: integer('capacity'),
  tierMinimum: text('tier_minimum').default('vault'), // vault, cult, essential
  status: brandEventStatusEnum('status').default('draft'),
  imageUrl: text('image_url'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [index('idx_events_date').on(t.startsAt)]);

export const eventInvites = pgTable('event_invites', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').notNull(),
  shopifyCustomerId: text('shopify_customer_id').notNull(),
  status: eventInviteStatusEnum('status').default('invited'),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('idx_invites_event').on(t.eventId),
  index('idx_invites_customer').on(t.shopifyCustomerId),
]);

// ─── Archive Votes ───────────────────────────────────────

export const archiveVotes = pgTable('archive_votes', {
  id: uuid('id').defaultRandom().primaryKey(),
  year: integer('year').notNull(),
  shopifyCustomerId: text('shopify_customer_id').notNull(),
  productHandle: text('product_handle').notNull(), // which archive frame they voted for
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  uniqueIndex('idx_votes_unique').on(t.year, t.shopifyCustomerId),
  index('idx_votes_year').on(t.year),
]);

// ─── Gift Fulfilments ────────────────────────────────────

export const giftFulfilmentStatusEnum = pgEnum('gift_fulfilment_status', ['pending', 'sourcing', 'shipped', 'delivered']);

export const giftFulfilments = pgTable('gift_fulfilments', {
  id: uuid('id').defaultRandom().primaryKey(),
  shopifyCustomerId: text('shopify_customer_id').notNull(),
  year: integer('year').notNull(),
  status: giftFulfilmentStatusEnum('status').default('pending'),
  giftDescription: text('gift_description'),
  trackingNumber: text('tracking_number'),
  shippedAt: timestamp('shipped_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('idx_gifts_customer').on(t.shopifyCustomerId),
  index('idx_gifts_status').on(t.status),
]);

// ─── Notifications ───────────────────────────────────────

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  type: text('type').notNull().default('info'),
  entityType: text('entity_type'),
  entityId: text('entity_id'),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  index('idx_notifications_user').on(t.userId, t.createdAt),
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

// ─── Returns ─────────────────────────────────────────────

export const returnReasonEnum = pgEnum('return_reason', [
  'doesnt_fit', 'doesnt_suit', 'colour_different', 'changed_mind',
  'received_damaged', 'received_wrong', 'rx_issue', 'other',
]);

export const returnResolutionEnum = pgEnum('return_resolution', ['refund', 'credit', 'exchange']);

export const returnStatusEnum = pgEnum('return_status', [
  'requested', 'label_sent', 'in_transit', 'received', 'resolved', 'rejected',
]);

export const returns = pgTable('returns', {
  id: uuid('id').defaultRandom().primaryKey(),
  orderId: text('order_id').notNull(),
  shopifyCustomerId: text('shopify_customer_id').notNull(),
  lineItems: jsonb('line_items').notNull(), // [{variantId, title, quantity, reason, reasonDetail}]
  resolutionType: returnResolutionEnum('resolution_type').notNull(),
  resolutionAmount: decimal('resolution_amount', { precision: 12, scale: 2 }),
  status: returnStatusEnum('status').default('requested'),
  returnReasonPrimary: returnReasonEnum('return_reason_primary').notNull(),
  returnReasonDetail: text('return_reason_detail'),
  exchangeOrderId: text('exchange_order_id'),
  shippingLabelUrl: text('shipping_label_url'),
  requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow(),
  receivedAt: timestamp('received_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  rejectedReason: text('rejected_reason'),
  staffId: text('staff_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('idx_returns_customer').on(t.shopifyCustomerId),
  index('idx_returns_order').on(t.orderId),
  index('idx_returns_status').on(t.status),
]);

// ─── Search ──────────────────────────────────────────────

export const searchQueries = pgTable('search_queries', {
  id: uuid('id').defaultRandom().primaryKey(),
  queryRaw: text('query_raw').notNull(),
  queryNormalized: text('query_normalized').notNull(),
  resultCount: integer('result_count').default(0),
  personalized: boolean('personalized').default(false),
  synonymFired: text('synonym_fired'),
  zeroResults: boolean('zero_results').default(false),
  clickedProducts: jsonb('clicked_products'), // [{productId, position}]
  timeToClickMs: integer('time_to_click_ms'),
  filtersApplied: jsonb('filters_applied'),
  customerId: text('customer_id'),
  sessionId: text('session_id'),
  deviceType: text('device_type'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('idx_search_queries_normalized').on(t.queryNormalized),
  index('idx_search_queries_created').on(t.createdAt),
  index('idx_search_queries_customer').on(t.customerId),
]);

export const searchSynonyms = pgTable('search_synonyms', {
  id: uuid('id').defaultRandom().primaryKey(),
  terms: text('terms').array().notNull(), // array of equivalent terms
  active: boolean('active').default(true),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// ─── Integration Config ──────────────────────────────────

// ─── Product Families ────────────────────────────────────────────────────
// Groups products by model (e.g. SHELBY) for colour/type switching on PDP

export const productFamilies = pgTable('product_families', {
  id: text('id').primaryKey(), // e.g. 'shelby', 'fontaine'
  name: text('name').notNull(), // 'SHELBY', 'FONTAINE'
});

export const productFamilyMembers = pgTable('product_family_members', {
  id: uuid('id').defaultRandom().primaryKey(),
  familyId: text('family_id').notNull(),
  productId: text('product_id').notNull(),
  type: text('type'), // 'optical' | 'sun'
  colour: text('colour'), // display colour e.g. 'green', 'black'
  colourHex: text('colour_hex'), // swatch hex for frontend
  sortOrder: integer('sort_order').default(0),
}, (t) => ({
  uniq: uniqueIndex('pfm_family_product_uniq').on(t.familyId, t.productId),
  idxFamily: index('idx_pfm_family').on(t.familyId),
  idxProduct: index('idx_pfm_product').on(t.productId),
}));

// ─── Unified Filter System ───────────────────────────────────────────────
// filter_groups: defines available filter values per type (colour, shape, size, material, etc.)
// product_filters: maps products to filter groups with auto/confirmed/manual status

export const filterGroups = pgTable('filter_groups', {
  id: text('id').primaryKey(), // e.g. 'colour:brown', 'shape:round', 'size:small'
  type: text('type').notNull(), // 'colour', 'shape', 'size', 'material', etc.
  slug: text('slug').notNull(), // 'brown', 'round', 'small'
  label: text('label').notNull(), // 'Brown', 'Round', 'Small'
  sortOrder: integer('sort_order').default(0),
}, (t) => ({
  idxType: index('idx_fg_type').on(t.type),
}));

export const productFilters = pgTable('product_filters', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: text('product_id').notNull(),
  filterGroupId: text('filter_group_id').notNull(),
  status: text('status').notNull().default('auto'), // 'auto' | 'confirmed' | 'manual'
  matchedBy: text('matched_by'), // userId who confirmed/set manually
}, (t) => ({
  uniq: uniqueIndex('pf_product_filter_uniq').on(t.productId, t.filterGroupId),
  idxProduct: index('idx_pf_product').on(t.productId),
  idxFilter: index('idx_pf_filter').on(t.filterGroupId),
}));

// Legacy — kept for migration reference, can be dropped later
export const colourGroups = pgTable('colour_groups', {
  id: text('id').primaryKey(),
  label: text('label').notNull(),
  members: text('members').array().notNull(),
  sortOrder: integer('sort_order').default(0),
});

export const storeSettings = pgTable('store_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const productColours = pgTable('product_colours', {
  productId: text('product_id').notNull(),
  colourGroupId: text('colour_group_id').notNull(),
}, (t) => ({
  pk: uniqueIndex('product_colours_pk').on(t.productId, t.colourGroupId),
  idxProduct: index('idx_pc_product').on(t.productId),
}));

export const productMappings = pgTable('product_mappings', {
  squareCatalogId: text('square_catalog_id').primaryKey(),
  squareName: text('square_name'),
  shopifyProductId: text('shopify_product_id'),
  shopifyVariantId: text('shopify_variant_id'),
  confidence: decimal('confidence', { precision: 3, scale: 2 }), // 0.00-1.00
  status: text('status').default('unmatched'), // 'auto' | 'confirmed' | 'manual' | 'unmatched' | 'ignored'
  parsedFrame: text('parsed_frame'),
  parsedColour: text('parsed_colour'),
  parsedType: text('parsed_type'), // 'optical' | 'sun' | 'service' | 'other'
  familyId: text('family_id'), // link to product_families when no exact Shopify product exists
  matchedBy: text('matched_by'), // userId who confirmed/manual linked
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const integrationsConfig = pgTable('integrations_config', {
  id: text('id').primaryKey(), // matches integration registry id
  enabled: boolean('enabled').default(false),
  keys: jsonb('keys'), // encrypted key-value pairs { KEY_NAME: "encrypted_value" }
  configuredAt: timestamp('configured_at', { withTimezone: true }),
  configuredBy: text('configured_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// ─── Credit Codes (gift cards + in-store codes) ──────────

export const creditCodeStatusEnum = pgEnum('credit_code_status', ['active', 'used', 'revoked', 'expired']);

export const creditCodes = pgTable('credit_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  shopifyCustomerId: text('shopify_customer_id').notNull(),
  method: text('method').notNull(), // 'gift_card' | 'square_discount'
  code: text('code').notNull(),
  fullCode: text('full_code'), // full gift card code (only available at creation)
  amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
  status: creditCodeStatusEnum('status').default('active'),
  shopifyGiftCardId: text('shopify_gift_card_id'), // if gift card
  usedAt: timestamp('used_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  revokedBy: text('revoked_by'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (t) => [
  index('idx_credit_codes_customer').on(t.shopifyCustomerId),
  index('idx_credit_codes_status').on(t.status),
]);
