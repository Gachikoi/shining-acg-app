# Shining ACG API 架构文档

## 项目概述

本项目的后端架构划分为 **3 个物理微服务**，包含 **7 个逻辑模块**，提供完整的 ACG 社区服务功能。

## 架构总览

| 微服务名称 | **User** (用户核心) | **Community** (社区内容) | **Messenger** (即时通讯) |
| :--- | :--- | :--- | :--- |
| **包含逻辑模块** | **Auth** (认证)<br>**User** (用户资料/关系)<br>**Admin** (权限/封禁) | **Content** (帖子/瀑布流)<br>**Interaction** (转评赞)<br>**Site** (官网门户数据)<br>**Resource** (上传) | **Message** (私信/聊天)<br>**Notification** (消息推送) |
| **特点** | **基石**。流量平稳，数据一致性要求最高。 | **流量大户**。读多写少，逻辑最复杂（推荐算法/聚合）。 | **异构**。长连接、实时性高，独立部署防止拖垮主业务。 |
| **难度** | ⭐ (最容易，先做) | ⭐⭐ (核心业务) | ⭐⭐⭐ (涉及并发/流) |

---

## 1. 公共模块 (Common)

### 文件位置
`proto/api/v1/common/common.proto`

### 定义内容

#### 1.1 枚举类型

##### Department (部门枚举)
- `DEPARTMENT_UNSPECIFIED` (0) - 未定义
- `DEPARTMENT_LIGHT_MUSIC` (1) - 轻音部
- `DEPARTMENT_WOTA` (2) - WOTA
- `DEPARTMENT_TOUHOU` (3) - 东方组
- `DEPARTMENT_LITERATURE` (4) - 轻文部
- `DEPARTMENT_MODEL_PLASTIC` (5) - 模玩部
- `DEPARTMENT_PUBLICITY` (6) - 宣传部
- `DEPARTMENT_ACTIVITY` (7) - 活动部
- `DEPARTMENT_COSPLAY` (8) - COS 部
- `DEPARTMENT_OTAKU_DANCE` (9) - 宅舞部
- `DEPARTMENT_ANIME` (10) - 动漫研
- `DEPARTMENT_VIDEO` (11) - 视频组
- `DEPARTMENT_MUSIC_GAME` (12) - 音游组
- `DEPARTMENT_V_TUBE` (13) - V 曲组
- `DEPARTMENT_MINECRAFT` (14) - MC 组

##### Role (用户角色枚举)
- `ROLE_VISITOR` (0) - 游客
- `ROLE_USER` (1) - 用户
- `ROLE_ADMIN` (2) - 内容管理员
- `ROLE_SUPER_ADMIN` (3) - 超级管理员

#### 1.2 消息类型

##### Pagination (分页请求)
```proto
message Pagination {
  int32 page_size = 1;        // 每页数量
  string page_token = 2;      // 游标（用于无限滚动，最后一条数据的id）
  int32 page = 3;             // 页码（用于传统分页，页面偏移量）
}
```

##### Media (多媒体资源)
```proto
message Media {
  string type = 1;            // "image" | "video"
  string url = 2;             // 资源地址
  string thumbnail = 3;       // 缩略图（视频用）
  int32 width = 4;            // 宽
  int32 height = 5;           // 高
}
```

##### UserSummary (基础信息摘要)
```proto
message UserSummary {
  string user_id = 1;
  string nickname = 2;               // 昵称，若有备注优先显示备注
  string avatar = 3;
  Department primary_department = 4; // 主所属部门徽章
  bool is_verified = 5;              // 身份认证状态
  string verified_title = 6;         // 认证头衔（如：23届部长）
}
```

---

## 2. User (用户核心微服务)

### 2.1 Auth Service (认证服务)

#### 文件位置
`proto/api/v1/user/auth.proto`

#### RPC 方法

##### Login (QQ 登录/注册)
```proto
rpc Login(LoginRequest) returns (LoginResponse);
```
- 请求：`LoginRequest`
  - `qq_access_token` (string) - QQ 访问令牌
  - `device_info` (string) - 设备信息
- 响应：`LoginResponse`
  - `session_token` (string) - 会话令牌
  - `me` (UserSummary) - 用户信息

