import fs from "node:fs/promises";
import path from "node:path";
import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { liquid } from "../instances/rest.js";
import * as settings from "../settings.js";

export const dispatch: APIGatewayProxyHandlerV2 = async (event, context) => {
  // static
  const httpReq = event.requestContext.http;
  if (httpReq.method === "GET" && httpReq.path.startsWith("/static/")) {
    const filename = httpReq.path.replace("/static/", "");
    const fp = path.resolve(settings.staticPath, filename);
    const text = await fs.readFile(fp, "utf-8");

    let contentType = "text/plain";
    if (filename.endsWith(".css")) {
      contentType = "text/css";
    } else if (filename.endsWith(".js")) {
      contentType = "text/javascript";
    }

    return {
      statusCode: 200,
      body: text,
      headers: { "Content-Type": contentType },
    };
  }

  // else..
  const websocketUrl = settings.WEBSOCKET_URL;
  const text = await liquid.renderFile("index", {
    websocketUrl,
  });
  return {
    statusCode: 200,
    body: text,
    headers: { "Content-Type": "text/html" },
  };
};
