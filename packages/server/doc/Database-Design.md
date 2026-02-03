# Shining ACG 数据库设计文档

## 概述

本文档描述了 Shining ACG 后端服务的数据库设计，采用 PostgreSQL 作为主数据库，使用 GORM v1.25+ 作为 ORM 框架。系统分为三个物理微服务，每个微服务有独立的数据库 schema。

## 设计原则

1. **微服务架构**：每个微服务拥有独立的数据库 schema，确保数据隔离和服务解耦
2. **一致性**：使用外键约束和事务保证数据一致性
3. **性能优化**：为常用查询字段创建索引
4. **可扩展性**：设计灵活的表结构，支持未来功能扩展
5. **安全性**：对敏感字段进行适当处理（如密码加密）

---

## 1. 公共基础

### 数据类型约定

`ID`字段统一使用 **雪花算法** 生成，全局唯一且递增，以便实现游标查询。
- 数据库：`BIGINT` 类型
- 后端：`int64` 类型
- 前端：由于 int64 在js中会溢出，需要用 string 类型接收

### 通用字段

所有表都包含以下通用字段：

```go
type BaseModel struct {
    ID        int64          `gorm:"primaryKey;autoIncrement:false" json:"id,string"`
    CreatedAt time.Time      `gorm:"type:timestamptz;not null;default:now()" json:"created_at"`
    UpdatedAt time.Time      `gorm:"type:timestamptz;not null;default:now()" json:"updated_at"`
    DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}
```

---

## 2. User Core (用户核心微服务)

### Schema: `user_core`

#### 2.1 用户表 (`users`)

存储用户基本信息

```go
type User struct {
    BaseModel
    QQID           string         `gorm:"type:varchar(32);uniqueIndex;not null" json:"qq_id"`
    Nickname       string         `gorm:"type:varchar(100);not null" json:"nickname"`
    Avatar         string         `gorm:"type:text" json:"avatar"`
    Intro          string         `gorm:"type:text" json:"intro"`
    QQNumber       string         `gorm:"type:varchar(20)" json:"qq_number"`
    PrimaryDepartment Department   `gorm:"type:int;not null;default:0" json:"primary_department"`
    Departments    []Department   `gorm:"type:int[]" json:"departments"` // 加入的所有部门
    IsVerified     bool           `gorm:"default:false" json:"is_verified"`
    VerifiedTitle  string         `gorm:"type:varchar(100)" json:"verified_title"`
    Role           Role           `gorm:"type:int;not null;default:1" json:"role"` // 1=用户, 2=管理员, 3=超级管理员
    ExternalLinks  []ExternalLink `gorm:"foreignKey:UserID" json:"external_links"`

    // 统计信息
    FollowerCount        int64 `gorm:"default:0" json:"follower_count"`
    FollowingCount       int64 `gorm:"default:0" json:"following_count"`
    PostCount            int64 `gorm:"default:0" json:"post_count"`
    LikeAndCollectionCount int64 `gorm:"default:0" json:"like_and_collection_count"`

    // 系统设置
    EnablePushNotifications bool `gorm:"default:true" json:"enable_push_notifications"`

    // 隐私设置
    MessagePermission      PrivacyLevel `gorm:"default:0" json:"message_permission"`
    CollectionVisibility   PrivacyLevel `gorm:"default:0" json:"collection_visibility"`
    LikeVisibility         PrivacyLevel `gorm:"default:0" json:"like_visibility"`
}

// 部门枚举
type Department int

const (
    DepartmentUnspecified     Department = 0
    DepartmentLightMusic      Department = 1  // 轻音部
    DepartmentWota            Department = 2  // WOTA
    DepartmentTouhou          Department = 3  // 东方组
    DepartmentLiterature      Department = 4  // 轻文部
    DepartmentModelPlastic    Department = 5  // 模玩部
    DepartmentPublicity       Department = 6  // 宣传部
    DepartmentActivity        Department = 7  // 活动部
    DepartmentCosplay         Department = 8  // COS 部
    DepartmentOtakudance      Department = 9  // 宅舞部
    DepartmentAnime           Department = 10 // 动漫研
    DepartmentVideo           Department = 11 // 视频组
    DepartmentMusicGame       Department = 12 // 音游组
    DepartmentVTube           Department = 13 // V 曲组
    DepartmentMinecraft       Department = 14 // MC 组
)

// 角色枚举
type Role int

const (
    RoleVisitor      Role = 0
    RoleUser         Role = 1
    RoleAdmin        Role = 2
    RoleSuperAdmin   Role = 3
)

// 隐私级别枚举
type PrivacyLevel int

const (
    PrivacyLevelPublic        PrivacyLevel = 0  // 全员公开
    PrivacyLevelFollowers     PrivacyLevel = 1  // 粉丝可见
    PrivacyLevelMutualFollow  PrivacyLevel = 2  // 互关可见
    PrivacyLevelPrivate       PrivacyLevel = 3  // 仅自己可见
)

// 外部链接
type ExternalLink struct {
    BaseModel
    UserID uuid.UUID `gorm:"not null;index" json:"-"`
    Label  string    `gorm:"type:varchar(100);not null" json:"label"`
    URL    string    `gorm:"type:text;not null" json:"url"`
}
```

