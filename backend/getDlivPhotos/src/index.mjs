'use strict';
console.log('Loading getPhotoPrefixObjects function');
const bucket = process.env.BUCKET ; 
const s3RegionUrl = process.env.S3REGIONURL ; 

// https://s3.amazonaws.com/dliv.com/camping2006/_Picture100.jpg
// https://s3.amazonaws.com


import {
  S3Client,
  // This command supersedes the ListObjectsCommand and is the recommended way to list objects.
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";


export const handler = async (event) => {
 
  const album = 'images/' + event.pathParameters.album + '/' ; 
  console.log("album :" + album) ; 
 
  console.log("request: " + JSON.stringify(event));
  console.log("Ready:\n");
  const picsPath = await getPhotosFromAlbum(album) ; 
 // let albums = ["one","two"] ; 
    // TODO implement
  
  const response = {
    statusCode: 200,
  
    body: JSON.stringify(picsPath),
  };
  
  return (response) ; 
}

async function getPhotosFromAlbum(album) {
  let photos ; 
  console.log("looking in S3 bucket : " + s3RegionUrl +  bucket + "\n");
  const client = new S3Client({});
  const command = new ListObjectsV2Command({
    Bucket: bucket  ,
    Delimiter: '/' ,
    Prefix: album
  });

  try {
    let isTruncated = true;
    let contents = "" ;
    let photos = [] ; 

    while (isTruncated) {
      const { IsTruncated, NextContinuationToken, CommonPrefixes, Contents } =  await client.send(command);
      // const result =  await client.send(command);
      // console.log(result) ;
      isTruncated = IsTruncated;
      command.input.ContinuationToken = NextContinuationToken;
      photos = Contents.map(function (photo) {
        var photoKey = photo.Key;
        var photoUrl = s3RegionUrl + bucket + '/' +  photoKey;
        return photoUrl;
      });
      photos.shift();
      console.log(photos)
    }
    return(photos) ;
  } catch (err) {
    console.error(err);
  }

}
