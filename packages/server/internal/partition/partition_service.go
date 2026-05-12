package partition

import (
	"context"
	"errors"
	"strconv"

	v1 "app.shiningacg.club/gen/proto/api/main/partition/v1"
	"app.shiningacg.club/gen/proto/api/main/partition/v1/partitionv1connect"
	"connectrpc.com/connect"
	"gorm.io/gorm"
)

// TODO: 管理鉴权组件待开发

// PartitionServiceServer 是 PartitionService 的伪实现
type PartitionServiceServer struct {
	partitionv1connect.UnimplementedPartitionServiceHandler
	repo PartitionRepo
}

// 确保 PartitionServiceServer 实现了 PartitionServiceHandler 接口
var _ partitionv1connect.PartitionServiceHandler = (*PartitionServiceServer)(nil)

// 新实例
func NewPartitionServiceServer(repo PartitionRepo) *PartitionServiceServer {
	return &PartitionServiceServer{
		repo: repo,
	}
}

// 插入一组新分区
// 返回新的所有分区
func (p *PartitionServiceServer) CreatePartitions(ctx context.Context, req *connect.Request[v1.CreatePartitionsRequest]) (*connect.Response[v1.CreatePartitionsResponse], error) {

	partList := NewPartitionList(req.Msg.Names)
	err := p.repo.Create(ctx, partList)

	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	// 获取新的所有分区
	partList, err = p.repo.List(ctx)
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&v1.CreatePartitionsResponse{
		Partitions: partList.ToPartitions(),
	}), nil
}

// 获取所有分区
func (p *PartitionServiceServer) ListPartitions(ctx context.Context, req *connect.Request[v1.ListPartitionsRequest]) (*connect.Response[v1.ListPartitionsResponse], error) {
	partList, err := p.repo.List(ctx)

	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&v1.ListPartitionsResponse{
		Partitions: partList.ToPartitions(),
	}), nil
}

// 重命名分区
func (p *PartitionServiceServer) RenamePartition(ctx context.Context, req *connect.Request[v1.RenamePartitionRequest]) (*connect.Response[v1.RenamePartitionResponse], error) {

	pid, err := strconv.Atoi(req.Msg.PartitionId)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	err = p.repo.Rename(ctx, int32(pid), req.Msg.NewName)

	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&v1.RenamePartitionResponse{}), nil
}

// 删除分区
func (p *PartitionServiceServer) DeletePartition(ctx context.Context, req *connect.Request[v1.DeletePartitionRequest]) (*connect.Response[v1.DeletePartitionResponse], error) {

	pid, err := strconv.Atoi(req.Msg.PartitionId)
	if err != nil {
		return nil, connect.NewError(connect.CodeInvalidArgument, err)
	}

	err = p.repo.Delete(ctx, int32(pid))
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, connect.NewError(connect.CodeNotFound, err)
	}
	if err != nil {
		return nil, connect.NewError(connect.CodeInternal, err)
	}

	return connect.NewResponse(&v1.DeletePartitionResponse{}), nil
}