**约束：**
- `qq_id` 唯一索引，确保每个 QQ 用户只有一个账户
- `primary_department` 非空，默认值为 0（未定义）
- `role` 非空，默认值为 1（普通用户）

#### 2.2 用户关系表 (`user_relationships`)

存储用户关注关系

```go
type UserRelationship struct {
    BaseModel
    FollowerID uuid.UUID `gorm:"not null;index:idx_follower" json:"follower_id"`
    FollowingID uuid.UUID `gorm:"not null;index:idx_following" json:"following_id"`
    Remark      string    `gorm:"type:varchar(100)" json:"remark"` // 备注
}
```

**约束：**
- `(follower_id, following_id)` 复合唯一索引，防止重复关注
- 外键约束：`follower_id` 和 `following_id` 都参考 `users.id`

#### 2.3 用户会话表 (`user_sessions`)

存储用户登录会话信息

```go
type UserSession struct {
    BaseModel
    UserID        uuid.UUID `gorm:"not null;index" json:"user_id"`
    SessionToken  string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"session_token"`
    RefreshToken  string    `gorm:"type:varchar(255);uniqueIndex;not null" json:"refresh_token"`
    DeviceInfo    string    `gorm:"type:text" json:"device_info"`
    ExpiresAt     time.Time `gorm:"type:timestamptz;not null" json:"expires_at"`
    LastActiveAt  time.Time `gorm:"type:timestamptz;not null" json:"last_active_at"`
}
```

**约束：**
- `session_token` 和 `refresh_token` 唯一索引
- 外键约束：`user_id` 参考 `users.id`

#### 2.4 举报表 (`reports`)

存储用户举报信息

```go
type Report struct {
    BaseModel
    ReporterID  uuid.UUID   `gorm:"not null;index" json:"reporter_id"`
    TargetID    uuid.UUID   `gorm:"not null;index" json:"target_id"`
    Type        ReportType  `gorm:"type:int;not null" json:"type"`
    Reason      string      `gorm:"type:varchar(200);not null" json:"reason"`
    Description string      `gorm:"type:text" json:"description"`
    Status      ReportStatus `gorm:"type:int;not null;default:0" json:"status"`
    Action      ReportAction `gorm:"type:int" json:"action"`
    ResolverID  uuid.UUID   `gorm:"index" json:"resolver_id"`
    ResolvedAt  time.Time   `gorm:"type:timestamptz" json:"resolved_at"`
    Note        string      `gorm:"type:text" json:"note"`
}

// 举报类型
type ReportType int

const (
    ReportTypePost    ReportType = 0
    ReportTypeComment ReportType = 1
    ReportTypeUser    ReportType = 2
)

// 举报状态
type ReportStatus int

