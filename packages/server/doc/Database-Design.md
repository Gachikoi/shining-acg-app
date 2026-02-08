# Shining ACG 数据库设计文档

## 概述

本文档描述了 Shining ACG 后端服务的数据库设计，采用 PostgreSQL 作为主数据库，使用 GORM v2 作为 ORM 框架。系统分为五个物理微服务：Account、Community、Messenger、CMS 和 Admin，每个微服务有独立的数据库 schema。

## 设计原则

1. **微服务架构**：每个微服务拥有独立的数据库 schema，确保数据隔离和服务解耦
2. **一致性**：使用外键约束和事务保证数据一致性
3. **性能优化**：为常用查询字段创建索引，包括复合索引、部分索引和 GIN/GIST 索引
4. **可扩展性**：设计灵活的表结构，支持未来功能扩展
5. **安全性**：对敏感字段进行适当处理（如密码加密）
6. **查询优化**：利用 PostgreSQL 的特性（如 JSONB、数组类型、全文搜索）提高查询效率

---

## 1. 公共基础

### 数据类型约定

`ID`字段统一使用 **雪花算法** 生成，全局唯一且递增，以便实现游标查询。
- 数据库：`BIGINT` 类型
- 后端：`int64` 类型
- 前端：由于 int64 在 JavaScript 中会溢出，需要用 string 类型接收

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

## 2. Account (用户核心微服务)

### Schema: `account`

#### 2.1 用户表 (`users`)

存储用户基本信息

```go
type User struct {
    BaseModel
    // 虽然项目中采用qq号作为用户id，但是必须有属于自己业务的id作为主键，而qq号作为唯一约束
    QQID                string         `gorm:"type:varchar(32);uniqueIndex;not null" json:"qq_id"`
    Nickname            string         `gorm:"type:varchar(100);not null" json:"nickname"`
    Avatar              string         `gorm:"type:text" json:"avatar"`
    Intro               string         `gorm:"type:text" json:"intro"`
    BackgroundImage     string         `gorm:"type:text" json:"background_image"` // 个人主页背景图
    QQNumber            string         `gorm:"type:varchar(20)" json:"qq_number"`
    PrimaryDepartment   Department     `gorm:"type:int;not null;default:0" json:"primary_department"`
    Departments         json.RawMessage `gorm:"type:jsonb;default:'[]'" json:"departments"` // 加入的所有部门 (JSONB)
    IsVerified          bool           `gorm:"default:false" json:"is_verified"`
    VerifiedTitle       string         `gorm:"type:varchar(100)" json:"verified_title"`
    Role                Role           `gorm:"type:int;not null;default:1" json:"role"` // 1=用户, 2=管理员, 3=超级管理员
    ExternalLinks       json.RawMessage `gorm:"type:jsonb;default:'[]'" json:"external_links"` // 外部链接 (JSONB)

    // 统计信息
    FollowerCount        int64 `gorm:"default:0" json:"follower_count"`
    FollowingCount       int64 `gorm:"default:0" json:"following_count"`
    PostCount            int64 `gorm:"default:0" json:"post_count"`
    LikeCountReceived    int64 `gorm:"default:0" json:"like_count_received"`
    ViewCountReceived    int64 `gorm:"default:0" json:"view_count_received"`

    // 系统设置
    EnablePush           bool `gorm:"default:true" json:"enable_push"`
    EnableEmailNotification bool `gorm:"default:false" json:"enable_email_notification"`
    Language             string `gorm:"type:varchar(20);default:'zh-CN'" json:"language"`
    Theme                string `gorm:"type:varchar(20);default:'dark'" json:"theme"`

    // 隐私设置
    MessagePermission    PrivacyLevel `gorm:"default:0" json:"message_permission"`
    ListVisibility       PrivacyLevel `gorm:"default:0" json:"list_visibility"`
    ShowOnlineStatus     bool         `gorm:"default:true" json:"show_online_status"`
    CollectionVisibility PrivacyLevel `gorm:"default:0" json:"collection_visibility"`
    LikeVisibility       PrivacyLevel `gorm:"default:0" json:"like_visibility"`

    // 扩展字段
    IpLocation           string `gorm:"type:varchar(100)" json:"ip_location"` // IP属地
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
    PrivacyLevelMutual        PrivacyLevel = 2  // 互关可见
    PrivacyLevelPrivate       PrivacyLevel = 3  // 仅自己可见
)

// 外部链接
type ExternalLink struct {
    BaseModel
    UserID int64  `gorm:"not null;index" json:"-"`
    Label  string `gorm:"type:varchar(100);not null" json:"label"`
    URL    string `gorm:"type:text;not null" json:"url"`
}
```

