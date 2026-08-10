package media

import (
	"fmt"
	"strconv"

	mediav1 "app.shiningacg.club/gen/proto/api/media/v1"
	"app.shiningacg.club/internal/model"
	"app.shiningacg.club/pkg/mediapolicy"
	"app.shiningacg.club/pkg/pathutil"
)

type parsedUploadFile struct {
	role      string
	file      *mediav1.UploadFile
	mediaType mediav1.MediaType
}

// parseUploadAsset 将 UploadAsset payload 解析为媒体类型、文件列表与裁剪标志。
func parseUploadAsset(asset *mediav1.UploadAsset) (mediav1.MediaType, []*parsedUploadFile, bool, error) {
	if asset == nil {
		return mediav1.MediaType_MEDIA_TYPE_UNSPECIFIED, nil, false, fmt.Errorf("upload_asset 不能为空")
	}

	// crop_cover 为元素级属性，在 payload 分支之前统一取出
	cropCover := asset.GetCropCover()

	single := asset.GetSingleFile()
	if single != nil {
		mediaType, err := mediapolicy.DeriveMediaType(single.GetMimeType())
		if err != nil {
			return mediav1.MediaType_MEDIA_TYPE_UNSPECIFIED, nil, false, fmt.Errorf("single_file mime_type 解析失败: %w", err)
		}
		return mediaType, []*parsedUploadFile{{role: model.FileRoleSingle, file: single, mediaType: mediaType}}, cropCover, nil
	}

	pair := asset.GetLivePhotoPair()
	if pair == nil {
		return mediav1.MediaType_MEDIA_TYPE_UNSPECIFIED, nil, false, fmt.Errorf("payload 解析失败")
	}

	imageFile := pair.GetImageFile()
	videoFile := pair.GetVideoFile()
	imageType, err := mediapolicy.DeriveMediaType(imageFile.GetMimeType())
	if err != nil {
		return mediav1.MediaType_MEDIA_TYPE_UNSPECIFIED, nil, false, fmt.Errorf("live_photo_pair.image_file mime_type 解析失败: %w", err)
	}
	videoType, err := mediapolicy.DeriveMediaType(videoFile.GetMimeType())
	if err != nil {
		return mediav1.MediaType_MEDIA_TYPE_UNSPECIFIED, nil, false, fmt.Errorf("live_photo_pair.video_file mime_type 解析失败: %w", err)
	}
	if imageType != mediav1.MediaType_MEDIA_TYPE_IMAGE {
		return mediav1.MediaType_MEDIA_TYPE_UNSPECIFIED, nil, false, fmt.Errorf("live_photo_pair.image_file mime_type 必须是 image")
	}
	if videoType != mediav1.MediaType_MEDIA_TYPE_VIDEO {
		return mediav1.MediaType_MEDIA_TYPE_UNSPECIFIED, nil, false, fmt.Errorf("live_photo_pair.video_file mime_type 必须是 video")
	}

	return mediav1.MediaType_MEDIA_TYPE_LIVE_PHOTO,
		[]*parsedUploadFile{
			{role: model.FileRoleLivePhotoImage, file: imageFile, mediaType: mediav1.MediaType_MEDIA_TYPE_IMAGE},
			{role: model.FileRoleLivePhotoVideo, file: videoFile, mediaType: mediav1.MediaType_MEDIA_TYPE_VIDEO},
		},
		cropCover,
		nil
}

// buildFileAndTask 根据解析好的单个文件信息，构建数据库记录与响应任务对象。
func (uc *UseCase) buildFileAndTask(pf *parsedUploadFile, assetID int64, batchID string) (*model.MediaFile, *mediav1.PreparedUploadTask) {
	fileID := uc.node.Generate().Int64()
	taskID := strconv.FormatInt(fileID, 10)
	objectKey := pathutil.GenerateObjectKey(fileID, rawCategoryByType(pf.mediaType), pf.file.GetFilename())

	file := &model.MediaFile{
		BaseModel:    model.BaseModel{ID: fileID},
		AssetID:      assetID,
		BatchID:      batchID,
		TaskID:       taskID,
		Role:         pf.role,
		MediaType:    pf.mediaType,
		Bucket:       uc.cfg.OSS.Bucket,
		ObjectKey:    objectKey,
		OriginalMime: normalizeMime(pf.file.GetMimeType()),
		Status:       mediav1.MediaStatus_MEDIA_STATUS_PROCESSING,
	}

	task := &mediav1.PreparedUploadTask{
		TaskId: taskID,
		Type:   pf.mediaType,
	}

	return file, task
}