const (
    ReportStatusPending ReportStatus = 0
    ReportStatusResolved ReportStatus = 1
)

// 处理动作
type ReportAction int

const (
    ReportActionIgnore ReportAction = 0
    ReportActionBan    ReportAction = 1
    ReportActionDelete ReportAction = 2
)
```

**约束：**
- `type` 非空，只能是 0、1、2
- `status` 非空，默认值为 0（待处理）

---

## 3. Community (社区内容微服务)

### Schema: `community`

#### 3.1 分区表 (`partitions`)

存储帖子分区信息

```go
type Partition struct {
    BaseModel
    Name        string `gorm:"type:varchar(100);not null;uniqueIndex" json:"name"`
    Description string `gorm:"type:text" json:"description"`
    Icon        string `gorm:"type:text" json:"icon"`
    SortOrder   int    `gorm:"not null;default:0" json:"sort_order"`
    IsActive    bool   `gorm:"not null;default:true" json:"is_active"`
}
```

**约束：**
- `name` 唯一索引，分区名称不能重复
- `sort_order` 用于控制分区显示顺序

#### 3.2 帖子表 (`posts`)

存储用户发布的帖子

```go
type Post struct {
    BaseModel
    AuthorID         uuid.UUID   `gorm:"not null;index" json:"author_id"`
    Title            string      `gorm:"type:varchar(200);not null" json:"title"`
    Content          string      `gorm:"type:text" json:"content"`
    Media            []Media     `gorm:"foreignKey:PostID" json:"media"`
    PartitionID      uuid.UUID   `gorm:"not null;index" json:"partition_id"`
    PartitionName    string      `gorm:"type:varchar(100);not null" json:"partition_name"`

    // 统计信息
    LikeCount        int64       `gorm:"default:0" json:"like_count"`
    CommentCount     int64       `gorm:"default:0" json:"comment_count"`
    CollectCount     int64       `gorm:"default:0" json:"collect_count"`
    ViewCount        int64       `gorm:"default:0" json:"view_count"`

    // 审核状态
    IsVisible        bool        `gorm:"not null;default:true" json:"is_visible"`
    IsDeleted        bool        `gorm:"not null;default:false" json:"is_deleted"`
}

// 媒体资源
type Media struct {
    BaseModel
    PostID     uuid.UUID `gorm:"not null;index" json:"-"`
    Type       string    `gorm:"type:varchar(20);not null" json:"type"` // "image" | "video"
    URL        string    `gorm:"type:text;not null" json:"url"`
    Thumbnail  string    `gorm:"type:text" json:"thumbnail"` // 缩略图（视频用）
    Width      int       `json:"width"`
    Height     int       `json:"height"`
}
```

**约束：**
- `author_id` 外键约束，参考 `user_core.users.id`
- `partition_id` 外键约束，参考 `partitions.id`

#### 3.3 评论表 (`comments`)

存储帖子评论和回复

```go
type Comment struct {
    BaseModel
    AuthorID        uuid.UUID   `gorm:"not null;index" json:"author_id"`
    PostID          uuid.UUID   `gorm:"not null;index" json:"post_id"`
    RootID          uuid.UUID   `gorm:"index" json:"root_id"` // 一级评论ID，用于回复
    ReplyToUserID   uuid.UUID   `gorm:"index" json:"reply_to_user_id"`
    Content         string      `gorm:"type:text;not null" json:"content"`
    LikeCount       int64       `gorm:"default:0" json:"like_count"`
    IsDeleted       bool        `gorm:"not null;default:false" json:"is_deleted"`
}
```

**约束：**
- `author_id` 外键约束，参考 `user_core.users.id`
- `post_id` 外键约束，参考 `posts.id`

#### 3.4 互动表 (`interactions`)

存储用户对帖子和评论的点赞、收藏等互动

```go
type Interaction struct {
    BaseModel
    UserID     uuid.UUID    `gorm:"not null;index" json:"user_id"`
    TargetID   uuid.UUID    `gorm:"not null;index" json:"target_id"`
    TargetType TargetType   `gorm:"type:int;not null" json:"target_type"`
    ActionType ActionType   `gorm:"type:int;not null" json:"action_type"`
    IsActive   bool         `gorm:"not null;default:true" json:"is_active"`
}