##### Logout (退出登录)
```proto
rpc Logout(LogoutRequest) returns (LogoutResponse);
```
- 请求：`LogoutRequest`
- 响应：`LogoutResponse`

##### RefreshToken (刷新 Token)
```proto
rpc RefreshToken(RefreshTokenRequest) returns (RefreshTokenResponse);
```
- 请求：`RefreshTokenRequest`
  - `refresh_token` (string) - 刷新令牌
- 响应：`RefreshTokenResponse`
  - `session_token` (string) - 新的会话令牌

---

### 2.2 User Service (用户服务)

#### 文件位置
`proto/api/v1/user/user.proto`

#### 核心模型

##### ExternalLink (外部链接结构)
```proto
message ExternalLink {
  string label = 1; // 链接显示文字
  string url = 2;   // 实际跳转地址
}
```

##### UserProfile (详细资料)
```proto
message UserProfile {
  UserSummary base = 1;
  string intro = 2;                    // 个人介绍
  repeated Department departments = 3; // 加入的所有部门

  int64 follower_count = 4;
  int64 following_count = 5;
  int64 post_count = 6;                // 帖子数
  int64 like_and_collection_count = 7; // 获赞与收藏总数

  repeated ExternalLink links = 8;     // 社交链接
  string qq_number = 9;                // 未来可以扩展可见性选项

  bool is_following = 10;              // 是否关注了对方
  bool is_followed_by = 11;            // 是否被对方关注
  string my_remark = 12;               // 我给对方的备注
}
```

##### PrivacySettings (隐私与系统设置)
```proto
message PrivacySettings {
  PrivacyLevel message_permission = 1;    // 私信权限
  PrivacyLevel collection_visibility = 2; // 收藏可见性
  PrivacyLevel like_visibility = 3;       // 点赞可见性
}
```

##### UserSettings (用户设置)
```proto
message UserSettings {
  bool enable_push_notifications = 1;     // 全局推送开关
}
```

##### PrivacyLevel (隐私可见性级别)
```proto
enum PrivacyLevel {
  PRIVACY_LEVEL_PUBLIC = 0;          // 全员公开
  PRIVACY_LEVEL_FOLLOWERS = 1;       // 粉丝可见
  PRIVACY_LEVEL_MUTUAL_FOLLOW = 2;   // 互关可见
  PRIVACY_LEVEL_PRIVATE = 3;         // 仅自己可见
}
```

#### RPC 方法

##### GetMe (获取当前登录用户自己的详细信息)
```proto
rpc GetMe(GetMeRequest) returns (GetMeResponse);
```
- 请求：`GetMeRequest`
  - `user_id` (string)
- 响应：`GetMeResponse`
  - `profile` (UserProfile)
  - `privacy_settings` (PrivacySettings)
  - `user_settings` (UserSettings)

##### GetUser (获取他人信息)
```proto
rpc GetUser(GetUserRequest) returns (GetUserResponse);
```
- 请求：`GetUserRequest`
  - `target_user_id` (string)
- 响应：`GetUserResponse`
  - `profile` (UserProfile)
  - `privacy_settings` (PrivacySettings)

##### UpdateProfile (局部更新资料)
```proto
rpc UpdateProfile(UpdateProfileRequest) returns (UpdateProfileResponse);
```
- 请求：`UpdateProfileRequest`
  - `profile` (UserProfile)
  - `update_mask` (FieldMask) - 指明哪些字段需要更新
- 响应：`UpdateProfileResponse`
  - `updated_profile` (UserProfile)

##### Follow (关注用户)
```proto
rpc Follow(FollowRequest) returns (FollowResponse);
```
- 请求：`FollowRequest`
  - `target_user_id` (string)
- 响应：`FollowResponse`
  - `success` (bool)

##### Unfollow (取消关注)
```proto
rpc Unfollow(UnfollowRequest) returns (UnfollowResponse);
```
- 请求：`UnfollowRequest`
  - `target_user_id` (string)
- 响应：`UnfollowResponse`
  - `success` (bool)

##### ListFollowers (关注列表)
```proto
rpc ListFollowers(ListFollowersRequest) returns (ListFollowersResponse);
```
- 请求：`ListFollowersRequest`
  - `user_id` (string)
  - `pagination` (Pagination)
- 响应：`ListFollowersResponse`
  - `users` (repeated UserSummary)
  - `next_page_token` (string)

