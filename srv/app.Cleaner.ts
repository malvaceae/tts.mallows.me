// AWS Lambda
import { EventBridgeHandler } from 'aws-lambda';

// AWS SDK - CloudWatch Logs
import {
  CloudWatchLogsClient,
  DescribeLogStreamsCommand,
  GetLogEventsCommand,
} from '@aws-sdk/client-cloudwatch-logs';

// AWS SDK - SageMaker
import {
  DeleteEndpointCommand,
  SageMakerClient,
} from '@aws-sdk/client-sagemaker';

// Endpoint Name
const endpointName = process.env.ENDPOINT_NAME;

// AWS SDK - CloudWatch Logs - Client
const logs = new CloudWatchLogsClient({
  apiVersion: '2014-03-28',
});

// AWS SDK - SageMaker - Client
const sagemaker = new SageMakerClient({
  apiVersion: '2017-07-24',
});

// Lambda Handler
export const handler: EventBridgeHandler<string, unknown, void> = async () => {
  try {
    const { logStreams } = await logs.send(new DescribeLogStreamsCommand({
      logGroupName: `/aws/sagemaker/Endpoints/${endpointName}`,
      orderBy: 'LastEventTime',
      descending: true,
      limit: 1,
    }));

    if (!logStreams) {
      return;
    }

    if (!logStreams[0]) {
      return;
    }

    const { events } = await logs.send(new GetLogEventsCommand({
      logGroupName: `/aws/sagemaker/Endpoints/${endpointName}`,
      logStreamName: logStreams[0].logStreamName,
      startTime: Date.now() - 30 * 60 * 1000,
      limit: 1,
    }));

    if (!events) {
      return;
    }

    if (!events[0]) {
      await sagemaker.send(new DeleteEndpointCommand({
        EndpointName: endpointName,
      }));
    }
  } catch {
    //
  }
};
