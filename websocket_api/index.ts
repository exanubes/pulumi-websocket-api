import * as pulumi from "@pulumi/pulumi";
import { CustomResourceOptions } from "@pulumi/pulumi";
import { ApiArgs } from "@pulumi/aws/apigatewayv2/api";
import * as aws_classic from "@pulumi/aws";
import { RouteArgs } from "@pulumi/aws/apigatewayv2/route";
import { StageArgs } from "@pulumi/aws/apigatewayv2";
import * as aws_native from "@pulumi/aws-native";
import {
  NodejsFunction,
  NodejsFunctionArgs,
} from "@exanubes/pulumi-nodejs-function";
export type WebsocketApiArgs = Omit<
  ApiArgs,
  | "protocolType"
  | "body"
  | "corsConfiguration"
  | "credentialsArn"
  | "failOnWarnings"
  | "routeKey"
  | "target"
> & {};

export type LambdaIntegrationArgs = Omit<
  aws_classic.apigatewayv2.IntegrationArgs,
  | "integrationType"
  | "apiId"
  | "connectionId"
  | "integrationMethod"
  | "integrationSubtype"
  | "payloadFormatVersion"
  | "tlsConfig"
  | "integrationUri"
>;

export class WebsocketApi extends pulumi.ComponentResource {
  public readonly resource: aws_classic.apigatewayv2.Api;
  public readonly id: pulumi.Output<string>;
  public readonly arn: pulumi.Output<string>;
  public readonly executionArn: pulumi.Output<string>;
  public authorizerLambda?: NodejsFunction;
  constructor(
    private readonly name: string,
    props: WebsocketApiArgs,
    options?: CustomResourceOptions,
  ) {
    super("exanubes:aws:WebsocketApi", name, props, options);
    const api = new aws_classic.apigatewayv2.Api(
      name,
      {
        ...props,
        protocolType: "WEBSOCKET",
      },
      { parent: this },
    );
    this.id = api.id;
    this.arn = api.arn;
    this.executionArn = api.executionArn;
    this.resource = api;
  }

  public addRoute(
    path: string,
    props: Omit<RouteArgs, "apiId" | "routeKey" | "target"> & {
      integration: aws_classic.apigatewayv2.Integration | string;
    },
  ) {
    const integrationId =
      typeof props.integration === "string"
        ? props.integration
        : props.integration.id;
    return new aws_classic.apigatewayv2.Route(
      `${this.name}_${path}_Route`,
      {
        ...props,
        apiId: this.id,
        routeKey: path,
        target: pulumi.interpolate`integrations/${integrationId}`,
      },
      { parent: this },
    );
  }

  public addStage(name: string, props: Omit<StageArgs, "name" | "apiId">) {
    return new aws_classic.apigatewayv2.Stage(
      `${this.name}-api-${name}-stage`,
      {
        ...props,
        apiId: this.id,
        name,
        autoDeploy: true,
      },
      { parent: this },
    );
  }

  public addAuthorizer(
    name: string,
    {
      authorizer,
      authorizerUri,
      ...props
    }: Omit<
      aws_native.apigatewayv2.AuthorizerArgs,
      "name" | "apiId" | "authorizerType" | "authorizerUri"
    > &
      (
        | {
            authorizerUri: pulumi.Input<string>;
            authorizer?: void;
          }
        | {
            authorizerUri?: void;
            authorizer: NodejsFunctionArgs;
          }
      ),
  ) {
    if (this.authorizerLambda) {
      throw new Error(
        `Authorizer already exists: ${this.authorizerLambda.handler.name}`,
      );
    }
    if (authorizerUri) {
      return this.createAuthorizer(name, {
        ...props,
        authorizerUri,
      });
    }

    if (authorizer) {
      const authorizerLambda = (this.authorizerLambda = new NodejsFunction(
        `${name}_Authorizer_Lambda`,
        authorizer,
        {
          parent: this,
        },
      ));
      authorizerLambda.grantInvoke("apigateway.amazonaws.com", this.arn);
      return this.createAuthorizer(name, {
        ...props,
        authorizerUri: authorizerLambda.handler.invokeArn,
      });
    }

    throw new Error("Either authorizer or authorizerUri must be provided");
  }

  public addLambdaIntegration(
    name: string,
    lambdaInvokeArn: pulumi.Output<string>,
    options?: LambdaIntegrationArgs,
  ): aws_classic.apigatewayv2.Integration;
  public addLambdaIntegration(
    name: string,
    nodejsFunction: NodejsFunction,
    options?: LambdaIntegrationArgs,
  ): aws_classic.apigatewayv2.Integration;
  public addLambdaIntegration(
    name: string,
    lambda: NodejsFunction | pulumi.Output<string>,
    options?: LambdaIntegrationArgs,
  ) {
    const integrationUri = pulumi.Output.isInstance(lambda)
      ? lambda
      : lambda.handler.invokeArn;
    return new aws_classic.apigatewayv2.Integration(
      `${this.name}_${name}_Integration`,
      {
        apiId: this.id,
        integrationType: "AWS_PROXY",
        integrationUri,
        ...options,
      },
      { parent: this },
    );
  }

  private createAuthorizer(
    name: string,
    props: Omit<
      aws_native.apigatewayv2.AuthorizerArgs,
      "name" | "apiId" | "authorizerType"
    >,
  ) {
    return new aws_native.apigatewayv2.Authorizer(
      `${this.name}_${name}_AUTHORIZER`,
      {
        ...props,
        apiId: this.id,
        name,
        authorizerType: "REQUEST",
      },
      { parent: this },
    );
  }

  getInvokePolicy(
    stageName:  pulumi.Input<string>,
  ): aws_classic.iam.PolicyArgs["policy"] {
    return {
      Version: "2012-10-17",
      Statement: [
        {
          Action: ["execute-api:ManageConnections", "execute-api:Invoke"],
          Effect: "Allow",
          Resource: [
            `${this.resource.executionArn}/${stageName}/POST/@connections/*`,
          ],
        },
      ],
    };
  }
}
