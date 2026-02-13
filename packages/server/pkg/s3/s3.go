package s3

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

// Client 是 MinIO 客户端的封装，使用双客户端模式
type Client struct {
	coreClient   *minio.Client // 内网客户端：用于上传、下载、管理 Bucket
	signerClient *minio.Client // 外网客户端：仅用于生成供前端使用的签名 URL
	Bucket       string        // 存储桶名称
}

// NewClient 初始化 MinIO 客户端（双客户端模式）
// internalEndpoint: 内网地址 (如 minio-dev:9000)
// internalUseSSL: 内网是否使用 HTTPS
// externalEndpoint: 外网域名 (如 test.api.shiningacg.club:61080)
// externalUseSSL: 外网是否使用 HTTPS
func NewClient(internalEndpoint string, internalUseSSL bool, externalEndpoint string, externalUseSSL bool, ak, sk, bucket string) (*Client, error) {
	slog.Debug("MinIO Init",
		slog.String("internal_endpoint", internalEndpoint),
		slog.Bool("internal_use_ssl", internalUseSSL),
		slog.String("external_endpoint", externalEndpoint),
		slog.Bool("external_use_ssl", externalUseSSL),
	)
	slog.Debug("MinIO Credentials",
		slog.String("access_key", ak),
		slog.String("secret_key", sk),
	)

	// 默认 Region，MinIO 默认通常是 "us-east-1"，除非你在启动 MinIO 时设置了 MINIO_REGION
	const defaultRegion = "us-east-1"

	// 1. 初始化内网核心客户端 (用于上传、下载、管理 Bucket)
	coreOptions := &minio.Options{
		Creds:  credentials.NewStaticV4(ak, sk, ""),
		Secure: internalUseSSL,
		Region: defaultRegion, // 显式设置 Region
	}
	coreClient, err := minio.New(internalEndpoint, coreOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to create internal minio client: %w", err)
	}

	// 2. 初始化外网签名客户端 (仅用于生成签名 URL)
	signerOptions := &minio.Options{
		Creds:  credentials.NewStaticV4(ak, sk, ""),
		Secure: externalUseSSL,
		Region: defaultRegion, // 显式设置 Region
	}
	signerClient, err := minio.New(externalEndpoint, signerOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to create signer minio client: %w", err)
	}

	// 3. 使用核心客户端检查存储桶
	ctx := context.Background()
	exists, err := coreClient.BucketExists(ctx, bucket)
	if err != nil {
		return nil, fmt.Errorf("failed to check bucket exists: %w", err)
	}
	if !exists {
		err = coreClient.MakeBucket(ctx, bucket, minio.MakeBucketOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to create bucket: %w", err)
		}
	}

	return &Client{
		coreClient:   coreClient,
		signerClient: signerClient,
		Bucket:       bucket,
	}, nil
}

// GenPresignedURL 生成预签名的 PUT 上传链接（使用外网客户端）
func (c *Client) GenPresignedURL(ctx context.Context, objectKey string, expire time.Duration) (string, map[string]string, error) {
	reqParams := make(map[string]string)
	reqParams["Content-Type"] = "application/octet-stream"

	url, err := c.signerClient.PresignedPutObject(ctx, c.Bucket, objectKey, expire)
	if err != nil {
		return "", nil, fmt.Errorf("failed to generate presigned URL: %w", err)
	}

	slog.Debug("Generated Presigned URL",
		slog.String("url", url.String()),
	)

	headers := map[string]string{
		"Content-Type": "application/octet-stream",
	}

	return url.String(), headers, nil
}

// DownloadFile 从 MinIO 下载文件到本地（使用内网客户端）
func (c *Client) DownloadFile(ctx context.Context, objectKey, localPath string) error {
	// 确保目录存在
	dir := filepath.Dir(localPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create local directory: %w", err)
	}

	file, err := os.Create(localPath)
	if err != nil {
		return fmt.Errorf("failed to create local file: %w", err)
	}

	object, err := c.coreClient.GetObject(ctx, c.Bucket, objectKey, minio.GetObjectOptions{})
	if err != nil {
		file.Close()
		os.Remove(localPath) // 清理临时文件
		return fmt.Errorf("failed to get object: %w", err)
	}

	defer func() {
		object.Close()
		file.Close()
	}()

	_, err = io.Copy(file, object)
	if err != nil {
		os.Remove(localPath) // 清理临时文件
		return fmt.Errorf("failed to copy object to file: %w", err)
	}

	return nil
}

// UploadFile 上传本地文件到 MinIO（使用内网客户端）
func (c *Client) UploadFile(ctx context.Context, objectKey, localPath string, contentType string) error {
	info, err := c.coreClient.FPutObject(ctx, c.Bucket, objectKey, localPath, minio.PutObjectOptions{
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

// UploadDirectory 上传整个目录到 MinIO
func (c *Client) UploadDirectory(ctx context.Context, localDir, remoteDir string) error {
	err := filepath.Walk(localDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			return nil
		}

		// 计算相对路径
		relPath, err := filepath.Rel(localDir, path)
		if err != nil {
			return err
		}

		// 构造远程路径
		remotePath := filepath.Join(remoteDir, relPath)
		// 将 Windows 路径分隔符转换为 Unix 路径分隔符
		remotePath = filepath.ToSlash(remotePath)

		// 上传文件
		contentType := "application/octet-stream"
		if filepath.Ext(relPath) == ".m3u8" {
			contentType = "application/x-mpegURL"
		} else if filepath.Ext(relPath) == ".m4s" {
			contentType = "video/iso.segment"
		} else if filepath.Ext(relPath) == ".webp" {
			contentType = "image/webp"
		} else if filepath.Ext(relPath) == ".mp4" {
			contentType = "video/mp4"
		}

		err = c.UploadFile(ctx, remotePath, path, contentType)
		if err != nil {
			return fmt.Errorf("failed to upload %s: %w", remotePath, err)
		}

		return nil
	})

	if err != nil {
		return fmt.Errorf("failed to upload directory: %w", err)
	}

	return nil
}

// GetObjectURL 获取文件的公开访问 URL（使用外网配置）
func (c *Client) GetObjectURL(objectKey string) string {
	scheme := "http"
	if c.signerClient.EndpointURL().Scheme == "https" {
		scheme = "https"
	}
	return fmt.Sprintf("%s://%s/%s/%s", scheme, c.signerClient.EndpointURL().Host, c.Bucket, objectKey)
}
