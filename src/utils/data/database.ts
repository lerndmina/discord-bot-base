import { Schema, Model, UpdateQuery } from "mongoose";
import { redisClient } from "../../Bot";
import { debugMsg } from "../TinyUtils";
import FetchEnvs from "../FetchEnvs";
const env = FetchEnvs();

const ONE_HOUR = 1 * 60 * 60; // Redis uses seconds.

export default class Database {
  // TODO This needs work to find & add the correct types
  /**
   * Find one document matching the query
   * @generic T - The document type to return
   * @param schema - Mongoose model
   * @param model - Query parameters
   * @param saveNull - Whether to save null values to cache
   * @param cacheTime - Cache time in seconds
   */ async findOne<T>(
    schema: Model<T>,
    model: any,
    saveNull = false,
    cacheTime = ONE_HOUR
  ): Promise<T | null> {
    var start = env.DEBUG_LOG ? Date.now() : undefined;
    if (!schema || !model) {
      throw new Error("Missing schema or model");
    }
    // Create a cache key that includes all query fields to avoid collisions
    const queryKeys = Object.keys(model).sort(); // Sort for consistency
    const keyParts = queryKeys.map((key) => `${key}:${model[key]}`).join("|");
    const redisKey = `${env.MONGODB_DATABASE}:${schema.modelName}:${keyParts}`;
    debugMsg(`Keys: ${queryKeys.join(", ")} -> ${redisKey}`);

    debugMsg(`Fetching from cache: ${redisKey}`);
    var data = await redisClient.get(redisKey);

    if (!data) {
      debugMsg(`Cache miss fetching db:`);
      debugMsg(model);
      data = await schema.findOne(model);
      if (!data) {
        debugMsg(`Database miss no data found`);
        if (!saveNull) return null;
      }
      await redisClient.set(redisKey, JSON.stringify(data));
      await redisClient.expire(redisKey, cacheTime);
      if (env.DEBUG_LOG) debugMsg(`DB - findOne - Time taken: ${Date.now() - start!}ms`);
      return data as T;
    }

    debugMsg(`Cache hit: ${redisKey} -> ${data}`);
    if (env.DEBUG_LOG) debugMsg(`DB - findOne - Time taken: ${Date.now() - start!}ms`);
    return JSON.parse(data) as T;
  }

  /**
   * Find multiple documents matching the query
   * @generic T - The document type to return
   * @param schema - Mongoose model
   * @param model - Query parameters
   * @param saveNull - Whether to save null values to cache
   * @param cacheTime - Cache time in seconds
   */ async find<T>(
    schema: Model<T>,
    model: any,
    saveNull = false,
    cacheTime = ONE_HOUR
  ): Promise<T[] | null> {
    var start = env.DEBUG_LOG ? Date.now() : undefined;
    if (!schema || !model) {
      throw new Error("Missing schema or model");
    }
    // Create a cache key that includes all query fields to avoid collisions
    const queryKeys = Object.keys(model).sort(); // Sort for consistency
    const keyParts = queryKeys.map((key) => `${key}:${model[key]}`).join("|");
    const redisKey = `${env.MONGODB_DATABASE}:${schema.modelName}:${keyParts}`;
    debugMsg(`Keys: ${queryKeys.join(", ")} -> ${redisKey}`);

    debugMsg(`Fetching from cache: ${redisKey}`);
    var data = await redisClient.get(redisKey);

    if (!data || data.length == 0) {
      debugMsg(model);
      const dbResult = await schema.find(model);
      if (!data || data.length == 0) {
        debugMsg(`Database miss no data found`);
        if (!saveNull) return null;
      }
      await redisClient.set(redisKey, JSON.stringify(data));
      await redisClient.expire(redisKey, cacheTime);
      if (env.DEBUG_LOG) debugMsg(`DB - find - Time taken: ${Date.now() - start!}ms`);
      // Ensure we always return an array
      return Array.isArray(data) ? (data as T[]) : [data as T];
    }
    debugMsg(`Cache hit: ${redisKey} -> ${data}`);
    if (env.DEBUG_LOG) debugMsg(`DB - find - Time taken: ${Date.now() - start!}ms`);
    // Parse the data and ensure it's always an array
    const parsedData = JSON.parse(data);
    return Array.isArray(parsedData) ? (parsedData as T[]) : [parsedData as T];
  }