**约束：**
- `qq_id` 唯一索引，确保每个 QQ 用户只有一个账户
- `primary_department` 非空，默认值为 0（未定义）
- `role` 非空，默认值为 1（普通用户）
- 添加 `(nickname, id)` 复合索引，用于搜索和排序

#### 2.2 用户关系表 (`user_relationships`)

存储用户关注关系

```go
type UserRelationship struct {
    BaseModel
    FollowerID  int64 `gorm:"not null;index:idx_follower" json:"follower_id"`
    FollowingID int64 `gorm:"not null;index:idx_following" json:"following_id"`
    Remark      string `gorm:"type:varchar(100)" json:"remark"` // 备注
    IsBlocked   bool   `gorm:"default:false" json:"is_blocked"` // 是否拉黑
}
```

**约束：**
- `(follower_id, following_id)` 复合唯一索引，防止重复关注
- 外键约束：`follower_id` 和 `following_id` 都参考 `users.id`
- 添加 `(following_id, follower_id)` 复合索引，用于查询粉丝列表

#### 2.3 用户会话表 (`user_sessions`)

存储用户登录会话信息

```go
type UserSession struct {
    BaseModel
    UserID        int64     `gorm:"not null;index" json:"user_id"`
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
- 添加 `(expires_at)` 索引，用于清理过期会话

#### 2.4 认证申请表 (`verification_applications`)

存储用户身份认证申请信息

```go
// 认证申请状态
type VerificationStatus int

const (
    VerificationStatusPending  VerificationStatus = 0  // 待审核
    VerificationStatusApproved VerificationStatus = 1  // 已通过
    VerificationStatusRejected VerificationStatus = 2  // 已驳回
)

