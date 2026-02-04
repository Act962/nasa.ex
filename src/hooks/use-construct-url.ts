export function useConstructUrl(key: string): string {
  return `https://${process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL}/${key}`;
}