  /**
   * Find and update a document matching the query
   * @generic T - The document type to return
   * @param schema - Mongoose model
   * @param model - Query parameters
   * @param object - Update data
   * @param options - Query options
   * @param cacheTime - Cache time in seconds
   */
  async findOneAndUpdate<T>(
    schema: Model<T>,
    model: any,
    object: any,
    options = {
      upsert: true,
      new: true,
    },
    cacheTime = ONE_HOUR
  ): Promise<T | null> {
    var start = env.DEBUG_LOG ? Date.now() : undefined;
    if (!schema || !model) {
      throw new Error("Missing schema or model");
    }
    // Create a cache key that includes all query fields to avoid collisions
    const queryKeys = Object.keys(model).sort(); // Sort for consistency
    const keyParts = queryKeys.map((key) => `${key}:${model[key]}`).join("|");
    const redisKey = `${env.MONGODB_DATABASE}:${schema.modelName}:${keyParts}`;

    const result = await schema.findOneAndUpdate(model, object, options);
    await redisClient.set(redisKey, JSON.stringify(result));
    await redisClient.expire(redisKey, cacheTime);

    if (env.DEBUG_LOG) debugMsg(`DB - update - Time taken: ${Date.now() - start!}ms`);
    debugMsg(`Updated keys: ${queryKeys.join(", ")} -> ${redisKey}`);
    return result as T;
  }

  /**
   * Delete a document matching the query
   * @generic T - The document type
   * @param schema - Mongoose model
   * @param model - Query parameters
   */ async deleteOne<T>(schema: Model<T>, model: any): Promise<void> {
    var start = env.DEBUG_LOG ? Date.now() : undefined;
    if (!schema || !model) {
      throw new Error("Missing schema or model");
    }
    // Create a cache key that includes all query fields to avoid collisions
    const queryKeys = Object.keys(model).sort(); // Sort for consistency
    const keyParts = queryKeys.map((key) => `${key}:${model[key]}`).join("|");
    const redisKey = `${env.MONGODB_DATABASE}:${schema.modelName}:${keyParts}`;
    debugMsg(`Deleting keys: ${queryKeys.join(", ")} -> ${redisKey}`);

    await redisClient.del(redisKey);
    await schema.deleteOne(model);
    if (env.DEBUG_LOG) debugMsg(`DB - delete - Time taken: ${Date.now() - start!}ms`);
  }

  /**
   * Find and delete a document matching the query
   * @generic T - The document type
   * @param schema - Mongoose model
   * @param model - Query parameters
   */
  async findOneAndDelete<T>(schema: Model<T>, model: any): Promise<void> {
    return this.deleteOne<T>(schema, model);
  }

  /**
   * @param {String} keyQuery - Keys Pattern https://redis.io/commands/keys/
   * @returns {Promise<String[]>} - An array of deleted keys
   * @description Deletes all keys that match the pattern, this only deletes keys in the cache
   */
  async cleanCache(keyQuery: string) {
    debugMsg(`Cleaning cache with pattern ${keyQuery}`);
    var start = env.DEBUG_LOG ? Date.now() : undefined;
    const keys = await redisClient.keys(keyQuery);
    if (!keys || keys.length == 0) return [];
    for (const key of keys) {
      await redisClient.del(key);
    }
    debugMsg(`Cleaned ${keys.length} key(s)`);
    if (env.DEBUG_LOG) debugMsg(`DB - Clean - Time taken: ${Date.now() - start!}ms`);
    return keys;
  }

  /**
   * Get cache keys for a schema
   * @generic T - The document type
   * @param Schema - Mongoose model
   * @param keyQuery - Key query string
   * @returns Formatted cache key
   */
  getCacheKeys<T>(Schema: Model<T>, keyQuery: string): string {
    return `${env.MONGODB_DATABASE}:${Schema.modelName}:${keyQuery}`;
  }