##### ListFollowing (粉丝列表)
```proto
rpc ListFollowing(ListFollowingRequest) returns (ListFollowingResponse);
```
- 请求：`ListFollowingRequest`
  - `user_id` (string)
  - `pagination` (Pagination)
- 响应：`ListFollowingResponse`
  - `users` (repeated UserSummary)
  - `next_page_token` (string)

##### SearchUsers (搜索用户)
```proto
rpc SearchUsers(SearchUsersRequest) returns (SearchUsersResponse);
```
- 请求：`SearchUsersRequest`
  - `keyword` (string)
  - `pagination` (Pagination)
- 响应：`SearchUsersResponse`
  - `results` (repeated UserSummary)
  - `next_page_token` (string)

---

### 2.3 Admin Service (管理服务)

#### 文件位置
`proto/api/v1/user/admin.proto`

#### 核心模型

##### ReportStatus (举报状态)
```proto
enum ReportStatus {
  REPORT_STATUS_PENDING = 0;
  REPORT_STATUS_RESOLVED = 1;
}
```

##### ReportAction (举报处理动作)
```proto
enum ReportAction {
  REPORT_ACTION_IGNORE = 0;
  REPORT_ACTION_BAN = 1;
  REPORT_ACTION_DELETE = 2;
}
```

##### ReportType (举报类型)
```proto
enum ReportType {
  REPORT_TYPE_POST = 0;
  REPORT_TYPE_COMMENT = 1;
  REPORT_TYPE_USER = 2;
}
```

##### SiteContentType (官网内容类型)
```proto
enum SiteContentType {
  SITE_CONTENT_TYPE_HISTORY = 0;
  SITE_CONTENT_TYPE_ACTIVITY = 1;
  SITE_CONTENT_TYPE_DEPARTMENT = 2;
  SITE_CONTENT_TYPE_MINISTER = 3;
  SITE_CONTENT_TYPE_STAFF = 4;
}
```

##### Report (举报信息)
```proto
message Report {
  string report_id = 1;        // 举报ID
  string reporter_id = 2;     // 举报者ID
  string target_id = 3;       // 被举报对象ID
  ReportType type = 4;        // 举报类型
  string reason = 5;          // 举报原因
  string description = 6;     // 举报描述
  ReportStatus status = 7;    // 处理状态
  ReportAction action = 8;    // 处理动作
  int64 created_at = 9;       // 举报时间
  int64 resolved_at = 10;     // 处理时间
  string resolver_id = 11;    // 处理人ID
}
```

##### Partition (分区信息)
```proto
message Partition {
  int32 id = 1;               // 分区ID
  string name = 2;            // 分区名称
  string description = 3;     // 分区描述
  string icon = 4;            // 分区图标
  int32 sort_order = 5;       // 排序顺序
  bool is_active = 6;         // 是否启用
}
```

##### SystemStats (系统统计)
```proto
message SystemStats {
  int32 total_users = 1;      // 总用户数
  int32 active_users = 2;     // 活跃用户数
  int32 total_posts = 3;      // 总帖子数
  int32 total_comments = 4;   // 总评论数
  int32 pending_reports = 5;  // 待处理举报数
  int64 bandwidth_used = 6;   // 带宽使用量
  int64 storage_used = 7;     // 存储使用量
}
```

#### RPC 方法

##### ListReports (举报受理列表)
```proto
rpc ListReports(ListReportsRequest) returns (ListReportsResponse);
```
- 请求：`ListReportsRequest`
  - `status` (ReportStatus)
  - `pagination` (Pagination)
- 响应：`ListReportsResponse`
  - `reports` (repeated Report)
  - `next_page_token` (string)

##### ResolveReport (处理举报)
```proto
rpc ResolveReport(ResolveReportRequest) returns (ResolveReportResponse);
```
- 请求：`ResolveReportRequest`
  - `report_id` (string)
  - `action` (ReportAction)
  - `note` (string)
- 响应：`ResolveReportResponse`

##### UpdateUserRole (权限管理)
```proto
rpc UpdateUserRole(UpdateUserRoleRequest) returns (UpdateUserRoleResponse);
```
- 请求：`UpdateUserRoleRequest`
  - `user_id` (string)
  - `role` (Role)
