// AWS Configuration for N3xFin
import awsConfigJson from './aws-config.json';

export const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: awsConfigJson.userPoolId,
      userPoolClientId: awsConfigJson.userPoolClientId,
      region: awsConfigJson.region,
    }
  },
  API: {
    REST: {
      N3xFinAPI: {
        endpoint: awsConfigJson.apiGatewayUrl,
        region: awsConfigJson.region,
      }
    }
  },
  Storage: {
    S3: {
      bucket: awsConfigJson.s3BucketName,
      region: awsConfigJson.region,
    }
  }
};

// Export individual values for easy access
export const API_BASE_URL = awsConfigJson.apiGatewayUrl;
export const AWS_REGION = awsConfigJson.region;
export const USER_POOL_ID = awsConfigJson.userPoolId;
export const USER_POOL_CLIENT_ID = awsConfigJson.userPoolClientId;
export const S3_BUCKET_NAME = awsConfigJson.s3BucketName;
