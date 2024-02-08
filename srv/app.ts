// AWS CDK
import {
  App,
  CfnOutput,
  Duration,
  Stack,
  StackProps,
  aws_certificatemanager as acm,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as origins,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_lambda_nodejs as nodejs,
  aws_route53 as route53,
  aws_route53_targets as targets,
  aws_s3 as s3,
  aws_sagemaker as sagemaker,
} from 'aws-cdk-lib';

// Constructs
import { Construct } from 'constructs';

/**
 * Mallows TTS Stack Construct
 */
class MallowsTtsStack extends Stack {
  /**
   * Creates a new stack.
   *
   * @param scope Parent of this stack, usually an `App` or a `Stage`, but could be any construct.
   * @param id The construct ID of this stack. If `stackName` is not explicitly
   * defined, this id (and any parent IDs) will be used to determine the
   * physical ID of the stack.
   * @param props Stack properties.
   */
  constructor(scope?: Construct, id?: string, props?: StackProps) {
    super(scope, id, props);

    // Context Values
    const [executionRoleArn, image, modelDataUrl, endpointName, domainName, certificateArn, githubRepo] = [
      this.node.getContext('executionRoleArn'),
      this.node.getContext('image'),
      this.node.getContext('modelDataUrl'),
      this.node.getContext('endpointName'),
      this.node.getContext('domainName'),
      this.node.getContext('certificateArn'),
      this.node.tryGetContext('githubRepo'),
    ];

    // Model
    const model = new sagemaker.CfnModel(this, 'Model', {
      executionRoleArn,
      primaryContainer: {
        image,
        modelDataUrl,
      },
    });

    // Endpoint Config
    const endpointConfig = new sagemaker.CfnEndpointConfig(this, 'EndpointConfig', {
      productionVariants: [
        {
          initialInstanceCount: 1,
          instanceType: 'ml.g4dn.xlarge',
          modelName: model.attrModelName,
          variantName: 'AllTraffic',
        },
      ],
    });

    // Endpoint ARN
    const endpointArn = `arn:aws:sagemaker:${this.region}:${this.account}:endpoint/${endpointName.toLowerCase()}`;

    // Api
    const api = new nodejs.NodejsFunction(this, 'Api', {
      architecture: lambda.Architecture.ARM_64,
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: Duration.minutes(15),
      memorySize: 1769, // 1 vCPU
      environment: {
        ENDPOINT_NAME: endpointName,
        ENDPOINT_CONFIG_NAME: endpointConfig.attrEndpointConfigName,
        TZ: 'Asia/Tokyo',
      },
      initialPolicy: [
        new iam.PolicyStatement({
          actions: [
            'sagemaker:CreateEndpoint',
          ],
          resources: [
            endpointArn,
            endpointConfig.ref,
          ],
        }),
        new iam.PolicyStatement({
          actions: [
            'sagemaker:DeleteEndpoint',
            'sagemaker:DescribeEndpoint',
            'sagemaker:InvokeEndpoint',
          ],
          resources: [
            endpointArn,
          ],
        }),
      ],
      bundling: {
        minify: true,
      },
    });

    // Add function url to Api.
    const { url: apiEndpoint } = api.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      cors: {
        allowedHeaders: [
          '*',
        ],
        allowedOrigins: [
          '*',
        ],
      },
    });

    // Api Endpoint
    new CfnOutput(this, 'ApiEndpoint', {
      value: apiEndpoint,
    });

    // App Bucket
    const appBucket = new s3.Bucket(this, 'AppBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // App Bucket Name
    new CfnOutput(this, 'AppBucketName', {
      value: appBucket.bucketName,
    });

    // Certificate
    const certificate = acm.Certificate.fromCertificateArn(this, 'Certificate', certificateArn);

    // App Distribution
    const appDistribution = new cloudfront.Distribution(this, 'AppDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(appBucket, {
          originPath: '/',
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      certificate,
      defaultRootObject: 'index.html',
      domainNames: [
        `tts.${domainName}`,
      ],
      errorResponses: [
        {
          ttl: Duration.days(1),
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/',
        },
        {
          ttl: Duration.days(1),
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/',
        },
      ],
    });

    // App Distribution ID
    new CfnOutput(this, 'AppDistributionId', {
      value: appDistribution.distributionId,
    });

    // Origin Access Control
    const originAccessControl = new cloudfront.CfnOriginAccessControl(this, 'OriginAccessControl', {
      originAccessControlConfig: {
        name: 'OriginAccessControlForMallowsTts',
        originAccessControlOriginType: 's3',
        signingBehavior: 'always',
        signingProtocol: 'sigv4',
      },
    });

    // App Distribution L1 Construct
    const cfnAppDistribution = appDistribution.node.defaultChild as cloudfront.CfnDistribution;

    // Add a origin access control id.
    cfnAppDistribution.addPropertyOverride('DistributionConfig.Origins.0.OriginAccessControlId', originAccessControl.attrId);

    // Delete a origin access identity in s3 origin config.
    cfnAppDistribution.addPropertyOverride('DistributionConfig.Origins.0.S3OriginConfig.OriginAccessIdentity', '');

    // Delete a cloud front origin access identity.
    appDistribution.node.tryRemoveChild('Origin1');

    // Delete the default app bucket policy.
    appBucket.node.tryRemoveChild('Policy');

    // App Bucket Policy
    appBucket.policy = new s3.BucketPolicy(appBucket, 'Policy', {
      bucket: appBucket,
    });

    // Add the permission to access CloudFront.
    appBucket.policy.document.addStatements(new iam.PolicyStatement({
      actions: [
        's3:GetObject',
      ],
      principals: [
        new iam.ServicePrincipal('cloudfront.amazonaws.com'),
      ],
      resources: [
        appBucket.arnForObjects('*'),
      ],
      conditions: {
        'StringEquals': {
          'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${appDistribution.distributionId}`,
        },
      },
    }));

    // Hosted Zone
    const zone = route53.HostedZone.fromLookup(this, 'HostedZone', {
      domainName,
    });

    // App Distribution Alias Record Target
    const target = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(appDistribution));

    // App Distribution Alias Record
    new route53.ARecord(this, 'AppDistributionAliasRecord', {
      zone,
      recordName: 'tts',
      target,
    });

    // If the GitHub repository name exists, create a role to cdk deploy from GitHub.
    if (githubRepo) {
      // GitHub OpenID Connect Provider
      const githubOpenIdConnectProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(this, 'GitHubOpenIdConnectProvider', `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`);

      // GitHub Deploy Role
      const githubDeployRole = new iam.Role(this, 'GitHubDeployRole', {
        assumedBy: new iam.WebIdentityPrincipal(githubOpenIdConnectProvider.openIdConnectProviderArn, {
          'StringEquals': {
            [`${githubOpenIdConnectProvider.openIdConnectProviderIssuer}:aud`]: 'sts.amazonaws.com',
          },
          'StringLike': {
            [`${githubOpenIdConnectProvider.openIdConnectProviderIssuer}:sub`]: `repo:${githubRepo}:*`,
          },
        }),
        inlinePolicies: {
          GitHubDeployRoleDefaultPolicy: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                actions: [
                  'sts:AssumeRole',
                ],
                resources: [
                  `arn:aws:iam::${this.account}:role/cdk-${this.synthesizer.bootstrapQualifier}-*-role-${this.account}-*`,
                ],
              }),
            ],
          }),
        },
      });

      // Add permissions to access App Bucket.
      appBucket.grantReadWrite(githubDeployRole);

      // Add permissions to access App Distribution.
      appDistribution.grant(githubDeployRole, ...[
        'cloudfront:CreateInvalidation',
        'cloudfront:GetInvalidation',
      ]);
    }
  }
}

// CDK App
const app = new App();

// AWS Environment
const env = Object.fromEntries(['account', 'region'].map((key) => {
  return [key, process.env[`CDK_DEFAULT_${key.toUpperCase()}`]];
}));

// Mallows TTS Stack
new MallowsTtsStack(app, 'MallowsTts', {
  env,
});
