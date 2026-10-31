import ec2pkg from '@aws-sdk/client-ec2';
const { EC2Client, CreateNetworkInsightsPathCommand, StartNetworkInsightsAnalysisCommand, DescribeNetworkInsightsAnalysesCommand } = ec2pkg;

const ec2 = new EC2Client({ region: 'ap-south-1' });

async function checkPath() {
  console.log('Creating path...');
  const path = await ec2.send(new CreateNetworkInsightsPathCommand({
    Source: 'eni-05d19ec9b41ed0209', // Lambda ENI
    Destination: 'eni-01dea79a022a06a60', // ElastiCache ENI
    Protocol: 'tcp',
    DestinationPort: 6379,
  }));
  const pathId = path.NetworkInsightsPath?.NetworkInsightsPathId;
  console.log('Path created:', pathId);

  console.log('Starting analysis...');
  const analysis = await ec2.send(new StartNetworkInsightsAnalysisCommand({
    NetworkInsightsPathId: pathId
  }));
  const analysisId = analysis.NetworkInsightsAnalysis?.NetworkInsightsAnalysisId;
  console.log('Analysis started:', analysisId);

  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const res = await ec2.send(new DescribeNetworkInsightsAnalysesCommand({
      NetworkInsightsAnalysisIds: [analysisId]
    }));
    const item = res.NetworkInsightsAnalyses?.[0];
    console.log('Status:', item?.Status);
    if (item?.Status === 'succeeded' || item?.Status === 'failed') {
      console.log('NetworkPathFound:', item.NetworkPathFound);
      console.log('Explanations:', JSON.stringify(item.Explanations, null, 2));
      break;
    }
  }
}

checkPath().catch(console.error);

