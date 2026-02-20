import { defineFunction } from "@aws-amplify/backend";

export const getDlivPhotoBuckets = defineFunction({
  name: "getDlivPhotoBuckets",
  entry: "./handler.mjs",
  timeoutSeconds: 30,
});