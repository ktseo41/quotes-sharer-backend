import {
  MongoClient,
  WithId,
  Document,
  InsertOneResult,
  ObjectId,
} from "mongodb";
import { v4 as uuidv4 } from "uuid";
import { getRandomName } from "../utils";
import { QuoteType } from "..";

async function connectDb() {
  const uri = `mongodb+srv://${process.env.MONGODB_NAME}:${process.env.MONGODB_PASSWORD}@${process.env.MONGODB_ADDRESS}/?retryWrites=true&w=majority`;
  const client = new MongoClient(uri);
  await client.connect();

  return client;
}

export async function getUserById(
  id: string
): Promise<WithId<Document> | null> {
  const client = await connectDb();
  const db = client.db(process.env.MONGODB_DBNAME);
  const collection = db.collection("User");
  const result = await collection.findOne({ naverAuthId: id });

  client.close();

  return result;
}

export async function createUser(
  naverAuthId: string
): Promise<InsertOneResult<Document>> {
  const client = await connectDb();
  const db = client.db(process.env.MONGODB_DBNAME);
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

export async function findOrCreateUserId(naverAuthId: string): Promise<string> {
  const user = await getUserById(naverAuthId);

  if (!user) {
    const result = await createUser(naverAuthId);

    return result.insertedId.toString();
  }

  return user._id.toString();
}

export async function createRefreshToken(userId: string): Promise<string> {
  const client = await connectDb();
  const db = client.db(process.env.MONGODB_DBNAME);
  const collection = db.collection("RefreshToken");
  const tokenId = uuidv4();
  await collection.insertOne({
    tokenId,
    userId,
  });

  client.close();

  return tokenId;
}

export async function getRefreshToken(
  tokenId: string,
  userId: string
): Promise<string | null> {
  const client = await connectDb();
  const db = client.db(process.env.MONGODB_DBNAME);
  const collection = db.collection("RefreshToken");
  const result = await collection.findOne({ tokenId, userId });

  client.close();

  if (!result) {
    return null;
  }

  return result.tokenId;
}

export async function deleteRefreshToken(tokenId: string): Promise<void> {
  const client = await connectDb();
  const db = client.db(process.env.MONGODB_NAME);
  const collection = db.collection("RefreshToken");
  await collection.deleteOne({ tokenId });

  client.close();

  return;
}

export async function createQuote(body: QuoteType & { userId: string }) {
  const client = await connectDb();
  const db = client.db(process.env.MONGODB_NAME);
  const collection = db.collection("Quote");
  const result = await collection.insertOne({
    ...body,
    createdAt: new Date().toISOString(),
  });

  client.close();

  return result;
}

export async function updateQuote(
  body: QuoteType & { userId: string } & { id: string }
) {
  const client = await connectDb();
  const db = client.db(process.env.MONGODB_NAME);
  const collection = db.collection("Quote");
  const result = await collection.updateOne(
    { _id: new ObjectId(body.id), userId: body.userId },
    {
      $set: {
        ...body,
        updatedAt: new Date().toISOString(),
      },
    }
  );

  client.close();

  return result;
}

export async function getQuotes(userId: string) {
  const client = await connectDb();
  const db = client.db(process.env.MONGODB_NAME);
  const collection = db.collection("Quote");
  const result = await collection.find({ userId }).toArray();

  client.close();

  return result;
}
