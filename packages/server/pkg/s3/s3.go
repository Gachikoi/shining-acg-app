package s3

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// Client 是 MinIO 客户端的封装
type Client struct {
	client *minio.Client
	Bucket string // 改为导出字段
}

// NewClient 初始化 MinIO 客户端
func NewClient(endpoint, ak, sk, bucket string, useSSL bool) (*Client, error) {
	fmt.Printf("DEBUG: MinIO Init - Endpoint: %s, AK: %s, SK: %s\n", endpoint, ak, sk)
	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(ak, sk, ""),
		Secure: useSSL,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create minio client: %w", err)
	}

	// 检查存储桶是否存在，不存在则创建
	ctx := context.Background()
	exists, err := client.BucketExists(ctx, bucket)
	if err != nil {
		return nil, fmt.Errorf("failed to check bucket exists: %w", err)
	}
	if !exists {
		err = client.MakeBucket(ctx, bucket, minio.MakeBucketOptions{})
		if err != nil {
			return nil, fmt.Errorf("failed to create bucket: %w", err)
		}
	}

	return &Client{
		client: client,
		Bucket: bucket,
	}, nil
}

// GenPresignedURL 生成预签名的 PUT 上传链接
func (c *Client) GenPresignedURL(ctx context.Context, objectKey string, expire time.Duration) (string, map[string]string, error) {
	reqParams := make(map[string]string)
	reqParams["Content-Type"] = "application/octet-stream"

	url, err := c.client.PresignedPutObject(ctx, c.Bucket, objectKey, expire)
	if err != nil {
		return "", nil, fmt.Errorf("failed to generate presigned URL: %w", err)
	}

	headers := map[string]string{
		"Content-Type": "application/octet-stream",
	}

	return url.String(), headers, nil
}

// DownloadFile 从 MinIO 下载文件到本地
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

	object, err := c.client.GetObject(ctx, c.Bucket, objectKey, minio.GetObjectOptions{})
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

// UploadFile 上传本地文件到 MinIO
func (c *Client) UploadFile(ctx context.Context, objectKey, localPath string, contentType string) error {
	info, err := c.client.FPutObject(ctx, c.Bucket, objectKey, localPath, minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		return fmt.Errorf("failed to upload file: %w", err)
	}

	fmt.Printf("Successfully uploaded %s, size: %d bytes\n", objectKey, info.Size)
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

// GetObjectURL 获取文件的公开访问 URL
func (c *Client) GetObjectURL(objectKey string) string {
	// 这里返回 MinIO 的公开访问 URL，实际项目中可能需要配置 CDN 域名
	return fmt.Sprintf("http://%s/%s/%s", c.client.EndpointURL().Host, c.Bucket, objectKey)
}