- 响应：`UpdateUserRoleResponse`

##### UpsertSiteContent (编辑官网内容)
```proto
rpc UpsertSiteContent(UpsertSiteContentRequest) returns (UpsertSiteContentResponse);
```
- 请求：`UpsertSiteContentRequest`
  - `content` (oneof)
    - `history` (HistoryEvent)
    - `activity` (Activity)
    - `department` (DepartmentInfo)
    - `minister` (MinisterInfo)
    - `staff` (StaffGroup)
- 响应：`UpsertSiteContentResponse`

##### ManagePartition (分区管理)
```proto
rpc ManagePartition(ManagePartitionRequest) returns (ManagePartitionResponse);
```
- 请求：`ManagePartitionRequest`
  - `partitions` (repeated Partition)
- 响应：`ManagePartitionResponse`

##### GetSystemStats (获取系统统计)
```proto
rpc GetSystemStats(GetSystemStatsRequest) returns (GetSystemStatsResponse);
```
- 请求：`GetSystemStatsRequest`
- 响应：`GetSystemStatsResponse`
  - `stats` (SystemStats)

---

## 3. Community (社区内容微服务)

### 3.1 Content Service (内容服务)

#### 文件位置
`proto/api/v1/community/content.proto`

#### 核心模型

##### Post (帖子)
```proto
message Post {
  string post_id = 1;         // 帖子ID
  UserSummary author = 2;     // 作者信息
  string title = 3;          // 标题
  string content = 4;        // 内容
  repeated Media media = 5;  // 媒体资源
  int32 partition_id = 6;    // 分区ID
  string partition_name = 7; // 分区名称
  int32 like_count = 8;      // 点赞数
  int32 comment_count = 9;   // 评论数
  int32 collect_count = 10;  // 收藏数
  int32 view_count = 11;     // 浏览数
  bool is_liked = 12;        // 当前用户是否已点赞
  bool is_collected = 13;    // 当前用户是否已收藏
  int64 created_at = 14;     // 创建时间戳
  int64 updated_at = 15;     // 更新时间戳
}
```

##### UserPostType (用户相关帖子类型)
```proto
enum UserPostType {
  USER_POST_TYPE_PUBLISHED = 0;   // 发布的
  USER_POST_TYPE_LIKED = 1;       // 喜欢的
  USER_POST_TYPE_COLLECTED = 2;   // 收藏的
}
```

##### PostCategory (帖子推荐分区)
```proto
enum PostCategory {
  POST_CATEGORY_RECOMMEND = 0;
  POST_CATEGORY_HOT = 1;
  POST_CATEGORY_NEW = 2;
  POST_CATEGORY_FOLLOWING = 3;
  POST_CATEGORY_DEPARTMENT = 4;
}
```

#### RPC 方法

##### CreatePost (发布帖子)
```proto
rpc CreatePost(CreatePostRequest) returns (CreatePostResponse);
```
- 请求：`CreatePostRequest`
  - `title` (string)
  - `content` (string)
  - `media` (repeated Media)
  - `partition_id` (int32)
- 响应：`CreatePostResponse`
  - `post` (Post)

##### DeletePost (删除帖子)
```proto
rpc DeletePost(DeletePostRequest) returns (DeletePostResponse);
```
- 请求：`DeletePostRequest`
  - `post_id` (string)
- 响应：`DeletePostResponse`
  - `succeed` (bool)

##### GetPost (帖子详情)
```proto
rpc GetPost(GetPostRequest) returns (GetPostResponse);
```
- 请求：`GetPostRequest`
  - `post_id` (string)
- 响应：`GetPostResponse`
  - `post` (Post)

##### ListPosts (首页瀑布流)
```proto
rpc ListPosts(ListPostsRequest) returns (ListPostsResponse);
```
- 请求：`ListPostsRequest`
  - `category` (PostCategory)
  - `pagination` (Pagination)
- 响应：`ListPostsResponse`
  - `posts` (repeated Post)
  - `next_page_token` (string)

##### ListUserPosts (个人页作品集)
```proto
rpc ListUserPosts(ListUserPostsRequest) returns (ListUserPostsResponse);
```
- 请求：`ListUserPostsRequest`
  - `user_id` (string)
  - `type` (UserPostType)
  - `pagination` (Pagination)
