// AWS Lambda
import { LambdaFunctionURLHandler } from 'aws-lambda';

// AWS SDK - SageMaker
import {
  CreateEndpointCommand,
  DeleteEndpointCommand,
  DescribeEndpointCommand,
  SageMakerClient,
} from '@aws-sdk/client-sagemaker';

// AWS SDK - SageMaker Runtime
import {
  InvokeEndpointCommand,
  SageMakerRuntimeClient,
} from '@aws-sdk/client-sagemaker-runtime';

// Environment Variables
const [endpointName, endpointConfigName] = [
  process.env.ENDPOINT_NAME,
  process.env.ENDPOINT_CONFIG_NAME,
];

// AWS SDK - SageMaker - Client
const sagemaker = new SageMakerClient({
  apiVersion: '2017-07-24',
});

// AWS SDK - SageMaker Runtime - Client
const sagemakerRuntime = new SageMakerRuntimeClient({
  apiVersion: '2017-05-13',
});

// Lambda Handler
export const handler: LambdaFunctionURLHandler = async ({ queryStringParameters, requestContext }) => {
  try {
    if (requestContext.http.path === '/') {
      switch (requestContext.http.method) {
        case 'GET':
          const { EndpointStatus: status } = await sagemaker.send(new DescribeEndpointCommand({
            EndpointName: endpointName,
          }));

          return {
            statusCode: 200,
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              status,
            }),
          };
        case 'POST':
          await sagemaker.send(new CreateEndpointCommand({
            EndpointName: endpointName,
            EndpointConfigName: endpointConfigName,
          }));

          return {
            statusCode: 200,
          };
        case 'DELETE':
          await sagemaker.send(new DeleteEndpointCommand({
            EndpointName: endpointName,
          }));

          return {
            statusCode: 200,
          };
      }
    }

    if (requestContext.http.path === '/voice') {
      switch (requestContext.http.method) {
        case 'GET':
          const { Body: body } = await sagemakerRuntime.send(new InvokeEndpointCommand({
            EndpointName: endpointName,
            Body: JSON.stringify(queryStringParameters),
            ContentType: 'application/json',
            Accept: 'audio/wav',
          }));

          return {
            statusCode: 200,
            headers: {
              'content-type': 'audio/wav',
            },
            body: body.transformToString('base64'),
            isBase64Encoded: true,
          };
      }
    }

    return {
      statusCode: 404,
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(e),
    };
  }
};
