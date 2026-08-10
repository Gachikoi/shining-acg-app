# Shining ACG 数据库架构设计

## 1. 设计变更摘要

1. **移除 Site 模块**：删除了所有与官网静态内容相关的表。
2. **公共资源层 (`sys`)**：集成了媒体资源表 (`media`)、部门表 (`departments`)
   和分区表 (`partitions`)。
3. **用户层 (`usr`)**：
   - 个人资料增加了 `external_links` (多链接) 和 `badges` (部门徽章 ID 列表)。
   - 新增 `identity_applications` 表用于处理身份认证申请（覆盖式提交）。
   - `accounts` 表集成 `role` 字段进行权限控制。
4. **管理/治理层 (`adm`)**：
   - **举报系统重构**：采用“工单(Ticket) + 记录(Record)”的双层结构。`Ticket`
     聚合被举报对象的状态和总数，`Record` 存储具体的举报证据。
   - **通知系统**：设计了通知内容与用户接收状态分离的结构。

---

## 2. Schema: `sys` (系统基础设施 & 公共资源)

此 Schema 存储全局共享的定义和资源，不涉及具体业务逻辑。

### 2.1 媒体资源表 (`media`)

**定义**: 统一存储全站（头像、帖子图片、举报证据、认证材料）的所有文件信息。

| 字段名         | 用途                     | PG 类型      | Go 类型         | 约束/索引/GORM   |
| :------------- | :----------------------- | :----------- | :-------------- | :--------------- |
| `id`           | 文件ID                   | BIGINT       | int64           | PK               |
| `media_type`   | 类型                     | INT          | int             | Not Null         |
| `storage_type` | 存储源 (minio/oss)       | VARCHAR(20)  | string          | Default: 'minio' |
| `bucket`       | 桶名                     | VARCHAR(100) | string          | -                |
| `object_key`   | 文件路径/Key             | TEXT         | string          | Not Null         |
| `status`       | 状态 (0:上传中, 1:正常)  | INT          | int32           | Default: 0       |
| `meta`         | 元数据 (宽/高/时长/大小) | JSONB        | json.RawMessage | Default: '{}'    |
| `created_at`   | 上传时间                 | TIMESTAMPTZ  | time.Time       | -                |
| `deleted_at`   | 软删除                   | TIMESTAMPTZ  | time.Time       | Index            |

### 2.2 部门表 (`departments`)

**定义**: 仅用于用户画像的“身份标识/徽章”。简单枚举表。

| 字段名       | 用途                  | PG 类型     | Go 类型   | 约束/索引/GORM |
| :----------- | :-------------------- | :---------- | :-------- | :------------- |
| `id`         | 自增ID                | SERIAL      | int       | PK             |
| `name`       | 部门名称 (如: 宣传部) | VARCHAR(50) | string    | Not Null       |
| `sort_order` | 排序权重              | INT         | int       | Default: 0     |
| `deleted_at` | 软删除                | TIMESTAMPTZ | time.Time | Index          |

### 2.3 分区表 (`partitions`)

**定义**: 用于 **帖子(Post)** 的分类。与部门表解耦，支持管理员独立编辑。

| 字段名        | 用途                  | PG 类型      | Go 类型   | 约束/索引/GORM |
| :------------ | :-------------------- | :----------- | :-------- | :------------- |
| `id`          | 分区ID                | SERIAL       | int       | PK             |
| `name`        | 分区名称 (如: 模玩区) | VARCHAR(50)  | string    | Not Null       |
| `description` | 分区描述              | VARCHAR(255) | string    | -              |
| `sort_order`  | 排序权重              | INT          | int       | Default: 0     |
| `deleted_at`  | 软删除                | TIMESTAMPTZ  | time.Time | Index          |

---

## 3. Schema: `usr` (用户中心)

### 3.1 账号与权限表 (`accounts`)

**定义**: 用户核心表，包含鉴权和系统级角色。

