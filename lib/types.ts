import { ObjectId } from "mongodb";
import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email format").transform(e => e.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email format").transform(e => e.toLowerCase()),
  password: z.string().min(1, "Password is required"),
});

// MongoDB Document Types
export interface UserDocument {
  _id?: ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DiscoveryDocument {
  _id?: ObjectId;
  userId: ObjectId;
  observation: {
    description?: string;
    category: string;
    photoUrl?: string; // S3 object key or URL
  };
  analysis: {
    candidateIdentification?: string;
    confidence?: number;
    uncertainty?: string;
    facts: string[];
    ecologicalImportance?: string;
    naturalCharacteristic?: string;
    lifeLesson?: string;
    reflectionQuestion?: string;
    references: string[];
  };
  memoryCard?: {
    title: string;
    quote?: string;
    template: "light" | "dark" | "earthy";
    includePhoto: boolean;
    format: string;
    storedImageUrl?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
