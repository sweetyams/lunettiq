#!/usr/bin/env tsx
/**
 * Seed demo product_feedback data for the Product Canvas.
 * Run with: npx tsx scripts/seed-product-feedback.ts
 */
import 'dotenv/config';
import { db } from '../src/lib/db';
import { productFeedback } from '../src/lib/db/schema';

const PRODUCTS = [
  '9115324678401', // ARMATE CLEAR
  '9115328971009', // SHELBY GREEN
  '9115325464833', // ASTAIRE BLACK
  '9115321499905', // ASTORIA COGNAC
  '9115325268225', // ARMATE TORTOISE
];

const CUSTOMERS = [
  '9314240430337', '9314240463105', '9314240528641', '9314240102657',
  '9314240135425', '9314240200961', '9314240233729', '9314240266497',
  '9314239709441',
];

const SENTIMENTS = ['love', 'love', 'like', 'like', 'neutral', 'neutral', 'neutral', 'dislike'] as const;

function pick<T>(arr: readonly T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function main() {
  const rows: Array<{ shopifyCustomerId: string; shopifyProductId: string; sentiment: typeof SENTIMENTS[number]; tryOnCount: number; viewCount: number }> = [];

  for (const productId of PRODUCTS) {
    // Each product gets feedback from 4-8 random customers
    const count = rand(4, 8);
    const shuffled = [...CUSTOMERS].sort(() => Math.random() - 0.5).slice(0, count);
    for (const customerId of shuffled) {
      rows.push({
        shopifyCustomerId: customerId,
        shopifyProductId: productId,
        sentiment: pick(SENTIMENTS),
        tryOnCount: rand(1, 4),
        viewCount: rand(1, 10),
      });
    }
  }

  let inserted = 0;
  for (const row of rows) {
    try {
      await db.insert(productFeedback).values(row).onConflictDoNothing();
      inserted++;
    } catch {}
  }

  console.log(`Inserted ${inserted} product feedback rows across ${PRODUCTS.length} products`);
  process.exit(0);
}

main();
