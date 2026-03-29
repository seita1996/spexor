import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import type { SharedRunEvent } from "@spexor/results";
import { createResultsHubHandler, type SharedResultsStore } from "./index";

interface AwsLambdaEvent {
  rawPath: string;
  rawQueryString?: string | undefined;
  headers?: Record<string, string | undefined> | undefined;
  body?: string | undefined;
  isBase64Encoded?: boolean | undefined;
  requestContext?:
    | {
        domainName?: string | undefined;
        http?:
          | {
              method?: string | undefined;
            }
          | undefined;
      }
    | undefined;
}

interface AwsLambdaResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export interface AwsLambdaHandlerOptions {
  bucketName: string;
  prefix?: string | undefined;
  s3Client?: S3Client | undefined;
}

export function createAwsLambdaHandler(options: AwsLambdaHandlerOptions) {
  const store = new S3SharedResultsStore({
    bucketName: options.bucketName,
    prefix: options.prefix,
    s3Client: options.s3Client
  });
  const handler = createResultsHubHandler(store);

  return async function awsLambdaHandler(
    event: AwsLambdaEvent
  ): Promise<AwsLambdaResult> {
    const method = event.requestContext?.http?.method ?? "GET";
    const host = event.requestContext?.domainName ?? "localhost";
    const query = event.rawQueryString ? `?${event.rawQueryString}` : "";
    const url = `https://${host}${event.rawPath}${query}`;
    const headers = sanitizeHeaders(event.headers);
    const body =
      event.body && method !== "GET" && method !== "HEAD"
        ? event.isBase64Encoded
          ? Buffer.from(event.body, "base64")
          : event.body
        : undefined;
    const requestInit = body
      ? {
          method,
          headers,
          body
        }
      : {
          method,
          headers
        };

    const response = await handler(new Request(url, requestInit));

    return {
      statusCode: response.status,
      headers: Object.fromEntries(response.headers.entries()),
      body: await response.text()
    };
  };
}

class S3SharedResultsStore implements SharedResultsStore {
  private readonly s3Client: S3Client;
  private readonly bucketName: string;
  private readonly prefix: string;

  constructor(options: AwsLambdaHandlerOptions) {
    this.s3Client = options.s3Client ?? new S3Client({});
    this.bucketName = options.bucketName;
    this.prefix = options.prefix ?? "shared-results";
  }

  async ingest(projectId: string, events: SharedRunEvent[]): Promise<number> {
    await Promise.all(
      events.map((event) =>
        this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucketName,
            Key: this.eventKey(projectId, event.scenarioKey, event.eventId),
            Body: JSON.stringify(event),
            ContentType: "application/json; charset=utf-8"
          })
        )
      )
    );

    return events.length;
  }

  async getScenarioResults(
    projectId: string,
    scenarioKey: string
  ): Promise<SharedRunEvent[]> {
    const list = await this.s3Client.send(
      new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: this.scenarioPrefix(projectId, scenarioKey)
      })
    );

    const keys = (list.Contents ?? [])
      .map((item) => item.Key)
      .filter((key): key is string => Boolean(key));

    const events = await Promise.all(
      keys.map(async (key) => {
        const response = await this.s3Client.send(
          new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key
          })
        );
        const bodyText = await response.Body?.transformToString();
        if (!bodyText) {
          throw new Error(`Shared result object is empty: ${key}`);
        }
        return JSON.parse(bodyText) as SharedRunEvent;
      })
    );

    return events.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt)
    );
  }

  private scenarioPrefix(projectId: string, scenarioKey: string): string {
    return `${this.prefix}/events/${encodeURIComponent(projectId)}/${encodeURIComponent(scenarioKey)}/`;
  }

  private eventKey(
    projectId: string,
    scenarioKey: string,
    eventId: string
  ): string {
    return `${this.scenarioPrefix(projectId, scenarioKey)}${eventId}.json`;
  }
}

function sanitizeHeaders(
  headers: Record<string, string | undefined> | undefined
): Record<string, string> {
  if (!headers) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(headers).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );
}
