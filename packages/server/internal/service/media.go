package service

import (
	"context"
	"errors"

	"log/slog"

	mediav1 "app.shiningacg.club/gen/proto/api/media/v1"
	"app.shiningacg.club/gen/proto/api/media/v1/mediav1connect"
	"app.shiningacg.club/internal/apperr"
	"app.shiningacg.club/internal/media"
	"connectrpc.com/connect"
)

// MediaServiceServer 是媒体服务的 Connect-RPC 实现。
type MediaServiceServer struct {
	mediav1connect.UnimplementedMediaServiceHandler
	useCase *media.UseCase
}

// NewMediaServiceServer 创建媒体服务实例。
func NewMediaServiceServer(useCase *media.UseCase) *MediaServiceServer {
	return &MediaServiceServer{useCase: useCase}
}

// PrepareUploadBatch 批量准备上传任务并固化顺序。
func (s *MediaServiceServer) PrepareUploadBatch(ctx context.Context, req *connect.Request[mediav1.PrepareUploadBatchRequest]) (*connect.Response[mediav1.PrepareUploadBatchResponse], error) {
	slog.InfoContext(ctx, "PrepareUploadBatch 请求", "count", len(req.Msg.Assets))
	resp, err := s.useCase.PrepareUploadBatch(ctx, req.Msg)
	if err != nil {
		return nil, mapError(ctx, err)
	}
	return connect.NewResponse(resp), nil
}

// CreateMultipartUpload 创建单文件 multipart 会话。
func (s *MediaServiceServer) CreateMultipartUpload(ctx context.Context, req *connect.Request[mediav1.CreateMultipartUploadRequest]) (*connect.Response[mediav1.CreateMultipartUploadResponse], error) {
	slog.InfoContext(ctx, "CreateMultipartUpload 请求")
	resp, err := s.useCase.CreateMultipartUpload(ctx, req.Msg)
	if err != nil {
		return nil, mapError(ctx, err)
	}
	return connect.NewResponse(resp), nil
}

// SignMultipartPart 为单分片签名。
func (s *MediaServiceServer) SignMultipartPart(ctx context.Context, req *connect.Request[mediav1.SignMultipartPartRequest]) (*connect.Response[mediav1.SignMultipartPartResponse], error) {
	resp, err := s.useCase.SignMultipartPart(ctx, req.Msg)
	if err != nil {
		return nil, mapError(ctx, err)
	}
	return connect.NewResponse(resp), nil
}

// ListUploadedParts 查询已上传分片。
func (s *MediaServiceServer) ListUploadedParts(ctx context.Context, req *connect.Request[mediav1.ListUploadedPartsRequest]) (*connect.Response[mediav1.ListUploadedPartsResponse], error) {
	resp, err := s.useCase.ListUploadedParts(ctx, req.Msg)
	if err != nil {
		return nil, mapError(ctx, err)
	}
	return connect.NewResponse(resp), nil
}

// CompleteMultipartUpload 完成分片上传并触发处理。
func (s *MediaServiceServer) CompleteMultipartUpload(ctx context.Context, req *connect.Request[mediav1.CompleteMultipartUploadRequest]) (*connect.Response[mediav1.CompleteMultipartUploadResponse], error) {
	slog.InfoContext(ctx, "CompleteMultipartUpload 请求", "upload_id", req.Msg.UploadId)
	resp, err := s.useCase.CompleteMultipartUpload(ctx, req.Msg)
	if err != nil {
		return nil, mapError(ctx, err)
	}
	return connect.NewResponse(resp), nil
}

// AbortMultipartUpload 中止上传任务。
func (s *MediaServiceServer) AbortMultipartUpload(ctx context.Context, req *connect.Request[mediav1.AbortMultipartUploadRequest]) (*connect.Response[mediav1.AbortMultipartUploadResponse], error) {
	slog.InfoContext(ctx, "AbortMultipartUpload 请求", "upload_id", req.Msg.UploadId)
	resp, err := s.useCase.AbortMultipartUpload(ctx, req.Msg)
	if err != nil {
		return nil, mapError(ctx, err)
	}
	return connect.NewResponse(resp), nil
}

// GetBatchMedia 获取批次媒体结果。
func (s *MediaServiceServer) GetBatchMedia(ctx context.Context, req *connect.Request[mediav1.GetBatchMediaRequest]) (*connect.Response[mediav1.GetBatchMediaResponse], error) {
	resp, err := s.useCase.GetBatchMedia(ctx, req.Msg.GetBatchId())
	if err != nil {
		return nil, mapError(ctx, err)
	}
	return connect.NewResponse(resp), nil
}

// mapError 将 application 层错误映射到 Connect-RPC 状态码。
// 依赖 apperr 包中统一定义的 sentinel，对所有服务均有效。
func mapError(ctx context.Context, err error) *connect.Error {
	// 记录错误日志
	slog.ErrorContext(ctx, "服务错误", "error", err)

	switch {
	case errors.Is(err, apperr.ErrInvalidArgument):
		return connect.NewError(connect.CodeInvalidArgument, err)
	case errors.Is(err, apperr.ErrNotFound):
		return connect.NewError(connect.CodeNotFound, err)
	case errors.Is(err, apperr.ErrFailedPrecondition):
		return connect.NewError(connect.CodeFailedPrecondition, err)
	default:
		return connect.NewError(connect.CodeInternal, err)
	}
}
