package service

import (
	"context"
	"errors"

	adminv1 "app.shiningacg.club/gen/proto/api/admin/v1"
	"app.shiningacg.club/gen/proto/api/admin/v1/adminv1connect"
	"connectrpc.com/connect"
)

// UserAdminServiceServer 是 UserAdminService 的伪实现
type UserAdminServiceServer struct{}

var _ adminv1connect.UserAdminServiceHandler = (*UserAdminServiceServer)(nil)

func (s *UserAdminServiceServer) UpdateUserRole(ctx context.Context, req *connect.Request[adminv1.UpdateUserRoleRequest]) (*connect.Response[adminv1.UpdateUserRoleResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("UpdateUserRole 接口尚未实现"))
}

func (s *UserAdminServiceServer) BanUser(ctx context.Context, req *connect.Request[adminv1.BanUserRequest]) (*connect.Response[adminv1.BanUserResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("BanUser 接口尚未实现"))
}

func (s *UserAdminServiceServer) AdminSearchUsers(ctx context.Context, req *connect.Request[adminv1.AdminSearchUsersRequest]) (*connect.Response[adminv1.AdminSearchUsersResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("AdminSearchUsers 接口尚未实现"))
}

func (s *UserAdminServiceServer) ListVerificationApplications(ctx context.Context, req *connect.Request[adminv1.ListVerificationApplicationsRequest]) (*connect.Response[adminv1.ListVerificationApplicationsResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("ListVerificationApplications 接口尚未实现"))
}

func (s *UserAdminServiceServer) ApproveVerification(ctx context.Context, req *connect.Request[adminv1.ApproveVerificationRequest]) (*connect.Response[adminv1.ApproveVerificationResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("ApproveVerification 接口尚未实现"))
}

// SiteAdminServiceServer 是 SiteAdminService 的伪实现
type SiteAdminServiceServer struct{}

var _ adminv1connect.SiteAdminServiceHandler = (*SiteAdminServiceServer)(nil)

func (s *SiteAdminServiceServer) UpsertDepartment(ctx context.Context, req *connect.Request[adminv1.UpsertDepartmentRequest]) (*connect.Response[adminv1.UpsertDepartmentResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("UpsertDepartment 接口尚未实现"))
}

func (s *SiteAdminServiceServer) DeleteDepartment(ctx context.Context, req *connect.Request[adminv1.DeleteDepartmentRequest]) (*connect.Response[adminv1.DeleteDepartmentResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("DeleteDepartment 接口尚未实现"))
}

func (s *SiteAdminServiceServer) UpsertActivity(ctx context.Context, req *connect.Request[adminv1.UpsertActivityRequest]) (*connect.Response[adminv1.UpsertActivityResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("UpsertActivity 接口尚未实现"))
}

func (s *SiteAdminServiceServer) DeleteActivity(ctx context.Context, req *connect.Request[adminv1.DeleteActivityRequest]) (*connect.Response[adminv1.DeleteActivityResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("DeleteActivity 接口尚未实现"))
}

func (s *SiteAdminServiceServer) UpsertHistoryEvent(ctx context.Context, req *connect.Request[adminv1.UpsertHistoryEventRequest]) (*connect.Response[adminv1.UpsertHistoryEventResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("UpsertHistoryEvent 接口尚未实现"))
}

func (s *SiteAdminServiceServer) DeleteHistoryEvent(ctx context.Context, req *connect.Request[adminv1.DeleteHistoryEventRequest]) (*connect.Response[adminv1.DeleteHistoryEventResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("DeleteHistoryEvent 接口尚未实现"))
}

func (s *SiteAdminServiceServer) UpsertMinister(ctx context.Context, req *connect.Request[adminv1.UpsertMinisterRequest]) (*connect.Response[adminv1.UpsertMinisterResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("UpsertMinister 接口尚未实现"))
}

func (s *SiteAdminServiceServer) DeleteMinister(ctx context.Context, req *connect.Request[adminv1.DeleteMinisterRequest]) (*connect.Response[adminv1.DeleteMinisterResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("DeleteMinister 接口尚未实现"))
}

func (s *SiteAdminServiceServer) UpsertStaffGroup(ctx context.Context, req *connect.Request[adminv1.UpsertStaffGroupRequest]) (*connect.Response[adminv1.UpsertStaffGroupResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("UpsertStaffGroup 接口尚未实现"))
}

func (s *SiteAdminServiceServer) DeleteStaffGroup(ctx context.Context, req *connect.Request[adminv1.DeleteStaffGroupRequest]) (*connect.Response[adminv1.DeleteStaffGroupResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("DeleteStaffGroup 接口尚未实现"))
}