| 字段名        | 用途                            | PG 类型     | Go 类型   | 约束/索引/GORM |
| :------------ | :------------------------------ | :---------- | :-------- | :------------- |
| `id`          | 用户ID (Snowflake)              | BIGINT      | int64     | PK             |
| `qq_union_id` | QQ 全应用唯一标识               | VARCHAR(64) | string    | Unique Index   |
| `qq_number`   | 真实 QQ 号 (强制填)             | VARCHAR(16) | string    | Unique Index   |
| `role`        | 权限 (1:User, 2:Admin, 9:Super) | SMALLINT    | int       | Default: 1     |
| `status`      | 状态 (1:正常, 2:禁言, 3:封禁)   | SMALLINT    | int       | Default: 1     |
| `created_at`  | 注册时间                        | TIMESTAMPTZ | time.Time | -              |
| `updated_at`  | 更新时间                        | TIMESTAMPTZ | time.Time | -              |
| `deleted_at`  | 软删除                          | TIMESTAMPTZ | time.Time | Index          |

### 3.2 个人资料表 (`profiles`)

**定义**: 用户的公开展示信息。

| 字段名             | 用途                    | PG 类型      | Go 类型    | 约束/索引/GORM         |
| :----------------- | :---------------------- | :----------- | :--------- | :--------------------- |
| `user_id`          | 用户ID                  | BIGINT       | int64      | PK, FK(`usr.accounts`) |
| `nickname`         | 昵称                    | VARCHAR(64)  | string     | Index (GIN/Trigram)    |
| `avatar_media_id`  | 头像媒体ID              | BIGINT       | int64      | -                      |
| `bio`              | 简介                    | VARCHAR(255) | string     | -                      |
| `verified_title`   | **认证头衔** (如: 社长) | VARCHAR(100) | string     | -                      |
| `badges`           | **部门徽章ID列表**      | JSONB        | []int      | Default: '[]'          |
| `external_links`   | **个人链接列表**        | JSONB        | []LinkItem | Default: '[]'          |
| `stat_likes`       | 获赞数                  | INT          | int64      | Default: 0             |
| `stat_collections` | 获收藏数                | INT          | int64      | Default: 0             |
| `stat_followings`  | 关注数                  | INT          | int64      | Default: 0             |
| `stat_fans`        | 粉丝数                  | INT          | int64      | Default: 0             |

- **JSONB 结构 (`external_links`)**: `[{"label": "B站", "url": "https://..."}]`
- **JSONB 结构 (`badges`)**: `[1, 3]` (对应 `sys.departments.id`)

### 3.3 身份认证申请表 (`identity_applications`)

**定义**: 存储用户的认证申请。**设计为 UserID 主键
(1:1)**，保证“再次提交替换上一次申请”。

| 字段名               | 用途                            | PG 类型      | Go 类型   | 约束/索引/GORM         |
| :------------------- | :------------------------------ | :----------- | :-------- | :--------------------- |
| `user_id`            | 申请人ID                        | BIGINT       | int64     | PK, FK(`usr.accounts`) |
| `title`              | 申请头衔                        | VARCHAR(100) | string    | Not Null               |
| `description`        | 申请说明                        | TEXT         | string    | -                      |
| `evidence_media_ids` | 证据图片ID列表                  | JSONB        | []int64   | Default: '[]'          |
| `status`             | 状态 (0:审核中, 1:通过, 2:驳回) | SMALLINT     | int       | Index                  |
| `admin_comment`      | 管理员驳回/通过理由             | VARCHAR(255) | string    | -                      |
| `updated_at`         | 申请/审核时间                   | TIMESTAMPTZ  | time.Time | -                      |

### 3.4 偏好设置表 (`preferences`)

**定义**: 隐私与通知设置。

| 字段名            | 用途                   | PG 类型  | Go 类型      | 约束/索引/GORM         |
| :---------------- | :--------------------- | :------- | :----------- | :--------------------- |
| `user_id`         | 用户ID                 | BIGINT   | int64        | PK, FK(`usr.accounts`) |
| `notify_switch`   | 通知开关集合           | JSONB    | NotifyConfig | Default: '{}'          |
| `privacy_like`    | 点赞可见性 (0:公开...) | SMALLINT | int          | Default: 0             |
| `privacy_collect` | 收藏可见性 (0:公开...) | SMALLINT | int          | Default: 0             |
| `privacy_dm`      | 私信权限 (0:公开...)   | SMALLINT | int          | Default: 0             |

---

## 4. Schema: `app` (社区业务)

### 4.1 帖子表 (`posts`)