- 响应：`ListUserPostsResponse`
  - `posts` (repeated Post)
  - `next_page_token` (string)

##### SearchPosts (搜索帖子)
```proto
rpc SearchPosts(SearchPostsRequest) returns (SearchPostsResponse);
```
- 请求：`SearchPostsRequest`
  - `keyword` (string)
  - `pagination` (Pagination)
- 响应：`SearchPostsResponse`
  - `posts` (repeated Post)
  - `next_page_token` (string)

---

### 3.2 Interaction & Comment Services (互动服务)

#### 文件位置
`proto/api/v1/community/interaction.proto`

#### 核心模型

##### TargetType (互动目标类型)
```proto
enum TargetType {
  TARGET_TYPE_POST = 0;
  TARGET_TYPE_COMMENT = 1;
}
```

##### CommentSort (评论排序方式)
```proto
enum CommentSort {
  COMMENT_SORT_HOT = 0;
  COMMENT_SORT_NEW = 1;
}
```

##### Comment (评论)
```proto
message Comment {
  string comment_id = 1;
  UserSummary author = 2;
  string content = 3;
  string post_id = 4;
  string root_id = 5;  // 一级评论ID
  string reply_to_user_id = 6;
  int32 like_count = 7;
  bool is_liked = 8;
  int64 created_at = 9;
  repeated Comment replies = 10;  // 二级回复
}
```

#### RPC 方法 - InteractionService

##### SetLike (点赞/取消赞)
```proto
rpc SetLike(SetLikeRequest) returns (SetLikeResponse);
```
- 请求：`SetLikeRequest`
  - `target_id` (string)
  - `type` (TargetType)
  - `is_active` (bool) - true=点赞, false=取消
- 响应：`SetLikeResponse`
  - `succeed` (bool)

##### SetCollect (收藏/取消收藏)
```proto
rpc SetCollect(SetCollectRequest) returns (SetCollectResponse);
```
- 请求：`SetCollectRequest`
  - `post_id` (string)
  - `is_active` (bool) - true=收藏, false=取消
- 响应：`SetCollectResponse`
  - `succeed` (bool)

#### RPC 方法 - CommentService

##### CreateComment (发送评论)
```proto
rpc CreateComment(CreateCommentRequest) returns (CreateCommentResponse);
```
- 请求：`CreateCommentRequest`
  - `post_id` (string)
  - `content` (string)
  - `root_id` (string)
  - `reply_to_user_id` (string)
- 响应：`CreateCommentResponse`
  - `comment` (Comment)

##### ListComments (评论列表)
```proto
rpc ListComments(ListCommentsRequest) returns (ListCommentsResponse);
```
- 请求：`ListCommentsRequest`
  - `post_id` (string)
  - `root_id` (string)
  - `sort` (CommentSort)
  - `pagination` (Pagination)
- 响应：`ListCommentsResponse`
  - `comments` (repeated Comment)
  - `next_page_token` (string)

##### DeleteComment (删除评论)
```proto
rpc DeleteComment(DeleteCommentRequest) returns (DeleteCommentResponse);
```
- 请求：`DeleteCommentRequest`
  - `comment_id` (string)
- 响应：`DeleteCommentResponse`
  - `succeed` (bool)

---

### 3.3 Site Service (官网服务)

#### 文件位置
`proto/api/v1/community/site.proto`

#### 核心模型

##### DepartmentInfo (部门信息)
```proto
message DepartmentInfo {
  string id = 1;              // 部门ID
  string name = 2;            // 部门名称（中文）
  string name_en = 3;         // 部门名称（英文）
  string logo = 4;            // 部门Logo
  string cover_image = 5;     // 封面图片
  string video_url = 6;       // 宣传视频
  string description = 7;     // 部门简介
  map<string, string> links = 8;  // 相关链接
}
```

##### Activity (活动信息)
```proto
message Activity {
  string id = 1;              // 活动ID
  string name = 2;            // 活动名称（中文）
  string name_en = 3;         // 活动名称（英文）
  string cover_image = 4;     // 封面图片
  string video_url = 5;       // 宣传视频
  string description = 6;     // 活动简介
  string start_time = 7;      // 开始时间
  string end_time = 8;        // 结束时间
  map<string, string> links = 9;  // 相关链接
}
```