type VerificationApplication struct {
    BaseModel
    UserID         int64                 `gorm:"not null;index" json:"user_id"`
    VerifiedTitle  string                `gorm:"type:varchar(100);not null" json:"verified_title"`
    Status         VerificationStatus    `gorm:"type:int;not null;default:0" json:"status"`
    RejectReason   string                `gorm:"type:text" json:"reject_reason"`
    ProcessedBy    int64                 `gorm:"index" json:"processed_by"` // 处理人ID
    ProcessedAt    time.Time             `gorm:"type:timestamptz" json:"processed_at"`
}
```

**约束：**
- `user_id` 外键约束，参考 `users.id`
- `status` 非空，默认值为 0（待审核）
- 添加 `(status, created_at)` 复合索引，用于查询待审核申请
- 添加 `(user_id, status)` 复合索引，用于查询用户的申请记录

#### 2.5 举报表 (`reports`)

存储用户举报信息

```go
type Report struct {
    BaseModel
    ReporterID  int64         `gorm:"not null;index" json:"reporter_id"`
    TargetID    int64         `gorm:"not null;index" json:"target_id"`
    Type        ReportType    `gorm:"type:int;not null" json:"type"`
    Reason      string        `gorm:"type:varchar(200);not null" json:"reason"`
    Description string        `gorm:"type:text" json:"description"`
    Status      ReportStatus  `gorm:"type:int;not null;default:0" json:"status"`
    Action      ReportAction  `gorm:"type:int" json:"action"`
    ResolverID  int64         `gorm:"index" json:"resolver_id"`
    ResolvedAt  time.Time     `gorm:"type:timestamptz" json:"resolved_at"`
    Note        string        `gorm:"type:text" json:"note"`
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
- 添加 `(status, type, created_at)` 复合索引，用于查询待处理举报

---

## 3. Community (社区内容微服务)

### Schema: `community`

#### 3.1 分区表 (`partitions`)

存储帖子分区信息（对应部门）

```go
type Partition struct {
    BaseModel
    Name        string         `gorm:"type:varchar(100);not null;uniqueIndex" json:"name"`
    Description string         `gorm:"type:text" json:"description"`
    Icon        string         `gorm:"type:text" json:"icon"`
    SortOrder   int            `gorm:"not null;default:0" json:"sort_order"`
    IsActive    bool           `gorm:"not null;default:true" json:"is_active"`
}
```

**约束：**
- `name` 唯一索引，分区名称不能重复
- `sort_order` 用于控制分区显示顺序
- 添加 `(is_active, sort_order)` 复合索引，用于查询活跃分区

#### 3.2 帖子表 (`posts`)

存储用户发布的帖子

```go
type Post struct {
    BaseModel
    AuthorID         int64         `gorm:"not null;index" json:"author_id"`
    Title            string        `gorm:"type:varchar(200);not null" json:"title"`
    Content          string        `gorm:"type:text" json:"content"`
    Media            []Media       `gorm:"foreignKey:PostID" json:"media"`
    DepartmentID     int           `gorm:"type:int;not null;index" json:"department_id"`
    DepartmentName   string        `gorm:"type:varchar(100);not null" json:"department_name"`

    // 统计信息
    LikeCount        int32         `gorm:"default:0" json:"like_count"`
    CommentCount     int32         `gorm:"default:0" json:"comment_count"`
    CollectCount     int32         `gorm:"default:0" json:"collect_count"`
    ViewCount        int32         `gorm:"default:0" json:"view_count"`

    // 审核状态
    Status           PostStatus    `gorm:"type:int;not null;default:1" json:"status"` // 1=已发布, 2=审核中, 3=已删除
    IsVisible        bool          `gorm:"not null;default:true" json:"is_visible"`
    IsDeleted        bool          `gorm:"not null;default:false" json:"is_deleted"`

    // 搜索优化字段
    SearchVector     string        `gorm:"type:tsvector" json:"-"` // 全文搜索向量

    // 热度评分（用于热门排序）
    HotScore         float64       `gorm:"default:0" json:"hot_score"`
}

// 帖子状态
type PostStatus int

const (
    PostStatusUnspecified PostStatus = 0
    PostStatusPublished   PostStatus = 1 // 已发布
    PostStatusAuditing    PostStatus = 2 // 审核中
    PostStatusDeleted     PostStatus = 3 // 已删除
)

// 媒体资源
type Media struct {
    BaseModel
    PostID     int64  `gorm:"not null;index" json:"-"`
    Type       string `gorm:"type:varchar(20);not null" json:"type"` // "image" | "video"
    URL        string `gorm:"type:text;not null" json:"url"`
    Thumbnail  string `gorm:"type:text" json:"thumbnail"` // 缩略图（视频用）
    Width      int    `json:"width"`
    Height     int    `json:"height"`
}
```

**约束：**
- `author_id` 外键约束，参考 `account.users.id`
- `department_id` 非空，对应部门枚举值
- 添加 `(status, created_at DESC)` 复合索引，用于查询最新帖子
- 添加 `(status, hot_score DESC)` 复合索引，用于查询热门帖子
- 添加 `(status, department_id, created_at DESC)` 复合索引，用于查询部门分区帖子
- 添加 `(status, author_id, created_at DESC)` 复合索引，用于查询用户帖子
- 创建 GIN 索引在 `search_vector` 字段上，用于全文搜索

#### 3.3 评论表 (`comments`)

存储帖子评论和回复

```go
type Comment struct {
    BaseModel
    AuthorID        int64     `gorm:"not null;index" json:"author_id"`
    PostID          int64     `gorm:"not null;index" json:"post_id"`
    RootID          int64     `gorm:"index" json:"root_id"` // 一级评论ID，用于回复
    ParentID        int64     `gorm:"index" json:"parent_id"` // 直接回复的父评论ID
    ReplyToUserID   int64     `gorm:"index" json:"reply_to_user_id"`
    Content         string    `gorm:"type:text;not null" json:"content"`
    LikeCount       int32     `gorm:"default:0" json:"like_count"`
    ReplyCount      int32     `gorm:"default:0" json:"reply_count"` // 子评论总数
    IsDeleted       bool      `gorm:"not null;default:false" json:"is_deleted"`
    IsAuthor        bool      `gorm:"default:false" json:"is_author"` // 是否是楼主评论
}
```

**约束：**
- `author_id` 外键约束，参考 `account.users.id`
- `post_id` 外键约束，参考 `posts.id`
- 添加 `(post_id, root_id, created_at DESC)` 复合索引，用于查询评论树
- 添加 `(root_id, like_count DESC, created_at DESC)` 复合索引，用于查询热门评论
- 添加 `(author_id, created_at DESC)` 复合索引，用于查询用户评论

#### 3.4 互动表 (`interactions`)

存储用户对帖子和评论的点赞、收藏等互动

```go
type Interaction struct {
    BaseModel
    UserID     int64         `gorm:"not null;index" json:"user_id"`
    TargetID   int64         `gorm:"not null;index" json:"target_id"`
    TargetType TargetType    `gorm:"type:int;not null" json:"target_type"`
    ActionType ActionType    `gorm:"type:int;not null" json:"action_type"`
    IsActive   bool          `gorm:"not null;default:true" json:"is_active"`
}

// 互动目标类型
type TargetType int

const (
    TargetTypePost    TargetType = 1
    TargetTypeComment TargetType = 2
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
- `user_id` 外键约束，参考 `account.users.id`
- 添加 `(target_id, target_type, action_type)` 复合索引，用于统计互动数量
- 添加 `(user_id, action_type, created_at DESC)` 复合索引，用于查询用户互动历史
- target_type=2 (Comment) 时，action_type 只能为 0 (Like)。

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
- 添加 `(type, year)` 复合索引，用于按类型和年份查询

---

## 4. Messenger (消息通知微服务)

### Schema: `messenger`

#### 4.1 消息表 (`messages`)

存储用户之间的私信

```go
type Message struct {
    BaseModel
    SenderID    int64         `gorm:"not null;index" json:"sender_id"`
    ReceiverID  int64         `gorm:"not null;index" json:"receiver_id"`
    Type        MessageType   `gorm:"type:int;not null;default:1" json:"type"`
    Content     string        `gorm:"type:text;not null" json:"content"`
    SentAt      time.Time     `gorm:"type:timestamptz;not null;default:now()" json:"sent_at"`
    IsRead      bool          `gorm:"not null;default:false" json:"is_read"`
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
- `sender_id` 和 `receiver_id` 外键约束，参考 `account.users.id`
- `type` 非空，默认值为 1（文本消息）
- 添加 `(sender_id, receiver_id, sent_at DESC)` 复合索引，用于查询对话历史
- 添加 `(receiver_id, is_read, sent_at DESC)` 复合索引，用于查询未读消息
- 添加 `(least(sender_id, receiver_id), greatest(sender_id, receiver_id), sent_at DESC)` 复合索引，用于查询对话列表

#### 4.2 通知表 (`notifications`)

存储用户的通知信息

```go
type Notification struct {
    BaseModel
    UserID         int64                  `gorm:"not null;index" json:"user_id"`
    Action         NotificationAction     `gorm:"type:int;not null" json:"action"`
    Title          string                 `gorm:"type:varchar(200);not null" json:"title"`
    Content        string                 `gorm:"type:text" json:"content"`
    TargetID       int64                  `gorm:"index" json:"target_id"`
    TargetType     string                 `gorm:"type:varchar(50)" json:"target_type"` // "post" | "comment"
    Actors         []int64                `gorm:"type:bigint[]" json:"actors"` // 参与用户ID列表
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
- `user_id` 外键约束，参考 `account.users.id`
- `action` 非空，用于区分通知类型
- 添加 `(user_id, is_read, created_at DESC)` 复合索引，用于查询未读通知
- 添加 `(user_id, action, created_at DESC)` 复合索引，用于查询特定类型通知
- 添加 `(user_id, created_at DESC)` 复合索引，用于查询通知列表

## 5. CMS (官网管理微服务)

### Schema: `cms`

#### 5.1 网站配置表 (`site_configs`)

存储网站的基本配置信息

```go
type SiteConfig struct {
    BaseModel
    Key         string          `gorm:"type:varchar(100);not null;uniqueIndex" json:"key"`
    Value       jsonb           `gorm:"not null" json:"value"`
    Description string          `gorm:"type:text" json:"description"`
}
```

**约束：**
- `key` 唯一索引，确保配置项不重复

#### 5.2 部门信息表 (`departments`)

存储部门信息（与account微服务的部门枚举对应）

```go
type DepartmentInfo struct {
    BaseModel
    DepartmentID   int             `gorm:"type:int;not null;uniqueIndex" json:"department_id"`
    Name           string          `gorm:"type:varchar(100);not null" json:"name"`
    Description    string          `gorm:"type:text" json:"description"`
    Icon           string          `gorm:"type:text" json:"icon"`
    Banner         string          `gorm:"type:text" json:"banner"`
    SortOrder      int             `gorm:"not null;default:0" json:"sort_order"`
    IsActive       bool            `gorm:"not null;default:true" json:"is_active"`
    Content        jsonb           `gorm:"not null" json:"content"` // 详细内容（包含成员、活动等）
}
```

**约束：**
- `department_id` 唯一索引，与枚举值对应
- 添加 `(is_active, sort_order)` 复合索引，用于查询活跃部门

#### 5.3 活动信息表 (`activities`)

存储社团活动信息

```go
type Activity struct {
    BaseModel
    Title          string          `gorm:"type:varchar(200);not null" json:"title"`
    Description    string          `gorm:"type:text" json:"description"`
    Banner         string          `gorm:"type:text" json:"banner"`
    StartTime      time.Time       `gorm:"type:timestamptz;not null" json:"start_time"`
    EndTime        time.Time       `gorm:"type:timestamptz;not null" json:"end_time"`
    Location       string          `gorm:"type:varchar(200)" json:"location"`
    DepartmentID   int             `gorm:"type:int;index" json:"department_id"`
    IsActive       bool            `gorm:"not null;default:true" json:"is_active"`
    Content        jsonb           `gorm:"not null" json:"content"` // 详细内容
}
```

**约束：**
- 添加 `(is_active, start_time DESC)` 复合索引，用于查询最新活动
- 添加 `(department_id, is_active, start_time DESC)` 复合索引，用于查询部门活动

#### 5.4 历史事件表 (`history_events`)

存储社团发展历程

```go
type HistoryEvent struct {
    BaseModel
    Year           int             `gorm:"type:int;not null;index" json:"year"`
    Title          string          `gorm:"type:varchar(200);not null" json:"title"`
    Description    string          `gorm:"type:text" json:"description"`
    Image          string          `gorm:"type:text" json:"image"`
    SortOrder      int             `gorm:"not null;default:0" json:"sort_order"`
}
```

**约束：**
- 添加 `(year, sort_order)` 复合索引，用于按年份查询历史事件

#### 5.5 部长信息表 (`ministers`)

存储部长信息

```go
type Minister struct {
    BaseModel
    Year           int             `gorm:"type:int;not null;index" json:"year"`
    UserID         int64           `gorm:"not null;index" json:"user_id"`
    DepartmentID   int             `gorm:"type:int;not null" json:"department_id"`
    Position       string          `gorm:"type:varchar(100);not null" json:"position"`
    SortOrder      int             `gorm:"not null;default:0" json:"sort_order"`
    Intro          string          `gorm:"type:text" json:"intro"`
}
```

**约束：**
- 添加 `(year, department_id)` 复合唯一索引，防止重复
- 添加 `(year, sort_order)` 复合索引，用于查询部长列表

#### 5.6 网站Staff表 (`site_staff`)

存储网站开发和维护人员信息

```go
type SiteStaff struct {
    BaseModel
    UserID         int64           `gorm:"not null;index" json:"user_id"`
    Role           string          `gorm:"type:varchar(100);not null" json:"role"`
    DepartmentID   int             `gorm:"type:int;index" json:"department_id"`
    SortOrder      int             `gorm:"not null;default:0" json:"sort_order"`
    Intro          string          `gorm:"type:text" json:"intro"`
}
```

**约束：**
- 添加 `(department_id, sort_order)` 复合索引，用于查询部门Staff

#### 5.7 赞助商表 (`sponsors`)

存储赞助商信息

```go
type Sponsor struct {
    BaseModel
    Name           string          `gorm:"type:varchar(200);not null" json:"name"`
    Logo           string          `gorm:"type:text" json:"logo"`
    Link           string          `gorm:"type:text" json:"link"`
    Level          int             `gorm:"type:int;not null;default:0" json:"level"` // 赞助级别
    SortOrder      int             `gorm:"not null;default:0" json:"sort_order"`
    IsActive       bool            `gorm:"not null;default:true" json:"is_active"`
}
```

**约束：**
- 添加 `(level, sort_order)` 复合索引，用于按级别排序

---

## 6. Admin (管理员微服务)

### Schema: `admin`

#### 6.1 管理操作日志表 (`admin_logs`)

存储管理员操作记录

```go
type AdminLog struct {
    BaseModel
    AdminID        int64           `gorm:"not null;index" json:"admin_id"`
    Action         string          `gorm:"type:varchar(100);not null" json:"action"`
    TargetType     string          `gorm:"type:varchar(50);not null" json:"target_type"`
    TargetID       int64           `gorm:"index" json:"target_id"`
    Description    string          `gorm:"type:text" json:"description"`
    IPAddress      string          `gorm:"type:varchar(45)" json:"ip_address"`
}
```

**约束：**
- 添加 `(admin_id, created_at DESC)` 复合索引，用于查询管理员操作记录
- 添加 `(action, created_at DESC)` 复合索引，用于查询特定操作记录

---

## 7. 数据库初始化脚本

```sql
-- 创建 schema
CREATE SCHEMA IF NOT EXISTS account;
CREATE SCHEMA IF NOT EXISTS community;
CREATE SCHEMA IF NOT EXISTS messenger;
CREATE SCHEMA IF NOT EXISTS cms;
CREATE SCHEMA IF NOT EXISTS admin;

-- 设置搜索路径
SET search_path TO account, community, messenger, cms, admin, public;

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- 用于模糊搜索
CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- 用于GIN索引
CREATE EXTENSION IF NOT EXISTS "btree_gist"; -- 用于GIST索引

-- 创建部门信息的基础数据
INSERT INTO cms.department_infos (id, created_at, updated_at, department_id, name, description, sort_order, is_active) VALUES
(1, now(), now(), 1, '轻音部', '轻音乐社团活动', 1, true),
(2, now(), now(), 2, 'WOTA', 'WOTA艺交流', 2, true),
(3, now(), now(), 3, '东方组', '东方Project相关内容', 3, true),
(4, now(), now(), 4, '轻文部', '发布原创小说和散文', 4, true),
(5, now(), now(), 5, '模玩部', '分享模型手办的制作与收藏', 5, true),
(6, now(), now(), 6, '宣传部', '社团宣传和推广', 6, true),
(7, now(), now(), 7, '活动部', '社团活动组织', 7, true),
(8, now(), now(), 8, 'COS部', '分享cosplay作品和经验', 8, true),
(9, now(), now(), 9, '宅舞部', '交流宅舞学习和表演', 9, true),
(10, now(), now(), 10, '动漫研', '分享动漫资源和讨论', 10, true),
(11, now(), now(), 11, '视频组', '视频制作和剪辑', 11, true),
(12, now(), now(), 12, '音游组', '讨论音乐游戏技巧', 12, true),
(13, now(), now(), 13, 'V曲组', 'Vocaloid音乐创作', 13, true),
(14, now(), now(), 14, 'MC组', 'Minecraft游戏交流', 14, true);

-- 初始化网站配置
INSERT INTO cms.site_configs (id, created_at, updated_at, key, value, description) VALUES
(1, now(), now(), 'site_title', '"Shining ACG Fan Club"', '网站标题'),
(2, now(), now(), 'site_description', '"Shining ACG 动漫社官方网站"', '网站描述'),
(3, now(), now(), 'contact_email', '"contact@shiningacg.club"', '联系邮箱'),
(4, now(), now(), 'qq_group', '"2058733532"', 'QQ群号');
```

---

## 8. 索引优化建议

### 8.1 Account 微服务索引

```sql
-- 用户表
CREATE INDEX idx_users_primary_department ON account.users (primary_department);
CREATE INDEX idx_users_role ON account.users (role);
CREATE INDEX idx_users_is_verified ON account.users (is_verified);
CREATE INDEX idx_users_nickname_id ON account.users (nickname, id); -- 用于搜索和排序
CREATE INDEX idx_users_follower_count ON account.users (follower_count DESC); -- 用于排行榜

-- 用户关系表
CREATE UNIQUE INDEX idx_user_relationships_unique ON account.user_relationships (follower_id, following_id);
CREATE INDEX idx_user_relationships_following ON account.user_relationships (following_id, follower_id);
CREATE INDEX idx_user_relationships_follower ON account.user_relationships (follower_id, following_id);
CREATE INDEX idx_user_relationships_blocked ON account.user_relationships (follower_id, is_blocked);

-- 会话表
CREATE INDEX idx_user_sessions_expires ON account.user_sessions (expires_at);
CREATE INDEX idx_user_sessions_last_active ON account.user_sessions (last_active_at DESC);

-- 举报表
CREATE INDEX idx_reports_status_type ON account.reports (status, type, created_at DESC);
CREATE INDEX idx_reports_target ON account.reports (target_id, type);
```

### 8.2 Community 微服务索引

```sql
-- 分区表
CREATE INDEX idx_partitions_active_sort ON community.partitions (is_active, sort_order);

-- 帖子表
CREATE INDEX idx_posts_author ON community.posts (author_id, created_at DESC);
CREATE INDEX idx_posts_department ON community.posts (department_id, status, created_at DESC);
CREATE INDEX idx_posts_status_created ON community.posts (status, created_at DESC);
CREATE INDEX idx_posts_status_hot ON community.posts (status, hot_score DESC);
CREATE INDEX idx_posts_visibility ON community.posts (status, is_visible, is_deleted);
CREATE GIN INDEX idx_posts_search_vector ON community.posts USING GIN(search_vector); -- 全文搜索

-- 评论表
CREATE INDEX idx_comments_post_root ON community.comments (post_id, root_id, created_at DESC);
CREATE INDEX idx_comments_root_like ON community.comments (root_id, like_count DESC, created_at DESC);
CREATE INDEX idx_comments_author ON community.comments (author_id, created_at DESC);

-- 互动表
CREATE UNIQUE INDEX idx_interactions_unique ON community.interactions (user_id, target_id, target_type, action_type);
CREATE INDEX idx_interactions_target ON community.interactions (target_id, target_type, action_type);
CREATE INDEX idx_interactions_user_action ON community.interactions (user_id, action_type, created_at DESC);

-- 官网内容表
CREATE INDEX idx_site_contents_type_year ON community.site_contents (type, year);
```

### 8.3 Messenger 微服务索引

```sql
-- 消息表
CREATE INDEX idx_messages_sender_receiver ON messenger.messages (sender_id, receiver_id, sent_at DESC);
CREATE INDEX idx_messages_receiver_unread ON messenger.messages (receiver_id, is_read, sent_at DESC);
CREATE INDEX idx_messages_conversation ON messenger.messages (
    least(sender_id, receiver_id),
    greatest(sender_id, receiver_id),
    sent_at DESC
);

-- 通知表
CREATE INDEX idx_notifications_user_unread ON messenger.notifications (user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_user_action ON messenger.notifications (user_id, action, created_at DESC);
CREATE INDEX idx_notifications_user_created ON messenger.notifications (user_id, created_at DESC);
```

### 8.4 CMS 微服务索引

```sql
-- 网站配置表
CREATE UNIQUE INDEX idx_site_configs_key ON cms.site_configs (key);

-- 部门信息表
CREATE INDEX idx_department_infos_active_sort ON cms.department_infos (is_active, sort_order);

-- 活动信息表
CREATE INDEX idx_activities_active_time ON cms.activities (is_active, start_time DESC);
CREATE INDEX idx_activities_department ON cms.activities (department_id, is_active, start_time DESC);

-- 历史事件表
CREATE INDEX idx_history_events_year_sort ON cms.history_events (year, sort_order);

-- 部长信息表
CREATE UNIQUE INDEX idx_ministers_year_department ON cms.ministers (year, department_id);
CREATE INDEX idx_ministers_year_sort ON cms.ministers (year, sort_order);

-- 网站Staff表
CREATE INDEX idx_site_staff_department_sort ON cms.site_staff (department_id, sort_order);

-- 赞助商表
CREATE INDEX idx_sponsors_level_sort ON cms.sponsors (level, sort_order);
CREATE INDEX idx_sponsors_active ON cms.sponsors (is_active, sort_order);
```

### 8.5 Admin 微服务索引

```sql
-- 管理操作日志表
CREATE INDEX idx_admin_logs_admin ON admin.admin_logs (admin_id, created_at DESC);
CREATE INDEX idx_admin_logs_action ON admin.admin_logs (action, created_at DESC);
CREATE INDEX idx_admin_logs_target ON admin.admin_logs (target_type, target_id, created_at DESC);
```

### 8.6 高级索引优化

```sql
-- 模糊搜索索引（使用pg_trgm扩展）
CREATE INDEX idx_users_nickname_trgm ON account.users USING GIN (nickname gin_trgm_ops);
CREATE INDEX idx_posts_title_trgm ON community.posts USING GIN (title gin_trgm_ops);
CREATE INDEX idx_posts_content_trgm ON community.posts USING GIN (content gin_trgm_ops);
CREATE INDEX idx_comments_content_trgm ON community.comments USING GIN (content gin_trgm_ops);

-- JSONB 字段索引
CREATE INDEX idx_department_infos_content ON cms.department_infos USING GIN (content);
CREATE INDEX idx_activities_content ON cms.activities USING GIN (content);
CREATE INDEX idx_site_configs_value ON cms.site_configs USING GIN (value);

-- 部分索引（只索引活跃数据）
CREATE INDEX idx_posts_active ON community.posts (department_id, created_at DESC)
WHERE status = 1 AND is_visible = true AND is_deleted = false;
```

---

## 9. 数据同步与一致性

### 9.1 微服务间数据访问

各微服务原则上只能访问自己的 schema，但在某些情况下需要跨 schema 查询：

1. **Account → Community**：查询用户发布的帖子（通过 author_id 外键）
2. **Community → Account**：获取用户信息（通过 author_id 外键）
3. **Messenger → Account**：获取用户信息（通过 sender_id/receiver_id 外键）
4. **CMS → Account**：获取用户信息（如部长、Staff）

### 9.2 数据一致性保证

- 使用外键约束保证引用完整性
- 重要操作使用事务保证一致性
- 异步消息队列处理非实时数据同步（如点赞数、评论数的统计更新）
- 数据库级别的触发器（Trigger）用于维护数据一致性（如用户关注数、粉丝数的自动更新）

---

## 10. 性能优化建议

### 10.1 查询优化

1. 避免全表扫描，确保查询条件使用索引字段
2. 对于大数据量表（如 posts、comments、messages），使用分页查询或游标查询
3. 对频繁访问的数据使用 Redis 缓存（如用户信息、帖子列表、通知计数）
4. 利用 PostgreSQL 的全文搜索功能（tsvector）优化搜索查询
5. 使用 pg_trgm 扩展支持模糊搜索和拼写纠错

### 10.2 写入优化

1. 对于频繁更新的统计字段（如点赞数、评论数），考虑使用异步更新或 Redis 缓存，定时同步到数据库
2. 避免在事务中执行大量写入操作，使用批量插入处理大量数据
3. 对写入频率高的表使用 WAL（Write-Ahead Logging）优化
4. 考虑使用分区表处理时间序列数据（如 messages、notifications、admin_logs）

### 10.3 存储优化

1. 定期清理无效数据（如已删除的帖子、过期的会话）
2. 对大字段（如 content）进行压缩存储（使用 TOAST 存储机制）
3. 对经常访问的小字段使用覆盖索引，避免回表查询
4. 考虑使用表空间（Tablespace）将不同用途的数据存储在不同的磁盘上

### 10.4 连接池优化

1. 合理配置数据库连接池大小，避免连接泄漏
2. 使用连接复用，减少连接建立的开销
3. 监控连接池使用情况，及时调整配置

### 10.5 读写分离

1. 当数据量达到一定规模时，考虑使用主从复制实现读写分离
2. 读操作分布到多个从节点，提高查询性能
3. 写操作只在主节点进行，保证数据一致性

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

## 14. 版本控制

| 版本 | 日期 | 说明 |
|------|------|------|
| v1.0 | 2026-02-02 | 初始版本，包含所有核心表结构 |
| v1.1 | 2026-02-03 | 全面重构，使用雪花算法主键，优化表结构和索引，添加新微服务和功能 |

---

## 15. 未来规划

1. **分库分表**：当数据量达到一定规模时，考虑对大表进行分库分表
2. **读写分离**：使用主从复制实现读写分离，提高查询性能
3. **缓存优化**：进一步优化 Redis 缓存策略，减少数据库访问，实现热点数据的自动缓存
4. **数据仓库**：建立数据仓库，支持数据分析和报表功能，包括用户行为分析、内容热度分析等
5. **数据同步**：实现跨微服务的数据同步机制，确保数据一致性
6. **高可用架构**：实现数据库的高可用架构，包括主从复制、故障转移和备份恢复
7. **性能监控**：建立完善的数据库性能监控和告警系统，及时发现和解决性能问题
8. **SQL优化**：定期进行SQL查询优化，分析慢查询日志，优化查询计划
