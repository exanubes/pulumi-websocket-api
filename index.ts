import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import { WebsocketApi } from "@exanubes/pulumi-websocket-api";
import { NodejsFunction } from "@exanubes/pulumi-nodejs-function";

// Create an AWS resource (S3 Bucket)
const bucket = new aws.s3.Bucket("my-bucket");

// Export the name of the bucket
export const bucketName = bucket.id;

const api = new WebsocketApi("my-websocket-api", {});

const fn = new NodejsFunction("hello_world", {
  code: new pulumi.asset.FileArchive("./lambda"),
  handler: "index.handler",
});
const stage = api.addStage("dev");

const policy = api.getInvokePolicy(stage.name);

fn.addPolicy("api-invoke-policy", {
  policy: policy,
});
