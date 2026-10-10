import "server-only";
import { MongoClient, ServerApiVersion, Db } from "mongodb";

const options = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
};

let client: MongoClient | undefined;
let clientPromise: Promise<MongoClient> | undefined;

function getClientPromise(): Promise<MongoClient> {
  if (!process.env.MONGODB_URI) {
    throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
  }
  const uri = process.env.MONGODB_URI;

  if (process.env.NODE_ENV === "development") {
    const globalWithMongo = global as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>;
    };

    if (!globalWithMongo._mongoClientPromise) {
      client = new MongoClient(uri, options);
      globalWithMongo._mongoClientPromise = client.connect();
    }
    return globalWithMongo._mongoClientPromise;
  } else {
    if (!clientPromise) {
      client = new MongoClient(uri, options);
      clientPromise = client.connect();
    }
    return clientPromise;
  }
}

export async function getDb(): Promise<Db> {
  const connectedClient = await getClientPromise();
  const dbName = process.env.MONGODB_DB || "earthlens";
  return connectedClient.db(dbName);
}

// Database initialization helper to setup collections and indexes
export async function initializeDatabase() {
  const db = await getDb();
  
  // Create users index
  await db.collection("users").createIndex(
    { email: 1 }, 
    { unique: true, background: true }
  );

  // Future collections and indexes can be added here
  // e.g. await db.collection("discoveries").createIndex({ userId: 1 }, { background: true });
}

export default clientPromise;
