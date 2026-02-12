package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	BaseURL = "http://localhost:8000"
	//BaseURL = "https://test.api.shiningacg.club:61080"
	Bucket = "shining-bucket"
)

// MediaStatus 对应 Proto 中的枚举
type MediaStatus int32

const (
	MediaStatusUnspecified MediaStatus = 0
	MediaStatusProcessing  MediaStatus = 1
	MediaStatusCompleted   MediaStatus = 2
	MediaStatusBlocked     MediaStatus = 3
	MediaStatusFailed      MediaStatus = 4
)

// UnmarshalJSON 让结构体能够解析 "MEDIA_STATUS_COMPLETED" 这种字符串
func (s *MediaStatus) UnmarshalJSON(b []byte) error {
	var str string
	if err := json.Unmarshal(b, &str); err != nil {
		// 如果不是字符串，尝试按整数解析
		var i int32
		if err := json.Unmarshal(b, &i); err != nil {
			return err
		}
		*s = MediaStatus(i)
		return nil
	}

	switch str {
	case "MEDIA_STATUS_PROCESSING":
		*s = MediaStatusProcessing
	case "MEDIA_STATUS_COMPLETED":
		*s = MediaStatusCompleted
	case "MEDIA_STATUS_BLOCKED":
		*s = MediaStatusBlocked
	case "MEDIA_STATUS_FAILED":
		*s = MediaStatusFailed
	default:
		*s = MediaStatusUnspecified
	}
	return nil
}

func (s MediaStatus) String() string {
	switch s {
	case MediaStatusProcessing:
		return "处理中 (PROCESSING)"
	case MediaStatusCompleted:
		return "已完成 (COMPLETED)"
	case MediaStatusBlocked:
		return "违规屏蔽 (BLOCKED)"
	case MediaStatusFailed:
		return "处理失败 (FAILED)"
	default:
		return fmt.Sprintf("未知状态(%d)", s)
	}
}

// 2. 修改响应结构体的 Tag (注意 publicUrl 的大小写)
type GetUploadStatusResponse struct {
	Status       MediaStatus `json:"status"`
	PublicUrl    string      `json:"publicUrl"`    // 必须匹配 JSON 中的 publicUrl
	ThumbnailUrl string      `json:"thumbnailUrl"` // 必须匹配 JSON 中的 publicUrl
	Meta         interface{} `json:"meta"`
}

type GetUploadTokensRequest struct {
	Scene int          `json:"scene"`
	Tasks []UploadTask `json:"tasks"`
}

type UploadTask struct {
	Filename  string `json:"filename"`
	SizeBytes int64  `json:"size_bytes"`
	MimeType  string `json:"mime_type"`
}

type UploadToken struct {
	TaskId          string            `json:"taskId"`
	UploadUrl       string            `json:"uploadUrl"`
	PublicUrl       string            `json:"publicUrl"`
	RequiredHeaders map[string]string `json:"requiredHeaders"`
}

type GetUploadTokensResponse struct {
	Tokens []UploadToken `json:"tokens"`
}

type CompleteUploadRequest struct {
	TaskId    string `json:"task_id"`
	Scene     int    `json:"scene"`
	ObjectKey string `json:"object_key"`
}

