import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
export const bucket = process.env.R2_BUCKET_NAME ?? 'stakeout-artifacts';
let client: S3Client | undefined;
export function r2() {
  return (client ??= new S3Client({
    region: 'auto',
    endpoint:
      'https://' + process.env.R2_ACCOUNT_ID + '.r2.cloudflarestorage.com',
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  }));
}
export async function signedRead(key: string) {
  return getSignedUrl(
    r2(),
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 3600 },
  );
}
export async function uploadURL(key: string) {
  return getSignedUrl(
    r2(),
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: 'application/gzip',
    }),
    { expiresIn: 900 },
  );
}
export async function uploaded(key: string) {
  try {
    await r2().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (e: any) {
    if (e.$metadata?.httpStatusCode === 404 || e.name === 'NotFound')
      return false;
    throw e;
  }
}
export async function put(
  key: string,
  body: Buffer | string,
  contentType: string,
) {
  await r2().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}
