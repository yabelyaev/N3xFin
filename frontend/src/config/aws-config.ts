// AWS Configuration for N3xFin
export const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'us-east-1_CTCYyrb7b',
      userPoolClientId: '', // To be added after creating Cognito App Client
      region: 'us-east-1',
    }
  },
  API: {
    REST: {
      N3xFinAPI: {
        endpoint: '', // To be added after API Gateway deployment
        region: 'us-east-1',
      }
    }
  },
  Storage: {
    S3: {
      bucket: 'n3xfin-data-087305321237',
      region: 'us-east-1',
    }
  }
};
