import { defineBackend } from "@aws-amplify/backend";
import { defineAuth } from "@aws-amplify/backend-auth";
import { getDlivPhotos } from "./functions/getDlivPhotos/resource";
import { getDlivPhotoBuckets } from "./functions/getDlivPhotoBuckets/resource";
import { getPrivateFiles } from "./functions/getPrivateFiles/resource";
import {
  RestApi,
  LambdaIntegration,
  Cors,
  CognitoUserPoolsAuthorizer,
  AuthorizationType,
} from "aws-cdk-lib/aws-apigateway";
import { Function } from "aws-cdk-lib/aws-lambda";
import { PolicyStatement, Effect } from "aws-cdk-lib/aws-iam";

// ─── Auth (invite-only: no self-signup) ─────────────────────────────────────
import { auth } from "./auth/resource";



const backend = defineBackend({
  auth,
  getDlivPhotos,
  getDlivPhotoBuckets,
  getPrivateFiles,
});

// ─── Existing public Lambda env vars ─────────────────────────────────────────
const photosLambda = backend.getDlivPhotos.resources.lambda as Function;
const bucketsLambda = backend.getDlivPhotoBuckets.resources.lambda as Function;
const privateFilesLambda = backend.getPrivateFiles.resources.lambda as Function;

const bucket = "dliv.com-2";
const s3RegionUrl = "https://s3.amazonaws.com/";

photosLambda.addEnvironment("BUCKET", bucket);
photosLambda.addEnvironment("S3REGIONURL", s3RegionUrl);
bucketsLambda.addEnvironment("BUCKET", bucket);

// ─── Private bucket env var — replace with your actual private bucket name ───
const PRIVATE_BUCKET_NAME = "dliv-private-files"; // <-- change this
privateFilesLambda.addEnvironment("PRIVATE_BUCKET", PRIVATE_BUCKET_NAME);

// Grant the Lambda read access to the private bucket
privateFilesLambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ["s3:GetObject", "s3:ListBucket"],
    resources: [
      `arn:aws:s3:::${PRIVATE_BUCKET_NAME}`,
      `arn:aws:s3:::${PRIVATE_BUCKET_NAME}/*`,
    ],
  })
);

// ─── API Gateway ──────────────────────────────────────────────────────────────
const apiStack = backend.createStack("DlivApiStack");

const api = new RestApi(apiStack, "DlivApi", {
  restApiName: "DlivApi",
  defaultCorsPreflightOptions: {
    allowOrigins: Cors.ALL_ORIGINS,
    allowMethods: Cors.ALL_METHODS,
    allowHeaders: ["Authorization", "Content-Type"],
  },
});

// Cognito authorizer — attached only to private routes
const cognitoAuthorizer = new CognitoUserPoolsAuthorizer(
  apiStack,
  "DlivCognitoAuthorizer",
  {
    cognitoUserPools: [backend.auth.resources.userPool],
  }
);

// Public routes (unchanged)
const albums = api.root.addResource("albums");
albums.addMethod("GET", new LambdaIntegration(bucketsLambda));
const album = albums.addResource("{album}");
album.addMethod("GET", new LambdaIntegration(photosLambda));

// Private routes (require valid Cognito JWT)
const filesResource = api.root.addResource("files");
filesResource.addMethod("GET", new LambdaIntegration(privateFilesLambda), {
  authorizer: cognitoAuthorizer,
  authorizationType: AuthorizationType.COGNITO,
});

const fileKey = filesResource.addResource("{key+}");
fileKey.addMethod("GET", new LambdaIntegration(privateFilesLambda), {
  authorizer: cognitoAuthorizer,
  authorizationType: AuthorizationType.COGNITO,
});

// ─── Outputs ─────────────────────────────────────────────────────────────────
backend.addOutput({
  custom: {
    apiUrl: api.url,
  },
});