// 互动目标类型
type TargetType int

const (
    TargetTypePost    TargetType = 0
    TargetTypeComment TargetType = 1
)

// 互动动作类型
type ActionType int

const (
    ActionTypeLike     ActionType = 0
    ActionTypeCollect  ActionType = 1
)
```

**约束：**
- `(user_id, target_id, target_type, action_type)` 复合唯一索引，防止重复互动
- `user_id` 外键约束，参考 `user_core.users.id`

#### 3.5 官网内容表 (`site_contents`)

存储官网的各类静态内容

```go
type SiteContent struct {
    BaseModel
    Type        SiteContentType `gorm:"type:int;not null;index" json:"type"`
    Year        int             `gorm:"index" json:"year"` // 用于按年份查询（如部长宣言）
    Content     jsonb           `gorm:"not null" json:"content"` // 存储具体内容的 JSON
}

// 官网内容类型
type SiteContentType int

const (
    SiteContentTypeHistory    SiteContentType = 0  // 发展历程
    SiteContentTypeActivity   SiteContentType = 1  // 活动信息
    SiteContentTypeDepartment SiteContentType = 2  // 部门信息
    SiteContentTypeMinister   SiteContentType = 3  // 部长宣言
    SiteContentTypeStaff      SiteContentType = 4  // 网站 Staff
)
```

**约束：**
- `type` 非空，只能是 0-4
- `content` 为 JSONB 类型，支持索引查询

---

## 4. Messenger (即时通讯微服务)

### Schema: `messenger`

#### 4.1 消息表 (`messages`)

存储用户之间的私信

```go
type Message struct {
    BaseModel
    SenderID    uuid.UUID    `gorm:"not null;index" json:"sender_id"`
    ReceiverID  uuid.UUID    `gorm:"not null;index" json:"receiver_id"`
    Type        MessageType  `gorm:"type:int;not null;default:1" json:"type"`
    Content     string       `gorm:"type:text;not null" json:"content"`
    SentAt      time.Time    `gorm:"type:timestamptz;not null;default:now()" json:"sent_at"`
    IsRead      bool         `gorm:"not null;default:false" json:"is_read"`
    Status      MessageStatus `gorm:"type:int;not null;default:1" json:"status"`
}

// 消息类型
type MessageType int

const (
    MessageTypeUnspecified MessageType = 0
    MessageTypeText        MessageType = 1
    MessageTypeImage       MessageType = 2
    MessageTypeVideo       MessageType = 3
    MessageTypeAudio       MessageType = 4
)

// 消息状态
type MessageStatus int

const (
    MessageStatusSending  MessageStatus = 0
    MessageStatusSuccess  MessageStatus = 1
    MessageStatusFailed   MessageStatus = 2
)
```

**约束：**
- `sender_id` 和 `receiver_id` 外键约束，参考 `user_core.users.id`
- `type` 非空，默认值为 1（文本消息）

#### 4.2 通知表 (`notifications`)

存储用户的通知信息

```go
type Notification struct {
    BaseModel
    UserID         uuid.UUID              `gorm:"not null;index" json:"user_id"`
    Action         NotificationAction     `gorm:"type:int;not null" json:"action"`
    Title          string                 `gorm:"type:varchar(200);not null" json:"title"`
    Content        string                 `gorm:"type:text" json:"content"`
    TargetID       uuid.UUID              `gorm:"index" json:"target_id"`
    TargetType     string                 `gorm:"type:varchar(50)" json:"target_type"` // "post" | "comment"
    Actors         []uuid.UUID            `gorm:"type:uuid[]" json:"actors"` // 参与用户ID列表
    TotalActorsCount int64                `gorm:"default:1" json:"total_actors_count"`
    IsRead         bool                   `gorm:"not null;default:false" json:"is_read"`
}

