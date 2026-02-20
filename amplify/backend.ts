import { defineBackend } from "@aws-amplify/backend";
import { getDlivPhotos } from "./functions/getDlivPhotos/resource";
import { getDlivPhotoBuckets } from "./functions/getDlivPhotoBuckets/resource";
import {
  RestApi,
  LambdaIntegration,
  Cors,
} from "aws-cdk-lib/aws-apigateway";
import { Function } from "aws-cdk-lib/aws-lambda";

const backend = defineBackend({
  getDlivPhotos,
  getDlivPhotoBuckets,
});

// Get references to the deployed Lambda functions
const photosLambda = backend.getDlivPhotos.resources.lambda as Function;
const bucketsLambda = backend.getDlivPhotoBuckets.resources.lambda as Function;

// Set environment variables on each function
// const isProd = process.env.AMPLIFY_BRANCH === "main";
// const bucket = isProd ? "dliv.com-2" : "dliv.com-2-dev";
// const s3RegionUrl = "https://s3.amazonaws.com/";

// photosLambda.addEnvironment("BUCKET", bucket);
// photosLambda.addEnvironment("S3REGIONURL", s3RegionUrl);
// bucketsLambda.addEnvironment("BUCKET", bucket);

const bucket = process.env.BUCKET_NAME ?? "dliv.com-2-dev";
const s3RegionUrl = "https://s3.amazonaws.com/";

photosLambda.addEnvironment("BUCKET", bucket);
photosLambda.addEnvironment("S3REGIONURL", s3RegionUrl);
bucketsLambda.addEnvironment("BUCKET", bucket);

// Create API Gateway
const apiStack = backend.createStack("DlivApiStack");

const api = new RestApi(apiStack, "DlivApi", {
  restApiName: "DlivApi",
  defaultCorsPreflightOptions: {
    allowOrigins: Cors.ALL_ORIGINS,
    allowMethods: Cors.ALL_METHODS,
  },
});

// /albums endpoint
const albums = api.root.addResource("albums");
albums.addMethod("GET", new LambdaIntegration(bucketsLambda));

// /albums/{album} endpoint
const album = albums.addResource("{album}");
album.addMethod("GET", new LambdaIntegration(photosLambda));

// Export the API URL so frontend can use it
backend.addOutput({
  custom: {
    apiUrl: api.url,
  },
});