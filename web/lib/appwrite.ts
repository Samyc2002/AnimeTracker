import { Client, Account, Databases } from 'appwrite';

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

export const account = new Account(client);
export const databases = new Databases(client);

export const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
export const WATCHLIST_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_WATCHLIST_COLLECTION_ID!;
export const WATCHED_EPISODES_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_WATCHED_EPISODES_COLLECTION_ID!;
export const PROFILES_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_PROFILES_COLLECTION_ID!;
