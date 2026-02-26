'use strict';
console.log('Loading getPrivateFiles function');

const PRIVATE_BUCKET = process.env.PRIVATE_BUCKET;

import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const client = new S3Client({});

export const handler = async (event) => {
  console.log("request: " + JSON.stringify(event));
  const pathParams = event.pathParameters;

  try {
    if (!pathParams || !pathParams.key) {
      const prefix = event.queryStringParameters?.prefix ?? "";
      const files = await listFiles(prefix);
      return respond(200, files);
    }

    const key = decodeURIComponent(pathParams.key);
    const url = await getPresignedUrl(key);
    return respond(200, { url });

  } catch (err) {
    console.error(err);
    return respond(500, { error: err.message });
  }
};

async function listFiles(prefix) {
  const command = new ListObjectsV2Command({
    Bucket: PRIVATE_BUCKET,
    Prefix: prefix,
  });

  let files = [];
  let isTruncated = true;

  while (isTruncated) {
    const { IsTruncated, NextContinuationToken, Contents } = await client.send(command);
    isTruncated = IsTruncated ?? false;
    command.input.ContinuationToken = NextContinuationToken;
    if (Contents) {
      files = files.concat(Contents.map((obj) => ({
        key: obj.Key,
        size: obj.Size,
        lastModified: obj.LastModified,
      })));
    }
  }
  return files;
}

async function getPresignedUrl(key) {
  const command = new GetObjectCommand({
    Bucket: PRIVATE_BUCKET,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn: 900 });
}

function respond(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization,Content-Type",
    },
    body: JSON.stringify(body),
  };
}