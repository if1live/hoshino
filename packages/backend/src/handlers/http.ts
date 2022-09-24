import type { APIGatewayProxyHandlerV2 } from "aws-lambda";

const main0: APIGatewayProxyHandlerV2 = async (event, context) => {
  return {
    body: JSON.stringify(event, null, 2),
    statusCode: 200,
  };
};

export const main = main0;
