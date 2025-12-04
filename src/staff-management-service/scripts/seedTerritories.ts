/**
 * Seed Territories Script
 * Run: npm run seed:territories
 */

import { seedTerritories } from '../src/lib/territoryRepository';

async function main() {
  console.log('Starting territory seeding...');

  try {
    await seedTerritories();
    console.log('Territory seeding completed successfully!');
  } catch (error) {
    console.error('Territory seeding failed:', error);
    process.exit(1);
  }
}

main();