##### HistoryEvent (历史事件)
```proto
message HistoryEvent {
  string id = 1;              // 事件ID
  string year = 2;            // 年份
  string date = 3;            // 日期
  string title = 4;           // 事件标题
  string description = 5;     // 事件描述
  string image = 6;           // 事件图片
}
```

##### MinisterInfo (部长信息)
```proto
message MinisterInfo {
  string id = 1;              // 部长ID
  string user_id = 2;         // 用户ID
  string nickname = 3;        // 昵称
  string avatar = 4;          // 头像
  string department = 5;      // 所属部门
  string position = 6;        // 职位
  string intro = 7;           // 个人简介
  map<string, string> links = 8;  // 外部链接
  int32 year = 9;             // 任职年份
}
```

##### StaffGroup (Staff 分组)
```proto
message StaffGroup {
  string id = 1;              // 分组ID
  string name = 2;            // 分组名称
  repeated StaffMember members = 3;  // 成员列表
}
```

##### StaffMember (Staff 成员)
```proto
message StaffMember {
  string id = 1;              // 成员ID
  string user_id = 2;         // 用户ID
  string nickname = 3;        // 昵称
  string avatar = 4;          // 头像
  string role = 5;            // 职责
  string department = 6;      // 所属部门
  string intro = 7;           // 个人简介
  map<string, string> links = 8;  // 外部链接
}
```

##### SponsorInfo (赞助信息)
```proto
message SponsorInfo {
  string id = 1;              // 赞助ID
  string name = 2;            // 赞助名称
  string avatar = 3;          // 头像
  string department = 4;      // 所属部门
  string intro = 5;           // 简介
  map<string, string> links = 6;  // 外部链接
  string sponsor_amount = 7;  // 赞助金额
}
```

#### RPC 方法

##### ListDepartments (部门介绍)
```proto
rpc ListDepartments(ListDepartmentsRequest) returns (ListDepartmentsResponse);
```
- 请求：`ListDepartmentsRequest`
- 响应：`ListDepartmentsResponse`
  - `list` (repeated DepartmentInfo)

##### ListActivities (活动信息)
```proto
rpc ListActivities(ListActivitiesRequest) returns (ListActivitiesResponse);
```
- 请求：`ListActivitiesRequest`
- 响应：`ListActivitiesResponse`
  - `list` (repeated Activity)

##### ListHistory (发展历程)
```proto
rpc ListHistory(ListHistoryRequest) returns (ListHistoryResponse);
```
- 请求：`ListHistoryRequest`
- 响应：`ListHistoryResponse`
  - `list` (repeated HistoryEvent)

##### ListMinisters (部长宣言)
```proto
rpc ListMinisters(ListMinistersRequest) returns (ListMinistersResponse);
```
- 请求：`ListMinistersRequest`
  - `year` (int32)
- 响应：`ListMinistersResponse`
  - `list` (repeated MinisterInfo)

##### ListStaff (Staff/赞助)
```proto
rpc ListStaff(ListStaffRequest) returns (ListStaffResponse);
```
- 请求：`ListStaffRequest`
- 响应：`ListStaffResponse`
  - `list` (repeated StaffGroup)

---

### 3.4 Resource Service (资源服务)

#### 文件位置
`proto/api/v1/community/resource.proto`

#### RPC 方法

##### GetUploadToken (获取上传凭证)
```proto
rpc GetUploadToken(GetUploadTokenRequest) returns (GetUploadTokenResponse);
```
- 请求：`GetUploadTokenRequest`
  - `filename` (string) - 文件名
  - `size` (int64) - 文件大小
  - `usage` (string) - 用途：Avatar/Post
- 响应：`GetUploadTokenResponse`
  - `upload_url` (string) - 上传地址
  - `public_url` (string) - 公开访问地址

---

## 4. Messenger (即时通讯微服务)

### 4.1 Message Service (消息与通知服务)

#### 文件位置
`proto/api/v1/messenger/message.proto`

#### 核心模型

##### MessageType (消息类型)
```proto
enum MessageType {
  MESSAGE_TYPE_UNSPECIFIED = 0;
  MESSAGE_TYPE_TEXT = 1;
  MESSAGE_TYPE_IMAGE = 2;
  MESSAGE_TYPE_VIDEO = 3;
  MESSAGE_TYPE_AUDIO = 4;
}
```