func (s *SiteAdminServiceServer) UpsertSponsor(ctx context.Context, req *connect.Request[adminv1.UpsertSponsorRequest]) (*connect.Response[adminv1.UpsertSponsorResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("UpsertSponsor 接口尚未实现"))
}

func (s *SiteAdminServiceServer) DeleteSponsor(ctx context.Context, req *connect.Request[adminv1.DeleteSponsorRequest]) (*connect.Response[adminv1.DeleteSponsorResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("DeleteSponsor 接口尚未实现"))
}

// GovernanceServiceServer 是 GovernanceService 的伪实现
type GovernanceServiceServer struct{}

var _ adminv1connect.GovernanceServiceHandler = (*GovernanceServiceServer)(nil)

func (s *GovernanceServiceServer) ListReports(ctx context.Context, req *connect.Request[adminv1.ListReportsRequest]) (*connect.Response[adminv1.ListReportsResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("ListReports 接口尚未实现"))
}

func (s *GovernanceServiceServer) ResolveReport(ctx context.Context, req *connect.Request[adminv1.ResolveReportRequest]) (*connect.Response[adminv1.ResolveReportResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("ResolveReport 接口尚未实现"))
}

// ContentAdminServiceServer 是 ContentAdminService 的伪实现
type ContentAdminServiceServer struct{}

var _ adminv1connect.ContentAdminServiceHandler = (*ContentAdminServiceServer)(nil)

func (s *ContentAdminServiceServer) ListPosts(ctx context.Context, req *connect.Request[adminv1.ListPostsRequest]) (*connect.Response[adminv1.ListPostsResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("ListPosts 接口尚未实现"))
}

func (s *ContentAdminServiceServer) DeletePost(ctx context.Context, req *connect.Request[adminv1.DeletePostRequest]) (*connect.Response[adminv1.DeletePostResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("DeletePost 接口尚未实现"))
}

func (s *ContentAdminServiceServer) ApprovePost(ctx context.Context, req *connect.Request[adminv1.ApprovePostRequest]) (*connect.Response[adminv1.ApprovePostResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("ApprovePost 接口尚未实现"))
}

func (s *ContentAdminServiceServer) UpsertPartition(ctx context.Context, req *connect.Request[adminv1.UpsertPartitionRequest]) (*connect.Response[adminv1.UpsertPartitionResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("UpsertPartition 接口尚未实现"))
}

func (s *ContentAdminServiceServer) DeletePartition(ctx context.Context, req *connect.Request[adminv1.DeletePartitionRequest]) (*connect.Response[adminv1.DeletePartitionResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("DeletePartition 接口尚未实现"))
}

func (s *ContentAdminServiceServer) ListPartitions(ctx context.Context, req *connect.Request[adminv1.ListPartitionsRequest]) (*connect.Response[adminv1.ListPartitionsResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("ListPartitions 接口尚未实现"))
}

// SystemAdminServiceServer 是 SystemAdminService 的伪实现
type SystemAdminServiceServer struct{}

var _ adminv1connect.SystemAdminServiceHandler = (*SystemAdminServiceServer)(nil)

func (s *SystemAdminServiceServer) GetSystemConfig(ctx context.Context, req *connect.Request[adminv1.GetSystemConfigRequest]) (*connect.Response[adminv1.GetSystemConfigResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("GetSystemConfig 接口尚未实现"))
}

func (s *SystemAdminServiceServer) UpdateSystemConfig(ctx context.Context, req *connect.Request[adminv1.UpdateSystemConfigRequest]) (*connect.Response[adminv1.UpdateSystemConfigResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("UpdateSystemConfig 接口尚未实现"))
}

func (s *SystemAdminServiceServer) ListSystemLogs(ctx context.Context, req *connect.Request[adminv1.ListSystemLogsRequest]) (*connect.Response[adminv1.ListSystemLogsResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("ListSystemLogs 接口尚未实现"))
}

func (s *SystemAdminServiceServer) GetSystemStats(ctx context.Context, req *connect.Request[adminv1.GetSystemStatsRequest]) (*connect.Response[adminv1.GetSystemStatsResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("GetSystemStats 接口尚未实现"))
}

func (s *SystemAdminServiceServer) ClearSystemCache(ctx context.Context, req *connect.Request[adminv1.ClearSystemCacheRequest]) (*connect.Response[adminv1.ClearSystemCacheResponse], error) {
	return nil, connect.NewError(connect.CodeUnimplemented, errors.New("ClearSystemCache 接口尚未实现"))
}