// 通知动作类型
type NotificationAction int

const (
    NotificationActionUnspecified    NotificationAction = 0
    NotificationActionLike           NotificationAction = 1
    NotificationActionCollection     NotificationAction = 2
    NotificationActionComment        NotificationAction = 3
    NotificationActionMention        NotificationAction = 4
    NotificationActionFollow         NotificationAction = 5
    NotificationActionSystem         NotificationAction = 6
    NotificationActionReportFeedback NotificationAction = 7
)
```

**约束：**
- `user_id` 外键约束，参考 `user_core.users.id`
- `action` 非空，用于区分通知类型

---

## 5. 数据库初始化脚本

```sql
-- 创建 schema
CREATE SCHEMA IF NOT EXISTS user_core;
CREATE SCHEMA IF NOT EXISTS community;
CREATE SCHEMA IF NOT EXISTS messenger;

-- 设置搜索路径
SET search_path TO user_core, community, messenger, public;

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 创建分区表的基础数据
INSERT INTO community.partitions (id, created_at, updated_at, name, description, sort_order, is_active) VALUES
(gen_random_uuid(), now(), now(), '模玩', '分享模型手办的制作与收藏', 1, true),
(gen_random_uuid(), now(), now(), '绘画', '展示绘画作品和创作过程', 2, true),
(gen_random_uuid(), now(), now(), '轻文', '发布原创小说和散文', 3, true),
(gen_random_uuid(), now(), now(), 'cosplay', '分享 cosplay 作品和经验', 4, true),
(gen_random_uuid(), now(), now(), '宅舞', '交流宅舞学习和表演', 5, true),
(gen_random_uuid(), now(), now(), '音游', '讨论音乐游戏技巧', 6, true),
(gen_random_uuid(), now(), now(), '动漫研', '分享动漫资源和讨论', 7, true),
(gen_random_uuid(), now(), now(), '轻音部', '轻音乐社团活动', 8, true),
(gen_random_uuid(), now(), now(), 'WOTA', 'WOTA 艺交流', 9, true),
(gen_random_uuid(), now(), now(), '东方组', '东方 Project 相关内容', 10, true),
(gen_random_uuid(), now(), now(), 'V曲组', 'Vocaloid 音乐创作', 11, true),
(gen_random_uuid(), now(), now(), 'MC组', 'Minecraft 游戏交流', 12, true),
(gen_random_uuid(), now(), now(), '视频组', '视频制作和剪辑', 13, true),
(gen_random_uuid(), now(), now(), '宣传部', '社团宣传和推广', 14, true),
(gen_random_uuid(), now(), now(), '活动部', '社团活动组织', 15, true);
```

---

## 6. 索引优化建议

### 6.1 User Core 索引

```sql
-- 用户表
CREATE INDEX idx_users_primary_department ON user_core.users (primary_department);
CREATE INDEX idx_users_role ON user_core.users (role);
CREATE INDEX idx_users_is_verified ON user_core.users (is_verified);

-- 用户关系表
CREATE UNIQUE INDEX idx_user_relationships_unique ON user_core.user_relationships (follower_id, following_id);
CREATE INDEX idx_user_relationships_following ON user_core.user_relationships (following_id);

-- 会话表
CREATE INDEX idx_user_sessions_expires ON user_core.user_sessions (expires_at);

-- 举报表
CREATE INDEX idx_reports_status ON user_core.reports (status);
CREATE INDEX idx_reports_type ON user_core.reports (type);
```

### 6.2 Community 索引

```sql
-- 帖子表
CREATE INDEX idx_posts_author ON community.posts (author_id);
CREATE INDEX idx_posts_partition ON community.posts (partition_id);
CREATE INDEX idx_posts_created ON community.posts (created_at DESC);
CREATE INDEX idx_posts_visibility ON community.posts (is_visible, is_deleted);

-- 评论表
CREATE INDEX idx_comments_post ON community.comments (post_id);
CREATE INDEX idx_comments_root ON community.comments (root_id);
CREATE INDEX idx_comments_author ON community.comments (author_id);
CREATE INDEX idx_comments_created ON community.comments (created_at DESC);

