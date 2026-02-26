import { defineFunction } from "@aws-amplify/backend";

export const getPrivateFiles = defineFunction({
  name: "getPrivateFiles",
  entry: "./handler.mjs",
  timeoutSeconds: 30,
});