/**
 * Appwrite Database Setup Script
 *
 * Creates the database, collections, and attributes for Anime Tracker.
 * Run once after creating your Appwrite project.
 *
 * Usage:
 *   node scripts/setup-appwrite.mjs <PROJECT_ID> <API_KEY>
 *
 * Get your API key from: Appwrite Console → Project Settings → API Keys
 * Create a key with scopes: databases.read, databases.write, collections.read, collections.write
 */

import { Client, Databases, ID } from 'node-appwrite';

const PROJECT_ID = process.argv[2];
const API_KEY = process.argv[3];

if (!PROJECT_ID || !API_KEY) {
  console.error('Usage: node scripts/setup-appwrite.mjs <PROJECT_ID> <API_KEY>');
  console.error('\nGet your API key from: Appwrite Console → Project Settings → API Keys');
  process.exit(1);
}

const client = new Client()
  .setEndpoint('https://sgp.cloud.appwrite.io/v1')
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const databases = new Databases(client);

const DATABASE_NAME = 'AnimeTracker';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function createAttribute(dbId, collId, type, key, opts = {}) {
  const { required = false, size = 255, dflt } = opts;
  try {
    switch (type) {
      case 'string':
        await databases.createStringAttribute(dbId, collId, key, size, required, dflt);
        break;
      case 'integer':
        await databases.createIntegerAttribute(dbId, collId, key, required, undefined, undefined, dflt);
        break;
    }
    console.log(`    ✓ ${key} (${type})`);
  } catch (err) {
    console.error(`    ✗ ${key}: ${err.message}`);
  }
  await sleep(1500);
}

async function main() {
  console.log('Setting up Appwrite database for Anime Tracker...\n');

  // Create database
  let dbId;
  try {
    const db = await databases.create(ID.unique(), DATABASE_NAME);
    dbId = db.$id;
    console.log(`✓ Database created: ${DATABASE_NAME} (${dbId})`);
  } catch (err) {
    console.error(`✗ Failed to create database: ${err.message}`);
    process.exit(1);
  }

  // --- watchlist_entries ---
  let watchlistId;
  try {
    const coll = await databases.createCollection(dbId, ID.unique(), 'watchlist_entries');
    watchlistId = coll.$id;
    console.log(`\n✓ Collection: watchlist_entries (${watchlistId})`);
  } catch (err) {
    console.error(`\n✗ watchlist_entries: ${err.message}`);
    process.exit(1);
  }

  console.log('  Creating attributes...');
  await createAttribute(dbId, watchlistId, 'string', 'user_id', { required: true, size: 36 });
  await createAttribute(dbId, watchlistId, 'integer', 'media_id', { required: true });
  await createAttribute(dbId, watchlistId, 'integer', 'id_mal');
  await createAttribute(dbId, watchlistId, 'string', 'title_romaji', { size: 500 });
  await createAttribute(dbId, watchlistId, 'string', 'title_english', { size: 500 });
  await createAttribute(dbId, watchlistId, 'string', 'cover_url', { size: 1000 });
  await createAttribute(dbId, watchlistId, 'string', 'status', { required: true, size: 50 });
  await createAttribute(dbId, watchlistId, 'integer', 'total_episodes');
  await createAttribute(dbId, watchlistId, 'integer', 'next_airing_episode');
  await createAttribute(dbId, watchlistId, 'integer', 'next_airing_at');

  // --- watched_episodes ---
  let watchedId;
  try {
    const coll = await databases.createCollection(dbId, ID.unique(), 'watched_episodes');
    watchedId = coll.$id;
    console.log(`\n✓ Collection: watched_episodes (${watchedId})`);
  } catch (err) {
    console.error(`\n✗ watched_episodes: ${err.message}`);
    process.exit(1);
  }

  console.log('  Creating attributes...');
  await createAttribute(dbId, watchedId, 'string', 'user_id', { required: true, size: 36 });
  await createAttribute(dbId, watchedId, 'integer', 'media_id', { required: true });
  await createAttribute(dbId, watchedId, 'integer', 'episode_number', { required: true });

  // --- profiles ---
  let profilesId;
  try {
    const coll = await databases.createCollection(dbId, ID.unique(), 'profiles');
    profilesId = coll.$id;
    console.log(`\n✓ Collection: profiles (${profilesId})`);
  } catch (err) {
    console.error(`\n✗ profiles: ${err.message}`);
    process.exit(1);
  }

  console.log('  Creating attributes...');
  await createAttribute(dbId, profilesId, 'string', 'user_id', { required: true, size: 36 });
  await createAttribute(dbId, profilesId, 'string', 'display_language', { required: true, size: 20, dflt: 'english' });

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('Setup complete! Add these to your web/.env.local:\n');
  console.log(`NEXT_PUBLIC_APPWRITE_PROJECT_ID=${PROJECT_ID}`);
  console.log(`NEXT_PUBLIC_APPWRITE_DATABASE_ID=${dbId}`);
  console.log(`NEXT_PUBLIC_APPWRITE_WATCHLIST_COLLECTION_ID=${watchlistId}`);
  console.log(`NEXT_PUBLIC_APPWRITE_WATCHED_EPISODES_COLLECTION_ID=${watchedId}`);
  console.log(`NEXT_PUBLIC_APPWRITE_PROFILES_COLLECTION_ID=${profilesId}`);
  console.log('\n⚠️  Don\'t forget to set collection permissions in the Appwrite Console!');
  console.log('For each collection → Settings → Permissions:');
  console.log('  • Add role "Any" with Create permission');
  console.log('  • Enable "Document Security" toggle');
  console.log('  This lets users create documents and manage their own.\n');
  console.log('Also add "localhost" as a Web platform in Project Settings → Platforms.');
}

main();
