import * as pulumi from "@pulumi/pulumi";
import { CustomResourceOptions } from "@pulumi/pulumi";
import { ApiArgs } from "@pulumi/aws/apigatewayv2/api";
import * as classic from "@pulumi/aws";
import { RouteArgs } from "@pulumi/aws/apigatewayv2/route";
import { StageArgs } from "@pulumi/aws/apigatewayv2";
import * as native from "@pulumi/aws-native";
import { NodejsFunction, NodejsFunctionArgs } from "@exanubes/pulumi-nodejs-function";
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
export class WebsocketApi extends pulumi.ComponentResource {
    public readonly resource: classic.apigatewayv2.Api;
    public readonly id: pulumi.Output<string>;
    public readonly arn: pulumi.Output<string>;
    public readonly executionArn: pulumi.Output<string>;
    public authorizerLambda?: NodejsFunction;
    constructor(
        private readonly name: string,
        props: WebsocketApiArgs,
        private options?: CustomResourceOptions,
    ) {
        super("exanubes:aws:WebsocketApi", name, props, options);
        const api = new classic.apigatewayv2.Api(
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
            integration: classic.apigatewayv2.Integration | string;
        },
    ) {
        const integrationId =
            typeof props.integration === "string"
                ? props.integration
                : props.integration.id;
        return new classic.apigatewayv2.Route(
            `${this.name}_${path}_Route`,
            {
                ...props,
                apiId: this.id,
                routeKey: path,
                target: pulumi.interpolate`integrations/${integrationId}`,
            },
            { parent: this.resource },
        );
    }

    public addStage(name: string, props: Omit<StageArgs, "name" | "apiId">) {
        return new classic.apigatewayv2.Stage(
            `${this.name}-api-${name}-stage`,
            {
                ...props,
                apiId: this.id,
                name,
                autoDeploy: true,
            },
            { parent: this.resource },
        );
    }

    public addAuthorizer(
        name: string,
        {
            authorizer,
            authorizerUri,
            ...props
        }: Omit<
            native.apigatewayv2.AuthorizerArgs,
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
                `${name}_AUTHORIZER_LAMBDA`,
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

    private createAuthorizer(
        name: string,
        props: Omit<
            native.apigatewayv2.AuthorizerArgs,
            "name" | "apiId" | "authorizerType"
        >,
    ) {
        return new native.apigatewayv2.Authorizer(
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
}
