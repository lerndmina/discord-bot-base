import { Schema, Model } from "mongoose";
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
   */
  async findOne<T>(
    schema: Model<T>,
    model: any,
    saveNull = false,
    cacheTime = ONE_HOUR
  ): Promise<T | null> {
    var start = env.DEBUG_LOG ? Date.now() : undefined;
    if (!schema || !model) {
      throw new Error("Missing schema or model");
    }
    const mongoKey = Object.keys(model)[0];
    const redisKey =
      env.MONGODB_DATABASE + ":" + schema.modelName + ":" + mongoKey + ":" + model[mongoKey];
    debugMsg(`Key: ${mongoKey} -> ${redisKey}`);

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
   */
  async find<T>(
    schema: Model<T>,
    model: any,
    saveNull = false,
    cacheTime = ONE_HOUR
  ): Promise<T[] | null> {
    var start = env.DEBUG_LOG ? Date.now() : undefined;
    if (!schema || !model) {
      throw new Error("Missing schema or model");
    }
    const mongoKey = Object.keys(model)[0];
    const redisKey =
      env.MONGODB_DATABASE + ":" + schema.modelName + ":" + mongoKey + ":" + model[mongoKey];
    debugMsg(`Key: ${mongoKey} -> ${redisKey}`);

    debugMsg(`Fetching from cache: ${redisKey}`);
    var data = await redisClient.get(redisKey);

    if (!data || data.length == 0) {
      debugMsg(model);
      data = await schema.find(model);
      if (!data || data.length == 0) {
        debugMsg(`Database miss no data found`);
        if (!saveNull) return null;
      }
      await redisClient.set(redisKey, JSON.stringify(data));
      await redisClient.expire(redisKey, cacheTime);
      if (env.DEBUG_LOG) debugMsg(`DB - find - Time taken: ${Date.now() - start!}ms`);
      return data as T[];
    }
    debugMsg(`Cache hit: ${redisKey} -> ${data}`);
    if (env.DEBUG_LOG) debugMsg(`DB - find - Time taken: ${Date.now() - start!}ms`);
    return JSON.parse(data) as T[];
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
    const mongoKey = Object.keys(model)[0];
    const redisKey =
      env.MONGODB_DATABASE + ":" + schema.modelName + ":" + mongoKey + ":" + model[mongoKey];

    const result = await schema.findOneAndUpdate(model, object, options);
    await redisClient.set(redisKey, JSON.stringify(result));
    await redisClient.expire(redisKey, cacheTime);

    if (env.DEBUG_LOG) debugMsg(`DB - update - Time taken: ${Date.now() - start!}ms`);
    debugMsg(`Updated key: ${mongoKey} -> ${redisKey}`);
    return result as T;
  }

  /**
   * Delete a document matching the query
   * @generic T - The document type
   * @param schema - Mongoose model
   * @param model - Query parameters
   */
  async deleteOne<T>(schema: Model<T>, model: any): Promise<void> {
    var start = env.DEBUG_LOG ? Date.now() : undefined;
    if (!schema || !model) {
      throw new Error("Missing schema or model");
    }
    const mongoKey = Object.keys(model)[0];
    const redisKey =
      env.MONGODB_DATABASE + ":" + schema.modelName + ":" + mongoKey + ":" + model[mongoKey];
    debugMsg(`Deleting key: ${mongoKey} -> ${redisKey}`);

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
}
