package config

import (
	"fmt"
	"strings"

	"github.com/spf13/viper"
)

// Config 应用程序配置结构体
// 注意：Viper 默认使用 mapstructure 标签来解析结构体
type Config struct {
	Server struct {
		Port string `mapstructure:"port" yaml:"port"`
	} `mapstructure:"server"`

	DB struct {
		Host     string `mapstructure:"host" yaml:"host"`
		Port     string `mapstructure:"port" yaml:"port"`
		User     string `mapstructure:"user" yaml:"user"`
		Password string `mapstructure:"password" yaml:"password"`
		Name     string `mapstructure:"name" yaml:"name"`
	} `mapstructure:"db"`

	OSS struct {
		// 内网配置：用于后端数据传输（上传、下载、管理 Bucket）
		Internal struct {
			Endpoint string `mapstructure:"endpoint" yaml:"endpoint"`
			UseSSL   bool   `mapstructure:"use_ssl" yaml:"use_ssl"`
		} `mapstructure:"internal" yaml:"internal"`

		// 外网配置：用于生成给前端使用的签名 URL
		External struct {
			Endpoint string `mapstructure:"endpoint" yaml:"endpoint"`
			UseSSL   bool   `mapstructure:"use_ssl" yaml:"use_ssl"`
		} `mapstructure:"external" yaml:"external"`

		AccessKey string `mapstructure:"access_key" yaml:"access_key"`
		SecretKey string `mapstructure:"secret_key" yaml:"secret_key"`
		Bucket    string `mapstructure:"bucket" yaml:"bucket"`
	} `mapstructure:"oss"`

	Snowflake struct {
		NodeID int64 `mapstructure:"node_id" yaml:"node_id"`
	} `mapstructure:"snowflake"`

	FFmpeg struct {
		MaxWorkers int `mapstructure:"max_workers" yaml:"max_workers"`
		QueueSize  int `mapstructure:"queue_size" yaml:"queue_size"`
	} `mapstructure:"ffmpeg"`

	// Log 日志配置
	Log struct {
		Level string `mapstructure:"level" yaml:"level"` // debug, info, warn, error
	} `mapstructure:"log"`

	// MediaConfig 媒体处理配置
	Media struct {
		Image struct {
			// 头像配置
			Avatar struct {
				MaxWidth  int `mapstructure:"max_width" yaml:"max_width"`
				MaxHeight int `mapstructure:"max_height" yaml:"max_height"`
			} `mapstructure:"avatar"`
			// 帖子图片配置
			Post struct {
				MaxWidth  int `mapstructure:"max_width" yaml:"max_width"`
				MaxHeight int `mapstructure:"max_height" yaml:"max_height"`
			} `mapstructure:"post"`
			// 评论图片配置
			Comment struct {
				MaxWidth  int `mapstructure:"max_width" yaml:"max_width"`
				MaxHeight int `mapstructure:"max_height" yaml:"max_height"`
			} `mapstructure:"comment"`
			// 封面配置
			Cover struct {
				MaxWidth   int `mapstructure:"max_width" yaml:"max_width"`
				MaxHeight  int `mapstructure:"max_height" yaml:"max_height"`
				CropWidth  int `mapstructure:"crop_width" yaml:"crop_width"`
				CropHeight int `mapstructure:"crop_height" yaml:"crop_height"`
			} `mapstructure:"cover"`
		} `mapstructure:"image"`

		Video struct {
			// HLS 转码配置
			HLS struct {
				Enabled bool `mapstructure:"enabled" yaml:"enabled"`
			} `mapstructure:"hls"`
		} `mapstructure:"video"`
	} `mapstructure:"media"`
}

