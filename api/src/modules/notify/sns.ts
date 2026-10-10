import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';

let client: SNSClient | undefined;

/** Publish to the alerts topic. Without ALERTS_TOPIC_ARN (local runs) the message is only logged. */
export async function publish(subject: string, message: string): Promise<void> {
  const topic = process.env.ALERTS_TOPIC_ARN;
  const s = subject.replace(/[^\x20-\x7e]/g, '').slice(0, 100); // SNS subjects: ASCII, at most 100 characters
  if (!topic) {
    console.log(JSON.stringify({ step: 'notify', topic: null, subject: s }));
    return;
  }
  client ??= new SNSClient({});
  await client.send(new PublishCommand({ TopicArn: topic, Subject: s, Message: message }));
  console.log(JSON.stringify({ step: 'notify', subject: s }));
}
