import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { redis, wrapHandler_redis } from "./instances.js";

const main0: APIGatewayProxyHandlerV2 = async (event, context) => {
  await redis.connect();

  const redis_info = await redis.info();
  const data = {
    event,
    redis_info,
  };

  await redis.disconnect();

  return {
    body: JSON.stringify(data, null, 2),
    statusCode: 200,
  };
};

export const main = wrapHandler_redis(main0);