-- 互动表
CREATE UNIQUE INDEX idx_interactions_unique ON community.interactions (user_id, target_id, target_type, action_type);
CREATE INDEX idx_interactions_target ON community.interactions (target_id, target_type);
CREATE INDEX idx_interactions_user_action ON community.interactions (user_id, action_type);

-- 官网内容表
CREATE INDEX idx_site_contents_type ON community.site_contents (type);
CREATE INDEX idx_site_contents_year ON community.site_contents (year);
```

### 6.3 Messenger 索引

```sql
-- 消息表
CREATE INDEX idx_messages_sender ON messenger.messages (sender_id, sent_at DESC);
CREATE INDEX idx_messages_receiver ON messenger.messages (receiver_id, sent_at DESC);
CREATE INDEX idx_messages_conversation ON messenger.messages (least(sender_id, receiver_id), greatest(sender_id, receiver_id), sent_at DESC);

-- 通知表
CREATE INDEX idx_notifications_user ON messenger.notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON messenger.notifications (user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_action ON messenger.notifications (user_id, action, created_at DESC);
```

---

## 7. 数据同步与一致性

### 7.1 微服务间数据访问

各微服务原则上只能访问自己的 schema，但在某些情况下需要跨 schema 查询：

1. **User Core → Community**：查询用户发布的帖子（通过 author_id 外键）
2. **Community → User Core**：获取用户信息（通过 author_id 外键）
3. **Messenger → User Core**：获取用户信息（通过 sender_id/receiver_id 外键）

### 7.2 数据一致性保证

- 使用外键约束保证引用完整性
- 重要操作使用事务保证一致性
- 异步消息队列处理非实时数据同步

---

## 8. 性能优化建议

### 8.1 查询优化

1. 避免全表扫描，确保查询条件使用索引字段
2. 对于大数据量表（如 posts、comments、messages），使用分页查询
3. 对频繁访问的数据使用 Redis 缓存

### 8.2 写入优化

1. 对于频繁更新的统计字段（如点赞数、评论数），考虑使用异步更新或缓存
2. 避免在事务中执行大量写入操作
3. 使用批量插入处理大量数据

### 8.3 存储优化

1. 定期清理无效数据（如已删除的帖子、过期的会话）
2. 对大字段（如 content）进行压缩存储
3. 使用分区表处理时间序列数据（如 messages、notifications）

---

## 9. 安全考虑

### 9.1 数据加密

1. 敏感字段（如密码）在存储前进行加密
2. 对用户的隐私数据（如 QQ 号）进行适当脱敏
3. 传输过程中使用 HTTPS 加密

### 9.2 访问控制

1. 数据库用户权限最小化，每个微服务只拥有对应 schema 的权限
2. 使用连接池管理数据库连接
3. 定期轮换数据库密码

---

## 10. 备份与恢复

### 10.1 备份策略

1. 每日全量备份
2. 每小时增量备份
3. 重要数据实时备份到远程存储

### 10.2 恢复策略

1. 定期测试备份恢复流程
2. 建立灾难恢复计划
3. 确保备份数据的完整性和一致性

---

## 11. 监控与维护

### 11.1 监控指标

1. 数据库连接数
2. 查询响应时间
3. 写入吞吐量
4. 磁盘使用情况
5. 索引使用情况

### 11.2 维护任务

1. 定期重建索引
2. 优化查询计划
3. 清理过期数据
4. 监控慢查询

---

## 12. 版本控制

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-02-02 | 初始版本，包含所有核心表结构 |

---

## 13. 未来规划

1. **分库分表**：当数据量达到一定规模时，考虑对大表进行分库分表
2. **读写分离**：使用主从复制实现读写分离，提高查询性能
3. **缓存优化**：进一步优化 Redis 缓存策略，减少数据库访问
4. **数据仓库**：建立数据仓库，支持数据分析和报表功能
