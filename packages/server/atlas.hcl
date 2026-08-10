# atlas.hcl — Atlas 迁移配置
# =============================================================================
#
# 安装 Atlas CLI（macOS）：
#   brew install ariga/tap/atlas
#
# 开发者工作流（修改 internal/model 后）：
#   1. 生成迁移文件（Atlas 自动 diff GORM model 与数据库现状）
#      atlas migrate diff <描述名> --env local
#      例：atlas migrate diff add_post_tags --env local
#
#   2. 检查生成的 SQL（internal/repo/migrations/ 目录下）
#      确认 SQL 符合预期后提交到 git
#
#   3. 服务重启时 Bootstrap() 自动执行新迁移（goose embed）
#
# 迁移文件命名规则（goose 格式）：
#   <version>_<description>.sql
#   例：20260301000001_init_schema.sql
#
# =============================================================================

# GORM schema 加载器：通过 go run 执行 cmd/migrate/loader.go，
# 将所有 GORM model 序列化为 Atlas 可识别的 SQL 期望状态。
data "external_schema" "gorm" {
  program = [
    "go",
    "run",
    "-mod=mod",
    "./cmd/migrate",
  ]
}

# 本地开发环境
env "local" {
  # Atlas 期望的 schema 来源：GORM model 定义
  src = data.external_schema.gorm.url

  # dev 数据库：Atlas 用于计算 diff 的临时沙箱数据库。
  # 使用 Docker 自动创建和销毁，不影响本地开发数据库。
  # 前提：本地 Docker 已运行。
  dev = "docker://postgres/17/dev?search_path=public"

  # 迁移文件目录和格式
  migration {
    dir    = "file://internal/repo/migrations"
    format = goose  # 与 Bootstrap() 中使用的 goose 保持一致
  }

  # 生成 SQL 的格式化风格（两空格缩进，便于阅读）
  format {
    migrate {
      diff = "{{ sql . \"  \" }}"
    }
  }
}

# 本地开发环境（使用已启动的 Postgres 空库作为 dev，避免 docker:// 拉取/超时）
# 使用前需先创建空库：docker exec postgres-dev psql -U postgres -c "CREATE DATABASE shining_db_atlas_dev;"
env "local_dev" {
  src = data.external_schema.gorm.url
  dev = "postgres://postgres:password@localhost:5433/shining_db_atlas_dev?search_path=public&sslmode=disable"

  migration {
    dir    = "file://internal/repo/migrations"
    format = goose
  }

  format {
    migrate {
      diff = "{{ sql . \"  \" }}"
    }
  }
}

# 生产/开发服务器环境（用于 atlas migrate apply 或 atlas schema inspect）
# DATABASE_URL 格式：postgres://user:password@host:5432/dbname?sslmode=disable
env "prod" {
  src = data.external_schema.gorm.url
  url = getenv("DATABASE_URL")

  migration {
    dir    = "file://internal/repo/migrations"
    format = goose
  }
}