**定义**: 核心内容表，关联至分区。

| 字段名         | 用途                          | PG 类型      | Go 类型   | 约束/索引/GORM              |
| :------------- | :---------------------------- | :----------- | :-------- | :-------------------------- |
| `id`           | 帖子ID                        | BIGINT       | int64     | PK                          |
| `partition_id` | **所属分区ID**                | INT          | int       | Index, FK(`sys.partitions`) |
| `author_id`    | 作者ID                        | BIGINT       | int64     | Index                       |
| `title`        | 标题                          | VARCHAR(100) | string    | Index (GIN)                 |
| `content`      | 文本内容                      | TEXT         | string    | -                           |
| `media_ids`    | 媒体ID列表(可选)              | JSONB        | []int64   | -                           |
| `cover_ids`    | 封面媒体ID(可选)              | BIGINT       | int64     | -                           |
| `status`       | 状态 (0:草稿, 1:发布, 2:删除) | SMALLINT     | int       | Index                       |
| `created_at`   | 发布时间                      | TIMESTAMPTZ  | time.Time | Index                       |
| `updated_at`   | 编辑时间                      | TIMESTAMPTZ  | time.Time | -                           |
| `deleted_at`   | 软删除                        | TIMESTAMPTZ  | time.Time | Index                       |

### 4.2 互动表 (interactions)

**定义**: 统一存储点赞、收藏行为。使用联合主键防止重复操作。

| 字段名      | 用途                      | PG 类型     | Go 类型   | 约束/索引/GORM |
| ----------- | ------------------------- | ----------- | --------- | -------------- |
| user_id     | 操作用户ID                | BIGINT      | int64     | Composite PK   |
| target_id   | 目标ID (帖子/评论ID)      | BIGINT      | int64     | Composite PK   |
| target_type | 目标类型 (1:帖子, 2:评论) | SMALLINT    | int       | Composite PK   |
| action_type | 动作 (1:点赞, 2:收藏)     | SMALLINT    | int       | Composite PK   |
| created_at  | 操作时间                  | TIMESTAMPTZ | time.Time | Index          |

### 4.3 评论表 (comments)

**定义**: 帖子的评论及回复。

| 字段名    | 用途                 | PG 类型 | Go 类型 | 约束/索引/GORM      |
| --------- | -------------------- | ------- | ------- | ------------------- |
| id        | 评论ID               | BIGINT  | int64   | PK                  |
| post_id   | 所属帖子ID           | BIGINT  | int64   | Index               |
| root_id   | 根评论ID (0代表一级) | BIGINT  | int64   | Index               |
| parent_id | 父评论ID (用于回复)  | BIGINT  | int64   | -                   |
| author_id | 发布者ID             | BIGINT  | int64   | FK(usr.accounts.id) |
| content   | 评论内容             | TEXT    | string  | -                   |
| media     | 评论图片 (可选)      | JSONB   | []int64 | -                   |
| stat_like | 点赞数               | INT     | int64   | Default: 0          |

_(关联 `sys.media` 如果评论带图)_

---

## 5. Schema: `adm` (治理与管理)

此模块处理举报和通知，采用双表设计处理举报聚合。

### 5.1 举报工单表 (`report_tickets`)

**定义**: **以“被举报对象”为维度**。无论多少人举报同一个帖子，只生成一个
Ticket。用于管理员追踪处理状态。

| 字段名         | 用途                                | PG 类型      | Go 类型   | 约束/索引/GORM           |
| :------------- | :---------------------------------- | :----------- | :-------- | :----------------------- |
| `id`           | 工单ID                              | BIGINT       | int64     | PK                       |
| `target_type`  | 类型 (1:帖子, 2:评论, 3:用户)       | SMALLINT     | int       | Unique Index (Composite) |
| `target_id`    | 对象ID                              | BIGINT       | int64     | Unique Index (Composite) |
| `cnt_reports`  | **收到的举报总数**                  | INT          | int       | Default: 1               |
| `status`       | 状态 (0:待处理, 1:已忽略, 2:已封禁) | SMALLINT     | int       | Index                    |
| `processor_id` | 处理人(管理员)ID                    | BIGINT       | int64     | -                        |
| `process_note` | 处理备注                            | VARCHAR(255) | string    | -                        |
| `created_at`   | 首次被举报时间                      | TIMESTAMPTZ  | time.Time | -                        |
| `updated_at`   | 最近被举报/处理时间                 | TIMESTAMPTZ  | time.Time | Index                    |

