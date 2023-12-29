import { SQSClient } from "@aws-sdk/client-sqs";
import * as settings from "../settings.js";

const sqsEndpoint_elasticmq = "http://127.0.0.1:9324";
const sqsEndpoint_karin_remote = "https://karin.fly.dev/api/queue";

export const sqsEndpoint =
  settings.NODE_ENV === "production"
    ? sqsEndpoint_karin_remote
    : sqsEndpoint_elasticmq;

export const createSqsClient = (endpoint: string | undefined) => {
  return new SQSClient({
    endpoint,
    region: settings.AWS_REGION,
    credentials: settings.AWS_CREDENTIALS,
  });
};

export const sqsClient = createSqsClient(sqsEndpoint);

export const createQueueUrl_dev = (endpoint: string, queue: string) => {
  return `${endpoint}/queue/${queue}`;
};

export const createQueueUrl_aws = (queue: string) => {
  const endpoint = `https://sqs.${settings.AWS_REGION}.amazonaws.com`;
  return `${endpoint}/${settings.AWS_ACCOUNT_ID}/${queue}`;
};

// 비용 문제로 AWS SQS 자체를 사용하진 않을거다.
export const createQueueUrl = createQueueUrl_dev;
