import { APIGatewayProxyHandler } from "aws-lambda";

export interface WebSocketHandler {
  connect: APIGatewayProxyHandler;
  disconnect: APIGatewayProxyHandler;
  dispatch: APIGatewayProxyHandler;
}
