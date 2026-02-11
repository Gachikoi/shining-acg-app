package service

import (
	"context"

	commonv1 "app.shiningacg.club/gen/proto/api/common/v1"
	"app.shiningacg.club/gen/proto/api/common/v1/commonv1connect"
	"app.shiningacg.club/internal/biz"
	"connectrpc.com/connect"
)

// ResourceServiceServer 是 ResourceService 的实现
type ResourceServiceServer struct {
	commonv1connect.UnimplementedResourceServiceHandler
	useCase *biz.ResourceUseCase
}

// 确保 ResourceServiceServer 实现了 ResourceServiceHandler 接口
var _ commonv1connect.ResourceServiceHandler = (*ResourceServiceServer)(nil)

// NewResourceServiceServer 创建资源服务实例
func NewResourceServiceServer(useCase *biz.ResourceUseCase) *ResourceServiceServer {
	return &ResourceServiceServer{
		useCase: useCase,
	}
}

// GetUploadTokens 获取上传凭证
func (s *ResourceServiceServer) GetUploadTokens(ctx context.Context, req *connect.Request[commonv1.GetUploadTokensRequest]) (*connect.Response[commonv1.GetUploadTokensResponse], error) {
	var tokens []*commonv1.UploadToken

	for _, task := range req.Msg.GetTasks() {
		token, err := s.useCase.CreateUploadTask(ctx, req.Msg.GetScene(), task)
		if err != nil {
			return nil, connect.NewError(connect.CodeInternal, err)
		}
		tokens = append(tokens, token)
	}

	return connect.NewResponse(&commonv1.GetUploadTokensResponse{
		Tokens: tokens,
	}), nil
}

// CompleteUpload 完成上传并触发处理
func (s *ResourceServiceServer) CompleteUpload(ctx context.Context, req *connect.Request[commonv1.CompleteUploadRequest]) (*connect.Response[commonv1.CompleteUploadResponse], error) {
	resp, err := s.useCase.CompleteUpload(ctx, req.Msg)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(resp), nil
}

// GetUploadStatus 获取上传状态
func (s *ResourceServiceServer) GetUploadStatus(ctx context.Context, req *connect.Request[commonv1.GetUploadStatusRequest]) (*connect.Response[commonv1.GetUploadStatusResponse], error) {
	resp, err := s.useCase.GetUploadStatus(ctx, req.Msg.GetTaskId())
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(resp), nil
}
