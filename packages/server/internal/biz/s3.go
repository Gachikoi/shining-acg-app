package biz

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// S3Client 持有用于资源操作的 MinIO 客户端（双客户端模式）
type S3Client struct {
	coreClient   *minio.Client // 内网客户端：用于上传、下载、管理 Bucket
	signerClient *minio.Client // 外网客户端：仅用于生成供前端使用的签名 URL
	bucket       string        // 存储桶名称
}

// NewS3Client 初始化 MinIO 客户端（双客户端模式）
// internalEndpoint: 内网地址 (如 minio-dev:9000)
// internalUseSSL: 内网是否使用 HTTPS
// externalEndpoint: 外网域名 (如 test.api.shiningacg.club:61080)
// externalUseSSL: 外网是否使用 HTTPS
// ak, sk: MinIO 访问密钥
// bucket: 存储桶名称
func NewS3Client(internalEndpoint string, internalUseSSL bool, externalEndpoint string, externalUseSSL bool, ak, sk, bucket string) (*S3Client, error) {
	slog.Debug("MinIO Init",
		slog.String("internal_endpoint", internalEndpoint),
		slog.Bool("internal_use_ssl", internalUseSSL),
		slog.String("external_endpoint", externalEndpoint),
		slog.Bool("external_use_ssl", externalUseSSL),
	)

	const defaultRegion = "us-east-1"

	coreClient, err := minio.New(internalEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(ak, sk, ""),
		Secure: internalUseSSL,
		Region: defaultRegion,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create internal minio client: %w", err)
	}

	signerClient, err := minio.New(externalEndpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(ak, sk, ""),
		Secure: externalUseSSL,
		Region: defaultRegion,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create signer minio client: %w", err)
	}

	ctx := context.Background()
	exists, err := coreClient.BucketExists(ctx, bucket)
	if err != nil {
		return nil, fmt.Errorf("failed to check bucket exists: %w", err)
	}
	if !exists {
		if err = coreClient.MakeBucket(ctx, bucket, minio.MakeBucketOptions{}); err != nil {
			return nil, fmt.Errorf("failed to create bucket: %w", err)
		}
	}

	return &S3Client{
		coreClient:   coreClient,
		signerClient: signerClient,
		bucket:       bucket,
	}, nil
}

// genPresignedURL 生成预签名的 PUT 上传链接（使用外网客户端）
func (c *S3Client) genPresignedURL(ctx context.Context, objectKey string, expire time.Duration) (string, map[string]string, error) {
	url, err := c.signerClient.PresignedPutObject(ctx, c.bucket, objectKey, expire)
	if err != nil {
		return "", nil, fmt.Errorf("failed to generate presigned URL: %w", err)
	}

	slog.Debug("Generated Presigned URL", slog.String("url", url.String()))

	return url.String(), map[string]string{"Content-Type": "application/octet-stream"}, nil
}

// downloadFile 从 MinIO 下载文件到本地（使用内网客户端）
func (c *S3Client) downloadFile(ctx context.Context, objectKey, localPath string) error {
	if err := os.MkdirAll(filepath.Dir(localPath), 0755); err != nil {
		return fmt.Errorf("failed to create local directory: %w", err)
	}

	file, err := os.Create(localPath)
	if err != nil {
		return fmt.Errorf("failed to create local file: %w", err)
	}

	object, err := c.coreClient.GetObject(ctx, c.bucket, objectKey, minio.GetObjectOptions{})
	if err != nil {
		file.Close()
		os.Remove(localPath)
		return fmt.Errorf("failed to get object: %w", err)
	}
	defer func() {
		object.Close()
		file.Close()
	}()

	if _, err = io.Copy(file, object); err != nil {
		os.Remove(localPath)
		return fmt.Errorf("failed to copy object to file: %w", err)
	}

	return nil
}

// uploadFile 上传本地文件到 MinIO（使用内网客户端）
func (c *S3Client) uploadFile(ctx context.Context, objectKey, localPath string, contentType string) error {
	info, err := c.coreClient.FPutObject(ctx, c.bucket, objectKey, localPath, minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return fmt.Errorf("failed to upload file: %w", err)
	}

	slog.InfoContext(ctx, "Successfully uploaded file",
		slog.String("object_key", objectKey),
		slog.Int64("size_bytes", info.Size),
	)
	return nil
}

// uploadDirectory 上传整个目录到 MinIO
func (c *S3Client) uploadDirectory(ctx context.Context, localDir, remoteDir string) error {
	err := filepath.Walk(localDir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return err
		}

		relPath, err := filepath.Rel(localDir, path)
		if err != nil {
			return err
		}

		remotePath := filepath.ToSlash(filepath.Join(remoteDir, relPath))

		contentType := "application/octet-stream"
		switch filepath.Ext(relPath) {
		case ".m3u8":
			contentType = "application/x-mpegURL"
		case ".m4s":
			contentType = "video/iso.segment"
		case ".webp":
			contentType = "image/webp"
		case ".mp4":
			contentType = "video/mp4"
		}

		if err = c.uploadFile(ctx, remotePath, path, contentType); err != nil {
			return fmt.Errorf("failed to upload %s: %w", remotePath, err)
		}
		return nil
	})

	if err != nil {
		return fmt.Errorf("failed to upload directory: %w", err)
	}
	return nil
}

// getObjectURL 获取文件的公开访问 URL（使用外网配置）
func (c *S3Client) getObjectURL(objectKey string) string {
	scheme := "http"
	if c.signerClient.EndpointURL().Scheme == "https" {
		scheme = "https"
	}
	return fmt.Sprintf("%s://%s/%s/%s", scheme, c.signerClient.EndpointURL().Host, c.bucket, objectKey)
}