##### Message (私信)
```proto
message Message {
  string message_id = 1;
  string sender_id = 2;
  string receiver_id = 3;
  MessageType type = 4;
  string content = 5;
  int64 sent_at = 6; // 毫秒时间戳
  bool is_read = 7;

  enum Status {
    SENDING = 0;
    SUCCESS = 1;
    FAILED = 2;
  }
  Status status = 8;
}
```

##### Conversation (会话)
```proto
message Conversation {
  string conversation_id = 1;
  UserSummary peer = 2;         // 对方用户信息（头像、昵称、部门徽章）
  Message last_message = 3;    // 最后一条消息摘要
  int32 unread_count = 4;      // 未读数
  int64 updated_at = 5;        // 用于排序
  bool is_pinned = 6;          // 是否置顶
}
```

##### NotificationAction (互动通知分类)
```proto
enum NotificationAction {
  ACTION_UNSPECIFIED = 0;
  ACTION_LIKE = 1;           // 赞
  ACTION_COLLECTION = 2;     // 收藏
  ACTION_COMMENT = 3;        // 评论
  ACTION_MENTION = 4;        // @ 提到
  ACTION_FOLLOW = 5;         // 新增关注
  ACTION_SYSTEM = 6;         // 晒你通知（系统管理通知）
  ACTION_REPORT_FEEDBACK = 7; // 举报受理反馈（管理通知）
}
```

##### Notification (通知)
```proto
message Notification {
  string notification_id = 1;
  NotificationAction action = 2; // 通知具体动作
  string title = 3;              // 标题
  string content = 4;            // 预览文本（如评论的具体内容）

  string target_id = 5;          // 关联的帖子ID或评论ID
  string target_type = 6;        // 目标类型（post/comment）

  repeated UserSummary actors = 7;
  int32 total_actors_count = 8;   // 总参与人数

  bool is_read = 9;
  int64 created_at = 10;          // 创建时间，遵循原则A显示规则
}
```

#### RPC 方法

##### ListConversations (获取会话列表)
```proto
rpc ListConversations(ListConversationsRequest) returns (ListConversationsResponse);
```
- 请求：`ListConversationsRequest`
  - `pagination` (Pagination) - 游标分页
- 响应：`ListConversationsResponse`
  - `conversations` (repeated Conversation)
  - `next_page_token` (string)

##### ListMessages (获取聊天记录)
```proto
rpc ListMessages(ListMessagesRequest) returns (ListMessagesResponse);
```
- 请求：`ListMessagesRequest`
  - `peer_id` (string)
  - `pagination` (Pagination)
  - `search_keyword` (string) - 对话内关键词搜索
- 响应：`ListMessagesResponse`
  - `messages` (repeated Message)
  - `next_page_token` (string)

##### SendMessage (发送私信)
```proto
rpc SendMessage(SendMessageRequest) returns (SendMessageResponse);
```
- 请求：`SendMessageRequest`
  - `receiver_id` (string)
  - `content` (string)
  - `type` (MessageType)
- 响应：`SendMessageResponse`
  - `message` (Message)

##### ListNotifications (获取通知列表)
```proto
rpc ListNotifications(ListNotificationsRequest) returns (ListNotificationsResponse);
```
- 请求：`ListNotificationsRequest`
  - `filter_actions` (NotificationAction) - 按互动类型过滤
  - `pagination` (Pagination)
- 响应：`ListNotificationsResponse`
  - `notifications` (repeated Notification)
  - `next_page_token` (string)
  - `total_unread_count` (int32) - 方便 Tab 导航栏显示角标

##### MarkRead (批量标记已读)
```proto
rpc MarkRead(MarkReadRequest) returns (MarkReadResponse);
```
- 请求：`MarkReadRequest`
  - `scope` (Scope)
    - `SCOPE_ALL` (0) - 清除所有红点
    - `SCOPE_CONVERSATION` (1) - 标记一个会话已读
    - `SCOPE_NOTIFICATION_TYPE` (2) - 标记一个类型已读
  - `target` (oneof)
    - `conversation_id` (string)
    - `notification_type` (NotificationAction)
- 响应：`MarkReadResponse`
  - `success` (bool)
