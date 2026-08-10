// Package config 提供应用配置的加载与结构定义。
//
// 配置说明：
//   - 本包 config.go：定义 Config 结构体及环境变量绑定，无默认值。
//   - docker-compose 为单一事实来源：所有配置必须通过 docker-compose 的 environment 注入。
//   - 本地运行需手动导出环境变量或使用 .env，否则启动将因配置缺失而失败。
package config

import (
	"fmt"
	"strings"

	"github.com/spf13/viper"
)

// ServerConfig 服务器配置
type ServerConfig struct {
	Port string
}

// DBConfig 数据库配置
type DBConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	Name     string
}

// InternalOSSConfig 内网 OSS 配置
type InternalOSSConfig struct {
	Endpoint string
	UseSSL   bool
}

// ExternalOSSConfig 外网 OSS 配置
type ExternalOSSConfig struct {
	Endpoint string
	UseSSL   bool
}

// OSSConfig 对象存储配置
type OSSConfig struct {
	Internal     InternalOSSConfig
	External     ExternalOSSConfig
	MediaBaseURL string
	AccessKey    string
	SecretKey    string
	Bucket       string
}

// SnowflakeConfig 雪花算法配置
type SnowflakeConfig struct {
	NodeID int64
}

// FFmpegConfig FFmpeg 配置
type FFmpegConfig struct {
	MaxWorkers int
	QueueSize  int
}

// LogConfig 日志配置
type LogConfig struct {
	Level       string
	Environment string
	Dir         string
	EnableFile  bool
}

// CORSConfig 跨域配置
type CORSConfig struct {
	AllowedDomains []string
}

// ImageSizeConfig 图片尺寸配置
type ImageSizeConfig struct {
	MaxWidth  int
	MaxHeight int
}

// CoverConfig 封面配置
type CoverConfig struct {
	MaxWidth   int
	MaxHeight  int
	CropWidth  int
	CropHeight int
}

// ImageConfig 图片处理配置
type ImageConfig struct {
	Avatar  ImageSizeConfig
	Post    ImageSizeConfig
	Comment ImageSizeConfig
	Cover   CoverConfig
}

// HLSConfig HLS 配置
type HLSConfig struct {
	Enabled bool
}

// VideoConfig 视频处理配置
type VideoConfig struct {
	HLS HLSConfig
}

// MediaConfig 媒体配置
type MediaConfig struct {
	Image ImageConfig
	Video VideoConfig
}

// Config 应用程序总配置
type Config struct {
	Server    ServerConfig
	DB        DBConfig
	OSS       OSSConfig
	Snowflake SnowflakeConfig
	FFmpeg    FFmpegConfig
	Log       LogConfig
	CORS      CORSConfig
	Media     MediaConfig
}

// LoadConfig 加载配置
// 仅从环境变量中读取配置，无默认值。
func LoadConfig() (*Config, error) {
	// 1. 初始化 Viper
	v := viper.New()

	// 2. 环境变量配置
	v.SetEnvPrefix("APP")                              // 前缀 APP_
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_")) // 将 oss.access_key 变为 APP_OSS_ACCESS_KEY
	v.AutomaticEnv()                                   // 自动读取匹配的环境变量

	// 3. 显式绑定环境变量 (为了兼容旧的 docker-compose 命名习惯，同时也确保能被读取)
	// 这些绑定使得 Viper 知道要去查找这些特定的 ENV key，即使结构体字段名不同
	_ = v.BindEnv("server.port", "PORT")
	_ = v.BindEnv("db.host", "DB_HOST")
	_ = v.BindEnv("db.port", "DB_PORT")
	_ = v.BindEnv("db.user", "DB_USER")
	_ = v.BindEnv("db.password", "DB_PASSWORD")
	_ = v.BindEnv("db.name", "DB_NAME")

	// MinIO / OSS
	_ = v.BindEnv("oss.internal.endpoint", "OSS_ENDPOINT")
	_ = v.BindEnv("oss.internal.use_ssl", "OSS_USE_SSL")
	_ = v.BindEnv("oss.external.endpoint", "OSS_EXTERNAL_ENDPOINT")
	_ = v.BindEnv("oss.external.use_ssl", "OSS_EXTERNAL_USE_SSL")
	_ = v.BindEnv("oss.media_base_url", "OSS_MEDIA_BASE_URL")
	_ = v.BindEnv("oss.access_key", "OSS_ACCESS_KEY")
	_ = v.BindEnv("oss.secret_key", "OSS_SECRET_KEY")
	_ = v.BindEnv("oss.bucket", "OSS_BUCKET")

	_ = v.BindEnv("snowflake.node_id", "SNOWFLAKE_NODE_ID")

	// FFmpeg 转码配置
	_ = v.BindEnv("ffmpeg.max_workers", "FFMPEG_MAX_WORKERS")
	_ = v.BindEnv("ffmpeg.queue_size", "FFMPEG_QUEUE_SIZE")

	// 日志配置绑定
	_ = v.BindEnv("log.level", "LOG_LEVEL")
	_ = v.BindEnv("log.environment", "LOG_ENVIRONMENT")
	_ = v.BindEnv("log.dir", "LOG_DIR")
	_ = v.BindEnv("log.enable_file", "LOG_ENABLE_FILE")

	// 4. 解析配置到结构体
	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("解析配置失败: %w", err)
	}

	// 5. 验证关键配置 (Fail Fast)
	// 如果关键配置缺失，应用应直接启动失败，而不是使用零值运行
	if err := validateConfig(&cfg); err != nil {
		return nil, fmt.Errorf("配置验证失败: %w", err)
	}

	return &cfg, nil
}

// validateConfig 验证关键配置是否存在
func validateConfig(cfg *Config) error {
	if cfg.Server.Port == "" {
		return fmt.Errorf("server.port (PORT) 未配置")
	}
	if cfg.DB.Host == "" {
		return fmt.Errorf("db.host (DB_HOST) 未配置")
	}
	if cfg.OSS.Internal.Endpoint == "" {
		return fmt.Errorf("oss.internal.endpoint (OSS_ENDPOINT) 未配置")
	}
	if cfg.OSS.AccessKey == "" {
		return fmt.Errorf("oss.access_key (OSS_ACCESS_KEY) 未配置")
	}
	if cfg.OSS.Bucket == "" {
		return fmt.Errorf("oss.bucket (OSS_BUCKET) 未配置")
	}
	if cfg.FFmpeg.MaxWorkers <= 0 {
		return fmt.Errorf("ffmpeg.max_workers (FFMPEG_MAX_WORKERS) 未配置或无效")
	}
	if cfg.FFmpeg.QueueSize <= 0 {
		return fmt.Errorf("ffmpeg.queue_size (FFMPEG_QUEUE_SIZE) 未配置或无效")
	}
	return nil
}

// GetDBConnectionString 获取数据库连接字符串
func (c *Config) GetDBConnectionString() string {
	return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		c.DB.Host, c.DB.Port, c.DB.User, c.DB.Password, c.DB.Name)
}
