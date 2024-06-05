exports.handler = () => ({
  statusCode: 200,
  body: JSON.stringify({
    message: "Hello from Lambda!",
  }),
});