func main() {
	reader := bufio.NewReader(os.Stdin)

	fmt.Println("🚀 资源上传与转码全流程测试工具")
	fmt.Println("--------------------------------")

	// 1. 获取文件
	fmt.Print("请输入本地文件路径: ")
	filePath, _ := reader.ReadString('\n')
	filePath = strings.TrimSpace(filePath)
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		fmt.Printf("❌ 无法读取文件: %v\n", err)
		return
	}

	// 2. 选择场景
	fmt.Println("\n请选择场景 (Scene):")
	fmt.Println("1: 用户头像 | 2: 帖子图片 | 3: 帖子视频")
	fmt.Print("编号 [默认 3]: ")
	sceneInput, _ := reader.ReadString('\n')
	sceneInput = strings.TrimSpace(sceneInput)
	scene := 3
	if sceneInput == "1" {
		scene = 1
	} else if sceneInput == "2" {
		scene = 2
	}

	mimeType := mime.TypeByExtension(filepath.Ext(filePath))
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	// --- 步骤 1: 获取凭证 ---
	fmt.Println("\n[步骤 1] 获取预签名 URL...")
	tokenReq := GetUploadTokensRequest{
		Scene: scene,
		Tasks: []UploadTask{{Filename: fileInfo.Name(), SizeBytes: fileInfo.Size(), MimeType: mimeType}},
	}
	tokenBody, err := postJSON(BaseURL+"/v1/resources/upload-tokens", tokenReq)
	if err != nil {
		fmt.Printf("失败: %v\n", err)
		return
	}

	var tokenResp GetUploadTokensResponse
	if err := json.Unmarshal(tokenBody, &tokenResp); err != nil {
		fmt.Printf("❌ 解析响应失败: %v\n", err)
		return
	}
	token := tokenResp.Tokens[0]
	fmt.Println(token)

	// --- 步骤 2: 上传文件 ---
	fmt.Printf("\n[步骤 2] 正在上传至 MinIO (%s)...\n", fileInfo.Name())
	fileData, err := os.Open(filePath)
	if err != nil {
		fmt.Printf("❌ 打开文件失败: %v\n", err)
		return
	}
	defer fileData.Close()

	putReq, err := http.NewRequest(http.MethodPut, token.UploadUrl, fileData)
	if err != nil {
		fmt.Printf("❌ 创建请求失败: %v\n", err)
		return
	}

	putReq.Header.Set("Content-Type", mimeType)
	putReq.ContentLength = fileInfo.Size()

	start := time.Now()
	putResp, err := http.DefaultClient.Do(putReq)
	if err != nil || putResp.StatusCode != 200 {
		if putResp != nil {
			defer putResp.Body.Close()
			body, _ := io.ReadAll(putResp.Body)
			fmt.Printf("❌ 上传失败: %v, 响应: %s\n", err, string(body))
		} else {
			fmt.Printf("❌ 上传失败: %v\n", err)
		}
		return
	}
	defer putResp.Body.Close()

	fmt.Printf("✅ 上传成功! 耗时: %v\n", time.Since(start))

	// --- 步骤 3: 通知后端 ---
	fmt.Println("\n[步骤 3] 通知后端开始处理...")
	u, _ := url.Parse(token.PublicUrl)
	objectKey := strings.TrimPrefix(u.Path, "/"+Bucket+"/")
	completeReq := CompleteUploadRequest{TaskId: token.TaskId, Scene: scene, ObjectKey: objectKey}
	_, err = postJSON(BaseURL+"/v1/resources/complete-upload", completeReq)
	if err != nil {
		fmt.Printf("失败: %v\n", err)
		return
	}

	// --- 步骤 4: 轮询状态 ---
	fmt.Println("\n[步骤 4] 正在轮询处理状态 (每 3 秒检查一次)...")
	statusURL := fmt.Sprintf("%s/v1/resources/upload-status/%s", BaseURL, token.TaskId)

	for {
		time.Sleep(3 * time.Second)
		fmt.Printf("\n发送请求到: %s\n", statusURL)
		resp, err := http.Get(statusURL)
		if err != nil {
			fmt.Printf("\n❌ 网络错误: %v", err)
			continue
		}

		fmt.Printf("响应状态码: %d\n", resp.StatusCode)

		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()

		fmt.Printf("完整响应体: %s\n", string(body))

		var statusResp GetUploadStatusResponse
		if err := json.Unmarshal(body, &statusResp); err != nil {
			fmt.Printf("❌ 解析响应失败: %v\n", err)
			continue
		}

		fmt.Printf("解析后的响应: %#v\n", statusResp)

		fmt.Printf("\r当前状态: %v  ", statusResp.Status)

		if statusResp.Status == MediaStatusCompleted {
			fmt.Println("\n\n🎉 处理圆满完成！")
			fmt.Println("--------------------------------")
			fmt.Printf("📄 最终资源 URL: %s\n", statusResp.PublicUrl)
			fmt.Println("--------------------------------")
			break
		} else if statusResp.Status == MediaStatusFailed || statusResp.Status == MediaStatusBlocked {
			fmt.Printf("\n❌ 任务终止: %s\n", statusResp.Status.String())
			break
		}
		fmt.Print("⏳")
	}
}

func postJSON(url string, data interface{}) ([]byte, error) {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return nil, err
	}

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(body))
	}

	return body, nil
}
