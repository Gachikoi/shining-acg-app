// loader.go 是 Atlas 的 GORM schema 加载器，由 atlas.hcl 中通过 go run ./cmd/migrate 调用。
// 主应用入口为 cmd/main.go，构建 ./cmd 时不会包含本包（不同 main 包）。
//
// 作用：
//
//	Atlas 通过 `go run ./cmd/migrate` 调用本程序，
//	本程序将所有 GORM model 的 schema 定义（表名、列类型、索引等）
//	序列化为 Atlas 可识别的 SQL HCL 格式输出到标准输出。
//	Atlas 拿到这份"期望状态"后与数据库"现有状态"做 diff，
//	自动生成精确的增量迁移 SQL，避免手写 DDL。
//
// 使用方式（开发者工作流）：
//
//	# 修改了 internal/model 中的任何结构体后，生成迁移文件
//	atlas migrate diff <描述名称> --env local
//
//	# 例：新增了一个字段
//	atlas migrate diff add_post_tags --env local
//
// 生成的迁移文件位于 internal/repo/migrations/，格式兼容 goose，
// 由服务启动时的 Bootstrap() 函数自动执行。
package main

import (
	"fmt"
	"os"

	"app.shiningacg.club/internal/model"
	"ariga.io/atlas-provider-gorm/gormschema"
)

func main() {
	// 向 Atlas 注册所有需要纳入 schema 管理的 GORM model。
	// 顺序：先依赖后引用，便于阅读；物理外键已禁用，顺序不影响正确性。
	stmts, err := gormschema.New("postgres").Load(
		// 基础字典表
		&model.Department{},
		&model.Partition{},
		// 媒体系统
		&model.MediaAsset{},
		&model.MediaFile{},
		// 用户体系
		&model.User{},
		&model.UserRemark{},
		&model.UserSettings{},
		&model.Device{},
		&model.VerificationApplication{},
		// 内容体系
		&model.Post{},
		&model.Comment{},
		// 社交关系
		&model.Follow{},
		&model.Interaction{},
		// 通知 & 举报
		&model.Notification{},
		&model.ReportTicket{},
		&model.ReportRecord{},
	)
	if err != nil {
		fmt.Fprintf(os.Stderr, "atlas loader: 加载 GORM schema 失败: %v\n", err)
		os.Exit(1)
	}
	// 将 schema 输出到 stdout，Atlas CLI 读取并用于 diff 计算
	fmt.Print(stmts)
}
