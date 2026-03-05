package service

import (
	"context"

	v1 "app.shiningacg.club/gen/proto/api/main/partition/v1"
	"app.shiningacg.club/gen/proto/api/main/partition/v1/partitionv1connect"
	"app.shiningacg.club/internal/model"
	repo "app.shiningacg.club/internal/repo"
	"connectrpc.com/connect"
	"gorm.io/gorm"
)


// PartitionServiceServer 是 PartitionService 的伪实现
type PartitionServiceServer struct {
	partitionv1connect.UnimplementedPartitionServiceHandler
	repo repo.PartitionRepo
}

// 确保 PartitionServiceServer 实现了 PartitionServiceHandler 接口
var _ partitionv1connect.PartitionServiceHandler = (*PartitionServiceServer)(nil)

// 新实例
func NewPartitionServiceServer(repo repo.PartitionRepo) *PartitionServiceServer {
	return &PartitionServiceServer{
		repo: repo,
	}
}

// 插入一组新分区
func (p *PartitionServiceServer) CreatePartitions(ctx context.Context, req *connect.Request[v1.CreatePartitionsRequest]) (*connect.Response[v1.CreatePartitionsResponse], error) {

	partList := model.NewPartitionList(req.Msg.Names)
	err := p.repo.Create(ctx, partList)

	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, nil)
	}

	return connect.NewResponse(&v1.CreatePartitionsResponse{
		Partitions: partList.ToService(),
	}), nil
}

func (p *PartitionServiceServer) ListPartitions(ctx context.Context, req *connect.Request[v1.ListPartitionsRequest]) (*connect.Response[v1.ListPartitionsResponse], error) {
	partList, err := p.repo.List(ctx)

	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, nil)
	}

	return connect.NewResponse(&v1.ListPartitionsResponse{
		Partitions: partList.ToService(),
	}), nil
}

func (p *PartitionServiceServer) RenamePartition(ctx context.Context, req *connect.Request[v1.RenamePartitionRequest]) (*connect.Response[v1.RenamePartitionResponse], error) {

	err := p.repo.Rename(ctx, req.Msg.PartitionId, req.Msg.NewName)

	if err == gorm.ErrRecordNotFound {
		return nil, connect.NewError(connect.CodeNotFound, nil)
	}
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, nil)
	}

	return connect.NewResponse(&v1.RenamePartitionResponse{}), err
}

func (p *PartitionServiceServer) DeletePartition(ctx context.Context, req *connect.Request[v1.DeletePartitionRequest]) (*connect.Response[v1.DeletePartitionResponse], error) {
	err := p.repo.Delete(ctx, req.Msg.PartitionId)

	if err == gorm.ErrRecordNotFound {
		return nil, connect.NewError(connect.CodeNotFound, nil)
	}
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, nil)
	}

	return connect.NewResponse(&v1.DeletePartitionResponse{}), err
}
