import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const dbName = process.env.MONGODB_DB || 'earthlens';

async function seed() {
  console.log('Connecting to MongoDB at', uri);
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('Connected successfully to server');
    const db = client.db(dbName);
    
    // Clear existing data
    await db.collection('users').deleteMany({});
    await db.collection('discoveries').deleteMany({});
    
    // Create test user
    const passwordHash = await bcrypt.hash('password123', 12);
    const user = {
      name: 'Explorer',
      email: 'test@example.com',
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const userResult = await db.collection('users').insertOne(user);
    console.log('Created user:', user.email);
    
    // Create some discoveries
    const discoveries = [
      {
        userId: userResult.insertedId,
        observation: {
          category: 'insect',
          description: 'A beautiful Monarch butterfly resting on a leaf.',
          photoUrl: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&q=80&w=400'
        },
        analysis: {
          candidateIdentification: 'Monarch Butterfly',
          confidence: 0.98,
          facts: ['Known for their incredible migration pattern.', 'Toxic to predators.'],
          references: ['Wikipedia']
        },
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        userId: userResult.insertedId,
        observation: {
          category: 'plant',
          description: 'Silver fern found in the dense forest.',
          photoUrl: 'https://images.unsplash.com/photo-1509937528035-ad76254b0356?auto=format&fit=crop&q=80&w=400'
        },
        analysis: {
          candidateIdentification: 'Silver Fern',
          confidence: 0.95,
          facts: ['Symbol of New Zealand.', 'Underside of leaves are silver.'],
          references: ['Wikipedia']
        },
        createdAt: new Date(Date.now() - 86400000), // Yesterday
        updatedAt: new Date(Date.now() - 86400000)
      }
    ];
    
    await db.collection('discoveries').insertMany(discoveries);
    console.log(`Created ${discoveries.length} discoveries.`);
    
    console.log('\n--- SEED SUCCESSFUL ---');
    console.log('Credentials:');
    console.log('Email: test@example.com');
    console.log('Password: password123');
    
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await client.close();
  }
}

seed();