// LoadConfig 加载配置
func LoadConfig(configPath string) (*Config, error) {
	var cfg Config

	viper.SetConfigName("config") // 配置文件名（不带扩展名）
	viper.SetConfigType("yaml")   // 配置文件类型

	if configPath == "" {
		viper.AddConfigPath(".")        // 根目录
		viper.AddConfigPath("./config") // config 子目录
	} else {
		viper.AddConfigPath(configPath)
	}

	// 1. 设置默认值
	setDefaultValues()

	// 2. 读取配置文件
	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			fmt.Println("提示: 未找到 config.yaml 配置文件，将尝试从环境变量或默认值读取")
		} else {
			return nil, fmt.Errorf("读取配置文件失败: %w", err)
		}
	} else {
		fmt.Printf("成功加载配置文件: %s\n", viper.ConfigFileUsed())
	}

	// 3. 环境变量配置
	viper.SetEnvPrefix("APP")                              // 前缀 APP_
	viper.SetEnvKeyReplacer(strings.NewReplacer(".", "_")) // 将 oss.access_key 变为 APP_OSS_ACCESS_KEY
	viper.AutomaticEnv()                                   // 自动读取匹配的环境变量

	// 4. 显式绑定环境变量（修正了你之前的映射错误）
	_ = viper.BindEnv("server.port", "PORT")
	_ = viper.BindEnv("db.host", "DB_HOST")
	_ = viper.BindEnv("db.port", "DB_PORT")
	_ = viper.BindEnv("db.user", "DB_USER")
	_ = viper.BindEnv("db.password", "DB_PASSWORD")
	_ = viper.BindEnv("db.name", "DB_NAME")
	_ = viper.BindEnv("oss.endpoint", "OSS_ENDPOINT")
	_ = viper.BindEnv("oss.base_url", "OSS_BASE_URL")
	_ = viper.BindEnv("oss.access_key", "OSS_ACCESS_KEY")
	_ = viper.BindEnv("oss.secret_key", "OSS_SECRET_KEY")
	_ = viper.BindEnv("oss.bucket", "OSS_BUCKET")
	_ = viper.BindEnv("oss.use_ssl", "OSS_USE_SSL")
	_ = viper.BindEnv("snowflake.node_id", "SNOWFLAKE_NODE_ID")

	// 5. 解析到结构体
	if err := viper.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("解析配置失败: %w", err)
	}

	return &cfg, nil
}

func setDefaultValues() {
	viper.SetDefault("server.port", "8000")
	viper.SetDefault("db.host", "localhost")
	viper.SetDefault("db.port", "5432")
	viper.SetDefault("db.user", "postgres")
	viper.SetDefault("db.password", "password")
	viper.SetDefault("db.name", "shining_db")
	// 内网配置默认值
	viper.SetDefault("oss.internal.endpoint", "localhost:9000")
	viper.SetDefault("oss.internal.use_ssl", false)
	// 外网配置默认值
	viper.SetDefault("oss.external.endpoint", "test.api.shiningacg.club:61080")
	viper.SetDefault("oss.external.use_ssl", true)
	// 通用配置
	viper.SetDefault("oss.access_key", "shining")
	viper.SetDefault("oss.secret_key", "shiningoss")
	viper.SetDefault("oss.bucket", "shining-bucket")
	viper.SetDefault("snowflake.node_id", 1)
	viper.SetDefault("ffmpeg.max_workers", 4)
	viper.SetDefault("ffmpeg.queue_size", 100)

	// 日志配置默认值
	viper.SetDefault("log.level", "info")

	// 图片处理默认配置
	viper.SetDefault("media.image.avatar.max_width", 256)
	viper.SetDefault("media.image.avatar.max_height", 256)
	viper.SetDefault("media.image.post.max_width", 1080)
	viper.SetDefault("media.image.post.max_height", 0) // 0 表示保持比例
	viper.SetDefault("media.image.comment.max_width", 800)
	viper.SetDefault("media.image.comment.max_height", 0)
	viper.SetDefault("media.image.cover.max_width", 1080)
	viper.SetDefault("media.image.cover.max_height", 0)
	viper.SetDefault("media.image.cover.crop_width", 600)
	viper.SetDefault("media.image.cover.crop_height", 800)

	// 视频处理默认配置
	viper.SetDefault("media.video.hls.enabled", true)
}

// GetDBConnectionString 获取数据库连接字符串
func (c *Config) GetDBConnectionString() string {
	return fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		c.DB.Host, c.DB.Port, c.DB.User, c.DB.Password, c.DB.Name)
}
