# Pulumi Websocket API

The `WebsocketApi` is a very simple component that streamlines the creation of a Websocket API in Pulumi by providing several helper methods
to reduce the required boilerplate code.

The instance includes the following helper methods:

- `addRoute` - for adding routes to the api
- `addStage` - for adding stages to the api
- `addAuthorizer` - for creating a Lambda Request Authorizer
- `getInvokePolicy` - for creating a Policy Document that will allow invoking the execute-api and manage connections