package repo

import (
	"embed"
	"fmt"
	"log/slog"

	"app.shiningacg.club/internal/config"
	"github.com/pressly/goose/v3"
)

// migrationFiles 将 migrations/ 目录下的所有 .sql 文件编译进二进制。
//
// 优点：
//   - 部署产物只有一个二进制，无需在服务器上维护独立的迁移目录。
//   - 迁移文件随代码版本一起发布，确保"代码版本 = 数据库 schema 版本"。
//   - 支持 `goose down` / 回滚（Down section 也嵌入了）。
//
// 注意：//go:embed 不允许 ".." 路径，因此迁移文件必须位于本包的子目录下。
//
//go:embed migrations/*.sql
var migrationFiles embed.FS

// Bootstrap 在服务启动前，使用 goose 将所有待执行的数据库迁移应用到最新版本。
//
// # 工作原理
//
// goose 在数据库中维护 goose_db_version 表来跟踪已应用的迁移版本。
// 每次 Bootstrap 只执行"尚未应用"的迁移，已应用的版本被跳过，实现幂等性。
//
// # 与旧版 HasTable+CreateTable 方案的根本区别
//
//   - 旧方案：仅能建表，无法处理后续的 ADD COLUMN / CREATE INDEX / DROP COLUMN 等变更。
//   - 新方案：通过版本化 SQL 文件追踪所有 schema 变更，可正向迁移（Up）也可回滚（Down）。
//
// # 开发者工作流（修改 internal/model 后）
//
//  1. 安装 Atlas CLI：brew install ariga/tap/atlas
//  2. 生成迁移文件：atlas migrate diff <描述> --env local
//     例：atlas migrate diff add_post_tags --env local
//  3. 检查生成的 SQL 文件（internal/repo/migrations/）后提交到 git
//  4. 重启服务，Bootstrap 自动执行新迁移
//
// # 首次部署到已有数据库（已由旧版 CreateTable 建表）
//
// 由于初始迁移使用 CREATE TABLE IF NOT EXISTS，Bootstrap 可以安全地在现有库上执行：
//   - 所有表已存在 → IF NOT EXISTS 使 SQL 成为无操作
//   - goose_db_version 被创建并记录初始迁移为"已应用"
//   - 后续新增迁移正常执行
//
// # 连接策略
//
// 使用独立短生命周期连接，Bootstrap 返回后连接关闭，不占用主应用连接池。
//
// @param cfg 应用配置，用于建立数据库连接
// @return error 迁移执行失败时返回带上下文的错误
func Bootstrap(cfg *config.Config) error {
	slog.Info("数据库迁移：开始")

	// ─── 建立短生命周期连接 ──────────────────────────────────────────────────
	db, err := NewDB(cfg)
	if err != nil {
		return fmt.Errorf("bootstrap: 建立数据库连接失败: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("bootstrap: 获取底层连接失败: %w", err)
	}
	defer func() {
		if closeErr := sqlDB.Close(); closeErr != nil {
			slog.Warn("bootstrap: 关闭迁移连接时出错", slog.Any("error", closeErr))
		}
	}()

	// ─── 配置 goose ──────────────────────────────────────────────────────────
	// 设置迁移文件来源为编译进二进制的 embed.FS，
	// 调用方不需要在运行环境中维护单独的目录。
	goose.SetBaseFS(migrationFiles)

	// 关闭 goose 默认的 log.Printf 输出，统一由 slog 记录。
	goose.SetLogger(goose.NopLogger())

	if err := goose.SetDialect("postgres"); err != nil {
		return fmt.Errorf("bootstrap: 设置 goose dialect 失败: %w", err)
	}

	// ─── 执行迁移 ────────────────────────────────────────────────────────────
	// goose.Up 将所有尚未应用的迁移按版本号升序执行。
	// 已应用的版本（goose_db_version 中有记录）被跳过。
	if err := goose.Up(sqlDB, "migrations"); err != nil {
		return fmt.Errorf("bootstrap: 执行数据库迁移失败: %w", err)
	}

	// 查询当前迁移版本，用于日志确认
	version, err := goose.GetDBVersion(sqlDB)
	if err != nil {
		// 版本查询失败不是致命错误，仅记录警告
		slog.Warn("bootstrap: 获取迁移版本失败", slog.Any("error", err))
	} else {
		slog.Info("数据库迁移：完成", slog.Int64("version", version))
	}

	return nil
}
