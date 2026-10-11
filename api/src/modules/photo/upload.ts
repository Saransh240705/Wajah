// A7.1: presigned S3 PUT for a completion photo (master PRD 6.4).
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '@wajah/shared';

let s3: S3Client | undefined;

export const photoKey = (workOrderId: string) => `photos/${workOrderId}.jpg`;

export async function photoUploadUrl(workOrderId: string): Promise<{ uploadUrl: string; key: string } | null> {
  const bucket = process.env.EVIDENCE_BUCKET;
  if (!bucket) return null;
  s3 ??= new S3Client({});
  const key = photoKey(workOrderId);
  const uploadUrl = await getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: 'image/jpeg' }), {
    expiresIn: config.photo.uploadUrlTtlSeconds,
  });
  return { uploadUrl, key };
}
