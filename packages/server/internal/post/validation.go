package post

import (
	"context"
	"strings"

	mediav1 "app.shiningacg.club/gen/proto/api/media/v1"
	"app.shiningacg.club/internal/apperr"
)

// ValidateMediaAssets 校验创建帖子时引用的媒体资产列表：
//   - 每个 asset 不为空且 asset_id 不为空
//   - order_index 非负且无重复
//   - 所有 asset 及其内部文件均已完成处理
func ValidateMediaAssets(_ context.Context, mediaAssets []*mediav1.MediaAsset) error {
	seenOrderIndex := make(map[int32]struct{}, len(mediaAssets))
	for _, asset := range mediaAssets {
		if asset == nil {
			return apperr.InvalidArgument("media asset is required")
		}
		if strings.TrimSpace(asset.GetAssetId()) == "" {
			return apperr.InvalidArgument("media asset_id is required")
		}
		orderIndex := asset.GetOrderIndex()
		if orderIndex < 0 {
			return apperr.InvalidArgument("media %s has invalid order_index", asset.GetAssetId())
		}
		if _, exists := seenOrderIndex[orderIndex]; exists {
			return apperr.InvalidArgument("duplicate media order_index: %d", orderIndex)
		}
		seenOrderIndex[orderIndex] = struct{}{}
		switch asset.GetType() {
		case mediav1.MediaType_MEDIA_TYPE_IMAGE, mediav1.MediaType_MEDIA_TYPE_VIDEO:
			single := asset.GetSingle()
			if single == nil {
				return apperr.InvalidArgument("media %s single content is required", asset.GetAssetId())
			}
			if asset.GetStatus() != mediav1.MediaStatus_MEDIA_STATUS_COMPLETED || single.GetStatus() != mediav1.MediaStatus_MEDIA_STATUS_COMPLETED {
				return apperr.FailedPrecondition("media %s is not completed", asset.GetAssetId())
			}
		case mediav1.MediaType_MEDIA_TYPE_LIVE_PHOTO:
			lp := asset.GetLivePhoto()
			if lp == nil || lp.GetImage() == nil || lp.GetVideo() == nil {
				return apperr.InvalidArgument("live photo %s requires image and video", asset.GetAssetId())
			}
			if asset.GetStatus() != mediav1.MediaStatus_MEDIA_STATUS_COMPLETED ||
				lp.GetImage().GetStatus() != mediav1.MediaStatus_MEDIA_STATUS_COMPLETED ||
				lp.GetVideo().GetStatus() != mediav1.MediaStatus_MEDIA_STATUS_COMPLETED {
				return apperr.FailedPrecondition("live photo %s is not completed", asset.GetAssetId())
			}
		default:
			return apperr.InvalidArgument("unsupported media type for asset %s", asset.GetAssetId())
		}
	}
	return nil
}
