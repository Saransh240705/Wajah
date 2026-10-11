import { PublishCommand, SNSClient } from '@aws-sdk/client-sns';

let client: SNSClient | undefined;

export interface NotifyTags { agency: string; type: 'work_order' | 'overdue' | 'no_effect' | 'brief' }

/**
 * Publish to the alerts topic. Messages carry `agency` and `type` attributes so an email subscription can filter
 * (e.g. a PWD inbox with filter policy {"agency":["PWD"]}). Without ALERTS_TOPIC_ARN (local runs) it only logs.
 */
export async function publish(subject: string, message: string, tags?: NotifyTags): Promise<void> {
  const topic = process.env.ALERTS_TOPIC_ARN;
  const s = subject.replace(/[^\x20-\x7e]/g, '').slice(0, 100); // SNS subjects: ASCII, at most 100 characters
  if (!topic) {
    console.log(JSON.stringify({ step: 'notify', topic: null, subject: s, ...tags }));
    return;
  }
  client ??= new SNSClient({});
  await client.send(new PublishCommand({
    TopicArn: topic, Subject: s, Message: message,
    ...(tags ? { MessageAttributes: {
      agency: { DataType: 'String', StringValue: tags.agency },
      type: { DataType: 'String', StringValue: tags.type },
    } } : {}),
  }));
  console.log(JSON.stringify({ step: 'notify', subject: s, ...tags }));
}
