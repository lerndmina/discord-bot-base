import { Schema, Model } from "mongoose";
import { redisClient } from "../../Bot";
import { debugMsg } from "../TinyUtils";
import FetchEnvs from "../FetchEnvs";
const env = FetchEnvs();

const ONE_HOUR = 1 * 60 * 60; // Redis uses seconds.

export default class Database {
  // TODO This needs work to find & add the correct types
  /**
   *
   * @param {Schema} schema
   * @param {Map} model
   * @param {boolean} [saveNull=false] - Optional, save null values to cache
   * @param {number} [cacheTime=ONE_HOUR] - Optional, cache time in seconds
   */
  async findOne(schema: any, model: any, saveNull = false, cacheTime = ONE_HOUR) {
    var start = env.DEBUG_LOG ? Date.now() : undefined;
    if (!schema || !model) {
      throw new Error("Missing schema or model");
    }
    const mongoKey = Object.keys(model)[0];
    const redisKey =
      env.MONGODB_DATABASE + ":" + schema.modelName + ":" + mongoKey + ":" + model[mongoKey];
    debugMsg(`Key: ${mongoKey} -> ${redisKey}`);
    // The value of this map is the key for redis because it's unique

    debugMsg(`Fetching from cache: ${redisKey}`);
    var data = await redisClient.get(redisKey);

    if (!data) {
      debugMsg(`Cache miss fetching db:`);
      debugMsg(model);
      data = await schema.findOne(model);
      if (!data) {
        debugMsg(`Database miss no data found`);
        // Return to stop the redis cache from being set
        if (!saveNull) return null;
        // TODO: Make this a less confusing return
      }
      await redisClient.set(redisKey, JSON.stringify(data));
      await redisClient.expire(redisKey, cacheTime);
      if (env.DEBUG_LOG) debugMsg(`DB - findOne - Time taken: ${Date.now() - start!}ms`);
      return data;
    }

    debugMsg(`Cache hit: ${redisKey} -> ${data}`);
    if (env.DEBUG_LOG) debugMsg(`DB - findOne - Time taken: ${Date.now() - start!}ms`);
    return JSON.parse(data);
  }

  /**
   * @param {Schema} schema
   * @param {Map} model
   * @param {boolean} [saveNull=false] - Optional, save null values to cache
   * @param {number} [cacheTime=ONE_HOUR] - Optional, cache time in seconds
   * @description Finds all the documents in the database that match the model
   */
  async find(schema: any, model: any, saveNull = false, cacheTime = ONE_HOUR) {
    var start = env.DEBUG_LOG ? Date.now() : undefined;
    if (!schema || !model) {
      throw new Error("Missing schema or model");
    }
    const mongoKey = Object.keys(model)[0];
    const redisKey =
      env.MONGODB_DATABASE + ":" + schema.modelName + ":" + mongoKey + ":" + model[mongoKey];
    debugMsg(`Key: ${mongoKey} -> ${redisKey}`);

    debugMsg(`Fetching from cache: ${redisKey}`);
    var data = (await redisClient.get(redisKey)) as any;

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
      return data;
    }
    debugMsg(`Cache hit: ${redisKey} -> ${data}`);
    if (env.DEBUG_LOG) debugMsg(`DB - find - Time taken: ${Date.now() - start!}ms`);
    return JSON.parse(data);
  }

  /**
   *
   * @param {Schema} schema
   * @param {Map} model
   * @param {Map} object
   * @param {QueryOptions} [options={ upsert: true, new: true }] - Optional parameter with default value
   * @param {number} [cacheTime=ONE_HOUR] - Optional, cache time in seconds
   */
  async findOneAndUpdate(
    schema: any,
    model: any, // This is probably unsafe but I don't know how to fix it
    object: any,
    options = {
      upsert: true,
      new: true,
    },
    cacheTime = ONE_HOUR
  ) {
    var start = env.DEBUG_LOG ? Date.now() : undefined;
    if (!schema || !model) {
      throw new Error("Missing schema or model");
    }
    const mongoKey = Object.keys(model)[0];
    const redisKey =
      env.MONGODB_DATABASE + ":" + schema.modelName + ":" + mongoKey + ":" + model[mongoKey];

    await schema.findOneAndUpdate(model, object, options);
    await redisClient.set(redisKey, JSON.stringify(object));
    await redisClient.expire(redisKey, cacheTime);

    if (env.DEBUG_LOG) debugMsg(`DB - update - Time taken: ${Date.now() - start!}ms`);
    debugMsg(`Updated key: ${mongoKey} -> ${redisKey}`);
  }

  /**
   *
   * @param {Schema} schema
   * @param {Map} model
   */
  async deleteOne(schema: any, model: any) {
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

  async findOneAndDelete(schema: any, model: any) {
    this.deleteOne(schema, model);
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

  getCacheKeys(Schema: any, keyQuery: string) {
    return `${env.MONGODB_DATABASE}:${Schema.name}:${keyQuery}`;
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
