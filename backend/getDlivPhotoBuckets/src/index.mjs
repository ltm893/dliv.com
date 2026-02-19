'use strict';
console.log('Loading getPhotoPrefixObjects function');
const bucket = process.env.BUCKET ; 


import {
  S3Client,
  // This command supersedes the ListObjectsCommand and is the recommended way to list objects.
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";


export const handler = async (event) => {
  let corsOrigin ; 
  const fromEnv = event.stageVariables.env ; 
  console.log("Stage :" + fromEnv) ; 
 
  console.log("request: " + JSON.stringify(event));
  console.log("Ready:\n");
  const prefixes = await getPhotoPrefixObjects() ; 
    // TODO implement
  const response = {
    statusCode: 200,
  
    body: JSON.stringify(prefixes),
  };
  return response;
}; 
  
async function getPhotoPrefixObjects() {
  console.log("looking in S3 bucket : " + bucket + "\n");
  const client = new S3Client({});
  const dlivPhotoBucket = bucket ;
  const command = new ListObjectsV2Command({
    Bucket: dlivPhotoBucket  ,
    Delimiter: '/' ,
    Prefix: 'images/',
    MaxKeys: 1,
  });

  try {
    let isTruncated = true;
    let contents = "" ;
    let albums = [] ; 

    while (isTruncated) {
      const { IsTruncated, NextContinuationToken, CommonPrefixes} =  await client.send(command);
      isTruncated = IsTruncated;
      command.input.ContinuationToken = NextContinuationToken;
      if(CommonPrefixes && CommonPrefixes.length == 1) {
        let prefixObj = CommonPrefixes[0] ;
        let prefix = prefixObj.Prefix ;
        let album = decodeURIComponent(prefix.replace('images/', ''));
         albums.push(album);
      }
    }
    return(albums) ;
  } catch (err) {
    console.error(err);
  }

}
