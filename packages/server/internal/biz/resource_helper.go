package biz

import (
	"context"
	"fmt"

	"app.shiningacg.club/gen/proto/api/common/v1"
	"app.shiningacg.club/pkg/pathutil"
)

// parseTaskID 解析任务ID
func parseTaskID(taskID string) (int64, error) {
	var id int64
	_, err := fmt.Sscanf(taskID, "%d", &id)
	if err != nil {
		return 0, fmt.Errorf("invalid task_id format: %w", err)
	}
	return id, nil
}

// getCategoryByScene 根据场景获取存储类别
func getCategoryByScene(scene commonv1.ResourceScene) (string, error) {
	switch scene {
	case commonv1.ResourceScene_SCENE_USER_AVATAR:
		return pathutil.TypeImageAvatar, nil
	case commonv1.ResourceScene_SCENE_POST_IMAGE:
		return pathutil.TypeImageCommon, nil
	case commonv1.ResourceScene_SCENE_COMMENT_IMAGE:
		return pathutil.TypeImageCommon, nil
	case commonv1.ResourceScene_SCENE_POST_VIDEO:
		return pathutil.TypeVideoRaw, nil
	case commonv1.ResourceScene_SCENE_POST_COVER:
		return pathutil.TypeImageCover, nil
	default:
		return "", fmt.Errorf("unsupported resource scene: %v", scene)
	}
}

// getMediaByID 查找媒体记录并转换状态
func (uc *ResourceUseCase) getMediaByID(ctx context.Context, taskID string) (*commonv1.Media, commonv1.MediaStatus, error) {
	mediaID, err := parseTaskID(taskID)
	if err != nil {
		return nil, commonv1.MediaStatus_MEDIA_STATUS_UNSPECIFIED, fmt.Errorf("invalid task_id: %w", err)
	}

	media, err := uc.repo.FindByID(ctx, mediaID)
	if err != nil {
		return nil, commonv1.MediaStatus_MEDIA_STATUS_UNSPECIFIED, fmt.Errorf("failed to find media: %w", err)
	}

	var status commonv1.MediaStatus
	switch media.Status {
	case MediaStatusProcessing:
		status = commonv1.MediaStatus_MEDIA_STATUS_PROCESSING
	case MediaStatusCompleted:
		status = commonv1.MediaStatus_MEDIA_STATUS_COMPLETED
	case MediaStatusBlocked:
		status = commonv1.MediaStatus_MEDIA_STATUS_BLOCKED
	case MediaStatusFailed:
		status = commonv1.MediaStatus_MEDIA_STATUS_FAILED
	default:
		status = commonv1.MediaStatus_MEDIA_STATUS_UNSPECIFIED
	}

	return media, status, nil
}

// buildGetUploadStatusResponse 构造获取上传状态的响应
func (uc *ResourceUseCase) buildGetUploadStatusResponse(media *commonv1.Media, status commonv1.MediaStatus) *commonv1.GetUploadStatusResponse {
	publicURL := uc.s3.GetObjectURL(media.ObjectKey)

	return &commonv1.GetUploadStatusResponse{
		Status:    status,
		PublicUrl: publicURL,
		Meta:      media.Meta,
	}
}
