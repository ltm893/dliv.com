'use strict';
console.log('Loading getDlivPhotoBuckets function');
const bucket = process.env.BUCKET;

import {
  S3Client,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

export const handler = async (event) => {
  console.log("request: " + JSON.stringify(event));

  const prefixes = await getPhotoPrefixObjects();

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(prefixes),
  };
};

async function getPhotoPrefixObjects() {
  console.log("looking in S3 bucket : " + bucket + "\n");
  const client = new S3Client({});
  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Delimiter: '/',
    Prefix: 'images/',
    MaxKeys: 1,
  });

  try {
    let isTruncated = true;
    let albums = [];

    while (isTruncated) {
      const { IsTruncated, NextContinuationToken, CommonPrefixes } = await client.send(command);
      isTruncated = IsTruncated;
      command.input.ContinuationToken = NextContinuationToken;
      if (CommonPrefixes && CommonPrefixes.length === 1) {
        let album = decodeURIComponent(CommonPrefixes[0].Prefix.replace('images/', '').replace('/', ''));
        albums.push(album);
      }
    }
    return albums;
  } catch (err) {
    console.error(err);
  }
}