  /**
   * @description Stores a key value pair in the cache with an optional cache time in seconds
   */
  async cacheStore(key: string, value: string, cacheTime = ONE_HOUR) {
    debugMsg(`Storing key: ${key} with value: ${value} in cache`);
    await redisClient.set(key, value);
    await redisClient.expire(key, cacheTime);
  }

  async cacheFetch(key: string) {
    debugMsg(`Fetching key: ${key} from cache`);
    return await redisClient.get(key);
  }

  /**
   * Add a value to an array field atomically
   * @generic T - The document type
   * @param schema - Mongoose model
   * @param query - Query to find the document
   * @param field - Array field to update
   * @param value - Value to add
   * @param cacheTime - Cache time in seconds
   */
  async addToSet<T>(
    schema: Model<T>,
    query: any,
    field: string,
    value: any,
    cacheTime = ONE_HOUR
  ): Promise<T | null> {
    var start = env.DEBUG_LOG ? Date.now() : undefined;
    if (!schema || !query) {
      throw new Error("Missing schema or query");
    }

    const mongoKey = Object.keys(query)[0];
    const redisKey =
      env.MONGODB_DATABASE + ":" + schema.modelName + ":" + mongoKey + ":" + query[mongoKey];

    const update = {
      $addToSet: { [field]: value },
    } as UpdateQuery<T>;

    const result = await schema.findOneAndUpdate(query, update, { upsert: true, new: true });

    await redisClient.set(redisKey, JSON.stringify(result));
    await redisClient.expire(redisKey, cacheTime);

    if (env.DEBUG_LOG) debugMsg(`DB - addToSet - Time taken: ${Date.now() - start!}ms`);
    return result as T;
  }

  /**
   * Remove a value from an array field atomically
   * @generic T - The document type
   * @param schema - Mongoose model
   * @param query - Query to find the document
   * @param field - Array field to update
   * @param value - Value to remove
   * @param cacheTime - Cache time in seconds
   */
  async pullFromSet<T>(
    schema: Model<T>,
    query: any,
    field: string,
    value: any,
    cacheTime = ONE_HOUR
  ): Promise<T | null> {
    var start = env.DEBUG_LOG ? Date.now() : undefined;
    if (!schema || !query) {
      throw new Error("Missing schema or query");
    }

    const mongoKey = Object.keys(query)[0];
    const redisKey =
      env.MONGODB_DATABASE + ":" + schema.modelName + ":" + mongoKey + ":" + query[mongoKey];

    const update = {
      $pull: { [field]: value },
    } as UpdateQuery<T>;

    const result = await schema.findOneAndUpdate(query, update, { new: true });

    if (result) {
      await redisClient.set(redisKey, JSON.stringify(result));
      await redisClient.expire(redisKey, cacheTime);
    } else {
      await redisClient.del(redisKey);
    }

    if (env.DEBUG_LOG) debugMsg(`DB - pullFromSet - Time taken: ${Date.now() - start!}ms`);
    return result as T;
  }

  /**
   * Update multiple documents matching the query
   * @generic T - The document type
   * @param schema - Mongoose model
   * @param query - Query to find documents
   * @param update - Update data
   */
  async updateMany<T>(schema: Model<T>, query: any, update: any): Promise<void> {
    var start = env.DEBUG_LOG ? Date.now() : undefined;
    if (!schema || !query) {
      throw new Error("Missing schema or query");
    }

    await schema.updateMany(query, update);
    // Clear related cache entries since we can't know all affected keys
    const schemaPattern = `${env.MONGODB_DATABASE}:${schema.modelName}:*`;
    const keys = await redisClient.keys(schemaPattern);
    if (keys.length > 0) {
      for (const key of keys) {
        await redisClient.del(key);
      }
    }

    if (env.DEBUG_LOG) debugMsg(`DB - updateMany - Time taken: ${Date.now() - start!}ms`);
  }
}
