"""
Storage service — supports AWS S3 and Cloudflare R2 (S3-compatible).
Configure via environment variables.
"""
import boto3
import hashlib
import uuid
from botocore.exceptions import ClientError
from app.core.config import settings
import structlog

log = structlog.get_logger()


class StorageService:

    def __init__(self):
        self._client = None

    @property
    def client(self):
        if self._client is None:
            if settings.R2_ACCOUNT_ID and settings.R2_ACCESS_KEY_ID:
                # Cloudflare R2
                self._client = boto3.client(
                    "s3",
                    endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
                    aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                    region_name="auto",
                )
                self._bucket = settings.R2_BUCKET
            elif settings.AWS_ACCESS_KEY_ID:
                # AWS S3
                self._client = boto3.client(
                    "s3",
                    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                    region_name=settings.AWS_REGION,
                )
                self._bucket = settings.AWS_S3_BUCKET
            else:
                log.warning("No storage credentials configured — file storage disabled")
                return None
        return self._client

    @property
    def bucket(self):
        if settings.R2_ACCOUNT_ID:
            return settings.R2_BUCKET
        return settings.AWS_S3_BUCKET

    async def upload(
        self,
        file_bytes: bytes,
        original_filename: str,
        organization_id: str,
        content_type: str = "application/octet-stream",
    ) -> dict:
        """Upload file and return storage metadata."""
        file_hash = hashlib.sha256(file_bytes).hexdigest()
        ext = original_filename.rsplit(".", 1)[-1].lower() if "." in original_filename else "bin"
        key = f"receipts/{organization_id}/{uuid.uuid4()}.{ext}"

        if self.client is None:
            # Dev fallback — no storage configured
            log.warning("Storage not configured, skipping upload", key=key)
            return {
                "storage_key": key,
                "storage_url": f"/mock-storage/{key}",
                "file_hash": file_hash,
                "file_size_bytes": len(file_bytes),
            }

        try:
            self.client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=file_bytes,
                ContentType=content_type,
                Metadata={
                    "original-filename": original_filename,
                    "organization-id": organization_id,
                },
            )
            url = self._get_url(key)
            return {
                "storage_key": key,
                "storage_url": url,
                "file_hash": file_hash,
                "file_size_bytes": len(file_bytes),
            }
        except ClientError as e:
            log.error("Storage upload failed", error=str(e))
            raise

    def get_presigned_url(self, key: str, expires_in: int = 3600) -> str:
        """Generate a presigned URL for secure file access."""
        if self.client is None:
            return f"/mock-storage/{key}"
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires_in,
        )

    def _get_url(self, key: str) -> str:
        if settings.R2_ACCOUNT_ID:
            return f"https://{self.bucket}.{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/{key}"
        return f"https://{self.bucket}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"

    async def delete(self, key: str) -> bool:
        if self.client is None:
            return True
        try:
            self.client.delete_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError:
            return False


storage_service = StorageService()
