package media

import (
	mediav1 "app.shiningacg.club/gen/proto/api/media/v1"
	"app.shiningacg.club/pkg/pathutil"
)

func rawCategoryByType(mediaType mediav1.MediaType) string {
	if mediaType == mediav1.MediaType_MEDIA_TYPE_VIDEO {
		return pathutil.TypeVideoRaw
	}
	return pathutil.TypeImageRaw
}

func outputCategoryByScene(scene mediav1.MediaScene, mediaType mediav1.MediaType) string {
	if mediaType == mediav1.MediaType_MEDIA_TYPE_VIDEO {
		return pathutil.TypeVideoVod
	}
	switch scene {
	case mediav1.MediaScene_MEDIA_SCENE_USER_AVATAR:
		return pathutil.TypeImageAvatar
	case mediav1.MediaScene_MEDIA_SCENE_POST_COVER:
		return pathutil.TypeImageCover
	default:
		return pathutil.TypeImageCommon
	}
}

func scenePolicy(scene mediav1.MediaScene) ScenePolicy {
	switch scene {
	case mediav1.MediaScene_MEDIA_SCENE_USER_AVATAR:
		return ScenePolicy{ImageQuality: 85, MaxWidth: 512, MaxHeight: 512, ThumbWidth: 256, ThumbHeight: 256, NeedSquare: true}
	case mediav1.MediaScene_MEDIA_SCENE_POST_MEDIA:
		return ScenePolicy{ImageQuality: 80, MaxWidth: 1920, MaxHeight: 1920, ThumbWidth: 320, ThumbHeight: 240}
	case mediav1.MediaScene_MEDIA_SCENE_POST_COVER:
		return ScenePolicy{ImageQuality: 82, MaxWidth: 1600, MaxHeight: 1600, ThumbWidth: 400, ThumbHeight: 533, CropWidth: 600, CropHeight: 800}
	case mediav1.MediaScene_MEDIA_SCENE_COMMENT_MEDIA:
		return ScenePolicy{ImageQuality: 75, MaxWidth: 1280, MaxHeight: 1280, ThumbWidth: 240, ThumbHeight: 180}
	default:
		return ScenePolicy{ImageQuality: 80, MaxWidth: 1600, MaxHeight: 1600, ThumbWidth: 320, ThumbHeight: 240}
	}
}
