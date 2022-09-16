import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { redis } from "./instances.js";

await redis.connect();

export const main: APIGatewayProxyHandlerV2 = async (event, context) => {
  const redis_info = await redis.info();
  const data = {
    event,
    redis_info,
  };
  return {
    body: JSON.stringify(data, null, 2),
    statusCode: 200,
  };
};
