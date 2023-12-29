import { SQSHandler } from "aws-lambda";
import { redis } from "../instances/redis.js";

export const dispatch: SQSHandler = async (event, context) => {
  console.log("sqs.event", JSON.stringify(event, null, 2));
};
