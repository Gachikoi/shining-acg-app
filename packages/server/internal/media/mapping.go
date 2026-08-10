package media

import (
	"strconv"

	mediav1 "app.shiningacg.club/gen/proto/api/media/v1"
	"app.shiningacg.club/internal/model"
)

func (uc *UseCase) fileToInfo(file *model.MediaFile, mediaAsset *model.MediaAsset) *mediav1.MediaFileInfo {
	var thumbnailURL *string
	if file.ThumbnailKey != "" {
		url := uc.s3.GetObjectURL(file.ThumbnailKey)
		thumbnailURL = &url
	}

	return &mediav1.MediaFileInfo{
		TaskId: file.TaskID,
		File: &mediav1.MediaFile{
			FileId:       strconv.FormatInt(file.ID, 10),
			Type:         file.MediaType,
			Bucket:       file.Bucket,
			ObjectKey:    file.ObjectKey,
			Url:          uc.s3.GetObjectURL(file.ObjectKey),
			ThumbnailUrl: thumbnailURL,
			Status:       file.Status,
			Meta:         file.ProcessedMeta,
		},
		AssetId: strconv.FormatInt(file.AssetID, 10),
		Scene:   mediaAsset.Scene,
	}
}