### 5.2 举报记录表 (`report_records`)

**定义**: **以“举报者”为维度**。存储每一条具体的举报证据。

| 字段名               | 用途               | PG 类型     | Go 类型   | 约束/索引/GORM                  |
| :------------------- | :----------------- | :---------- | :-------- | :------------------------------ |
| `id`                 | 记录ID             | BIGINT      | int64     | PK                              |
| `ticket_id`          | 关联的工单ID       | BIGINT      | int64     | Index, FK(`adm.report_tickets`) |
| `reporter_id`        | 举报人ID           | BIGINT      | int64     | Index                           |
| `reason`             | 举报理由/类型      | VARCHAR(50) | string    | -                               |
| `description`        | 详细说明           | TEXT        | string    | -                               |
| `evidence_media_ids` | **证据媒体ID列表** | JSONB       | []int64   | Default: '[]'                   |
| `created_at`         | 举报时间           | TIMESTAMPTZ | time.Time | -                               |

### 5.3 系统通知内容表 (`system_notifications`)

**定义**: 管理员发布的通知内容本体（如“系统维护通知”）。

| 字段名         | 用途                      | PG 类型      | Go 类型   | 约束/索引/GORM |
| :------------- | :------------------------ | :----------- | :-------- | :------------- |
| `id`           | 通知ID                    | BIGINT       | int64     | PK             |
| `title`        | 标题                      | VARCHAR(100) | string    | -              |
| `content`      | 内容                      | TEXT         | string    | -              |
| `media`        | 图片 (可选)               | JSONB        | []int64   | -              |
| `type`         | 类型 (系统/活动)          | SMALLINT     | int       | -              |
| `target_scope` | 范围 (0:全员, 1:特定用户) | SMALLINT     | int       | -              |
| `sender_id`    | 发送人ID                  | BIGINT       | int64     | -              |
| `created_at`   | 发送时间                  | TIMESTAMPTZ  | time.Time | Index          |

_(注：用户侧的通知列表通常是 `app` 业务层产生的动态消息与 `adm`
层的系统通知的聚合，或者需要一个 `usr.inbox`
表来存储已读状态，视具体IM/消息系统设计而定)_

---

## 6. Schema: analytics (埋点预留)

### 6.1 通用事件表 (events)

**定义**: 预留给未来埋点系统，结构应当通用。

| 字段名     | 用途                         | PG 类型     | Go 类型        | 约束/索引/GORM           |
| ---------- | ---------------------------- | ----------- | -------------- | ------------------------ |
| id         | 事件ID                       | BIGINT      | int64          | PK                       |
| event_name | 事件名 (view_post, click_ad) | VARCHAR(64) | string         | Index                    |
| user_id    | 用户ID (0表示游客)           | BIGINT      | int64          | Index                    |
| properties | 事件属性 (JSON)              | JSONB       | map[string]any | -                        |
| ip_address | IP地址                       | INET        | string         | -                        |
| created_at | 发生时间                     | TIMESTAMPTZ | time.Time      | Partition Key (按月分表) |

---

---

## 7. 模型变更总结

1. **媒体处理 (`sys.media`)**:
   现在所有涉及图片/视频的表（帖子、评论、举报证据、认证材料）都只存储
   `media_id` 或 `media_ids` (JSONB Array)，不再直接存储 URL。
2. **部门 vs 分区**:
   - **User Badges** -> 关联 `sys.departments` (软删除，纯 ID/Name)。
   - **Post Partition** -> 关联 `sys.partitions` (软删除，支持描述和排序)。
3. **身份认证**: 使用 Upsert 逻辑（`ON CONFLICT (user_id) DO UPDATE`）配合
   `usr.identity_applications` 表实现“替换上一次申请”。
4. **分区删除**: `sys.partitions` 包含
   `DeletedAt`。业务逻辑层需注意，当一个分区被软删除后，该分区的帖子在查询时需决定是“不可见”还是“显示为未知分区”。通常做法是查询帖子时
   Join 分区表并过滤 `partitions.deleted_at IS NULL`。
