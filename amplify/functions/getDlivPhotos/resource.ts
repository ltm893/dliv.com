import { defineFunction } from "@aws-amplify/backend";

export const getDlivPhotos = defineFunction({
  name: "getDlivPhotos",
  entry: "./handler.mjs",
  timeoutSeconds: 30,
}); 