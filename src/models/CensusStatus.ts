import { InferSchemaType, Schema, model } from "mongoose";
import FetchEnvs from "../utils/FetchEnvs";
const env = FetchEnvs();

const CensusStatusSchema = new Schema({
  id: {
    type: String,
    required: true,
  },
  lastChange: {
    type: Number,
    required: true,
  },
  isOffline: {
    type: Boolean,
    required: true,
  },
});

export default model("CensusStatus", CensusStatusSchema);

export type CensusStatusType = InferSchemaType<typeof CensusStatusSchema>;
