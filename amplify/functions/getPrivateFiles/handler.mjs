'use strict';
console.log('Loading getPrivateFiles function');

const PRIVATE_BUCKET = process.env.PRIVATE_BUCKET;

import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const client = new S3Client({});

export const handler = async (event) => {
  console.log("request: " + JSON.stringify(event));
  const pathParams = event.pathParameters;
  const method = event.httpMethod;

  try {
    // POST /files  →  generate a presigned PUT URL for uploading
    if (method === "POST" && (!pathParams || !pathParams.key)) {
      const body = JSON.parse(event.body ?? "{}");
      const { key, contentType } = body;
      if (!key) return respond(400, { error: "key is required" });
      const url = await getPresignedUploadUrl(key, contentType);
      return respond(200, { url });
    }

    // GET /files  →  list files and folders
    if (!pathParams || !pathParams.key) {
      const prefix = event.queryStringParameters?.prefix ?? "";
      const files = await listFiles(prefix);
      return respond(200, files);
    }

    // GET /files/{key+}  →  presigned download URL
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
    Delimiter: "/",
  });

  let folders = [];
  let files = [];
  let isTruncated = true;

  while (isTruncated) {
    const { IsTruncated, NextContinuationToken, Contents, CommonPrefixes } = await client.send(command);
    isTruncated = IsTruncated ?? false;
    command.input.ContinuationToken = NextContinuationToken;

    // CommonPrefixes are the subfolders
    if (CommonPrefixes) {
      folders = folders.concat(CommonPrefixes.map((p) => ({
        key: p.Prefix,
        type: "folder",
      })));
    }
    // Contents are the actual files (skip the folder placeholder itself)
    if (Contents) {
      files = files.concat(
        Contents
          .filter((obj) => obj.Key !== prefix)
          .map((obj) => ({
            key: obj.Key,
            size: obj.Size,
            lastModified: obj.LastModified,
            type: "file",
          }))
      );
    }
  }
  return { folders, files };
}

async function getPresignedUrl(key) {
  const command = new GetObjectCommand({
    Bucket: PRIVATE_BUCKET,
    Key: key,
  });
  return getSignedUrl(client, command, { expiresIn: 900 });
}

async function getPresignedUploadUrl(key, contentType) {
  const command = new PutObjectCommand({
    Bucket: PRIVATE_BUCKET,
    Key: key,
    ContentType: contentType ?? "application/octet-stream",
  });
  // Upload URL valid for 15 minutes
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