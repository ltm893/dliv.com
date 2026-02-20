'use strict';
console.log('Loading getDlivPhotos function');
const bucket = process.env.BUCKET;
const s3RegionUrl = process.env.S3REGIONURL;

import {
  S3Client,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

export const handler = async (event) => {
  const album = 'images/' + event.pathParameters.album + '/';
  console.log("album :" + album);
  console.log("request: " + JSON.stringify(event));

  const picsPath = await getPhotosFromAlbum(album);

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(picsPath),
  };
};

async function getPhotosFromAlbum(album) {
  console.log("looking in S3 bucket : " + s3RegionUrl + bucket + "\n");
  const client = new S3Client({});
  const command = new ListObjectsV2Command({
    Bucket: bucket,
    Delimiter: '/',
    Prefix: album
  });

  try {
    let isTruncated = true;
    let photos = [];

    while (isTruncated) {
      const { IsTruncated, NextContinuationToken, Contents } = await client.send(command);
      isTruncated = IsTruncated;
      command.input.ContinuationToken = NextContinuationToken;
      photos = Contents.map((photo) => {
        return s3RegionUrl + bucket + '/' + photo.Key;
      });
      photos.shift();
    }
    return photos;
  } catch (err) {
    console.error(err);
  }
}