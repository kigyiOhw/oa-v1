from fastapi import UploadFile

from app.core.storage.base import StorageBackend


class S3Storage(StorageBackend):
    """Cloud storage via S3-compatible API (AWS S3, MinIO, etc.).

    Requires STORAGE_S3_ENDPOINT, STORAGE_S3_BUCKET, STORAGE_S3_ACCESS_KEY,
    STORAGE_S3_SECRET_KEY to be configured.
    """

    def __init__(
        self,
        endpoint: str,
        bucket: str,
        access_key: str,
        secret_key: str,
        region: str = "us-east-1",
    ):
        self.endpoint = endpoint
        self.bucket = bucket
        self.access_key = access_key
        self.secret_key = secret_key
        self.region = region
        self._client = None

    @property
    def client(self):
        if self._client is None:
            raise RuntimeError(
                "S3 client not initialized. Install boto3 and configure "
                "STORAGE_S3_ENDPOINT, STORAGE_S3_BUCKET, "
                "STORAGE_S3_ACCESS_KEY, STORAGE_S3_SECRET_KEY."
            )
        return self._client

    def _ensure_client(self) -> None:
        if self._client is not None:
            return
        try:
            import boto3  # type: ignore[import-untyped]

            self._client = boto3.client(
                "s3",
                endpoint_url=self.endpoint,
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                region_name=self.region,
            )
        except ImportError:
            raise RuntimeError(
                "boto3 is not installed. Run: pip install boto3"
            )
        except Exception as e:
            raise RuntimeError(f"Failed to initialize S3 client: {e}")

    async def upload(self, file: UploadFile) -> str:
        import os
        import uuid

        self._ensure_client()

        ext = os.path.splitext(file.filename or ".bin")[1] or ".bin"
        key = f"media/{uuid.uuid4().hex}{ext}"

        content = await file.read()
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=content,
            ContentType=file.content_type or "application/octet-stream",
        )

        return self.get_url(key)

    async def delete(self, file_path: str) -> None:
        self._ensure_client()
        key = file_path.replace(self.get_url(""), "", 1).lstrip("/")
        self.client.delete_object(Bucket=self.bucket, Key=key)

    def get_url(self, file_path: str) -> str:
        return f"{self.endpoint}/{self.bucket}/{file_path.lstrip('/')}"
