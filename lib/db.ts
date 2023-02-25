import { MongoClient, WithId, Document, InsertOneResult } from "mongodb";
import { getRandomName } from "../utils";

async function connectDb() {
  const uri = `mongodb+srv://${process.env.MONGODB_NAME}:${process.env.MONGODB_PASSWORD}@cluster0.dtzskey.mongodb.net/?retryWrites=true&w=majority`;
  const client = new MongoClient(uri);
  await client.connect();

  return client;
}

// TODO: db name, collection name move to env
export async function getUserById(
  id: string
): Promise<WithId<Document> | null> {
  const client = await connectDb();
  const db = client.db("QuotesSharer");
  const collection = db.collection("User");
  const result = await collection.findOne({ naverAuthId: id });

  client.close();

  return result;
}

export async function createUser(
  naverAuthId: string
): Promise<InsertOneResult<Document>> {
  const client = await connectDb();
  const db = client.db("QuotesSharer");
  const collection = db.collection("User");
  const currentTime = new Date().getTime();
  const result = await collection.insertOne({
    naverAuthId,
    createdAt: currentTime,
    updatedAt: currentTime,
    nickname: getRandomName(),
  });

  client.close();

  return result;
}
