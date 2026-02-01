# Shining ACG API 文档

## 概述

Shining ACG App 的后端 API 文档，基于 Protocol Buffers 和 Connect-Go 框架。

## 模块索引

| 模块 | 服务 | 文件 |
|------|------|------|
| 通用 | - | `common.proto` |
| 认证 | `AuthService` | `auth.proto` |
| 用户 | `UserService` | `user.proto` |
| 资源 | `ResourceService` | `resource.proto` |
| 内容 | `ContentService` | `content.proto` |
| 互动 | `InteractionService`, `CommentService` | `interaction.proto` |
| 消息 | `MessageService` | `message.proto` |
| 官网 | `SiteService` | `site.proto` |
| 管理 | `AdminService` | `admin.proto` |

---

## 通用类型

### Department（部门枚举）

| 值 | 说明 |
|-----|------|
| `DEPARTMENT_UNSPECIFIED` | 未指定 |
| `DEPARTMENT_PROGRAMMING` | 程序部 |
| `DEPARTMENT_ART` | 美术部 |
| `DEPARTMENT_GAME` | 游戏部 |
| `DEPARTMENT_VIDEO` | 视频部 |
| `DEPARTMENT_MUSIC` | 音乐部 |
| `DEPARTMENT_WRITING` | 轻文部 |
| `DEPARTMENT_COSPLAY` |  cos部 |

### Role（角色枚举）

| 值 | 说明 |
|-----|------|
| `ROLE_UNSPECIFIED` | 未指定 |
| `ROLE_USER` | 普通用户 |
| `ROLE_ADMIN` | 管理员 |
| `ROLE_SUPER_ADMIN` | 超级管理员 |

### Media（多媒体资源）

```proto
message Media {
  string type = 1;        // "image" | "video"
  string url = 2;         // 资源地址
  string thumbnail = 3;   // 缩略图（视频用）
  int32 width = 4;        // 宽
  int32 height = 5;       // 高
}
```

### Pagination（分页请求）

```proto
message Pagination {
  int32 page_size = 1;    // 每页数量
  string page_token = 2;  // 游标（用于瀑布流/无限滚动）
  int32 page = 3;         // 页码（仅用于传统列表）
}
```

---

## AuthService（认证服务）

### Login - QQ 登录/注册

```proto
rpc Login(LoginRequest) returns (LoginResponse);
```

**请求**：
```proto
message LoginRequest {
  string qq_access_token = 1;  // QQ 访问令牌
  string device_info = 2;     // 设备信息
}
```

**响应**：
```proto
message LoginResponse {
  string session_token = 1;  // 会话令牌
  User me = 2;              // 用户信息
}
```

### Logout - 退出登录

```proto
rpc Logout(LogoutRequest) returns (LogoutResponse);
```

### RefreshToken - 刷新 Token

```proto
rpc RefreshToken(RefreshTokenRequest) returns (RefreshTokenResponse);
```

**请求**：
```proto
message RefreshTokenRequest {
  string refresh_token = 1;  // 刷新令牌
}
```

**响应**：
```proto
message RefreshTokenResponse {
  string session_token = 1;  // 新的会话令牌
}
```

---

## UserService（用户服务）

### GetMe - 获取自己详细信息

```proto
rpc GetMe(GetMeRequest) returns (GetMeResponse);
```

**响应**：
```proto
message GetMeResponse {
  User user = 1;
  Settings settings = 2;
}
```

### GetUser - 获取他人信息

```proto
rpc GetUser(GetUserRequest) returns (GetUserResponse);
```

**请求**：
```proto
message GetUserRequest {
  string user_id = 1;
}
```

**响应**：
```proto
message GetUserResponse {
  User user = 1;
  bool is_following = 2;
  string remark = 3;
}
```

### UpdateProfile - 编辑资料

```proto
rpc UpdateProfile(UpdateProfileRequest) returns (UpdateProfileResponse);
```

**请求**：
```proto
message UpdateProfileRequest {
  string nickname = 1;
  string avatar = 2;
  string intro = 3;
  map<string, string> links = 4;
}
```

### Follow / Unfollow - 关注/取消关注

```proto
rpc Follow(FollowRequest) returns (FollowResponse);
rpc Unfollow(UnfollowRequest) returns (UnfollowResponse);
```

### ListFollowers / ListFollowing - 粉丝/关注列表

```proto
rpc ListFollowers(ListFollowersRequest) returns (ListFollowersResponse);
rpc ListFollowing(ListFollowingRequest) returns (ListFollowingResponse);
```

**请求**：
```proto
message ListFollowersRequest {
  string user_id = 1;
  Pagination pagination = 2;
}
```

**响应**：
```proto
message ListFollowersResponse {
  repeated User users = 1;
  string next_page_token = 2;
}
```

### SearchUsers - 搜索用户

```proto
rpc SearchUsers(SearchUsersRequest) returns (SearchUsersResponse);
```

**请求**：
```proto
message SearchUsersRequest {
  string keyword = 1;
}
```

**响应**：
```proto
message SearchUsersResponse {
  repeated User users = 1;
}
```

---

## ResourceService（资源服务）

### GetUploadToken - 获取上传凭证

```proto
rpc GetUploadToken(GetUploadTokenRequest) returns (GetUploadTokenResponse);
```

**请求**：
```proto
message GetUploadTokenRequest {
  string filename = 1;  // 文件名
  int64 size = 2;       // 文件大小
  string usage = 3;     // 用途：Avatar/Post
}
```

**响应**：
```proto
message GetUploadTokenResponse {
  string upload_url = 1;    // 上传地址
  string public_url = 2;    // 公开访问地址
}
```

---

## ContentService（内容服务）

### CreatePost - 发布帖子

```proto
rpc CreatePost(CreatePostRequest) returns (CreatePostResponse);
```

**请求**：
```proto
message CreatePostRequest {
  string title = 1;
  string content = 2;
  repeated Media media = 3;
  int32 partition_id = 4;
}
```

### DeletePost - 删除帖子

```proto
rpc DeletePost(DeletePostRequest) returns (DeletePostResponse);
```

### GetPost - 帖子详情

```proto
rpc GetPost(GetPostRequest) returns (GetPostResponse);
```

### ListPosts - 首页瀑布流

```proto
rpc ListPosts(ListPostsRequest) returns (ListPostsResponse);
```

**请求**：
```proto
message ListPostsRequest {
  PostCategory category = 1;  // 推荐/热门/最新/关注/部门
  Pagination pagination = 2;
}
```

**响应**：
```proto
message ListPostsResponse {
  repeated Post posts = 1;
  string next_page_token = 2;
}
```

### ListUserPosts - 个人页作品集

```proto
rpc ListUserPosts(ListUserPostsRequest) returns (ListUserPostsResponse);
```

**请求**：
```proto
message ListUserPostsRequest {
  string user_id = 1;
  UserPostType type = 2;  // 发布/点赞/收藏
  Pagination pagination = 3;
}
```

### SearchPosts - 搜索帖子

```proto
rpc SearchPosts(SearchPostsRequest) returns (SearchPostsResponse);
```

---

## InteractionService（互动服务）

### SetLike - 点赞/取消赞

```proto
rpc SetLike(SetLikeRequest) returns (SetLikeResponse);
```

**请求**：
```proto
message SetLikeRequest {
  string target_id = 1;
  TargetType type = 2;    // 帖子/评论
  bool is_active = 3;     // true=点赞, false=取消
}
```

### SetCollect - 收藏/取消收藏

```proto
rpc SetCollect(SetCollectRequest) returns (SetCollectResponse);
```

**请求**：
```proto
message SetCollectRequest {
  string post_id = 1;
  bool is_active = 2;  // true=收藏, false=取消
}
```

---

## CommentService（评论服务）

### CreateComment - 发送评论

```proto
rpc CreateComment(CreateCommentRequest) returns (CreateCommentResponse);
```

**请求**：
```proto
message CreateCommentRequest {
  string post_id = 1;
  string content = 2;
  string root_id = 3;          // 一级评论ID
  string reply_to_user_id = 4;
}
```

**响应**：
```proto
message CreateCommentResponse {
  Comment comment = 1;
}
```

### ListComments - 评论列表

```proto
rpc ListComments(ListCommentsRequest) returns (ListCommentsResponse);
```

**请求**：
```proto
message ListCommentsRequest {
  string post_id = 1;
  string root_id = 2;         // 选填，查子楼层
  CommentSort sort = 3;      // 热门/最新
  Pagination pagination = 4;
}
```

**响应**：
```proto
message ListCommentsResponse {
  repeated Comment comments = 1;
  string next_page_token = 2;
}
```

### DeleteComment - 删除评论

```proto
rpc DeleteComment(DeleteCommentRequest) returns (DeleteCommentResponse);
```

---

## MessageService（消息服务）

### ListConversations - 会话列表

```proto
rpc ListConversations(ListConversationsRequest) returns (ListConversationsResponse);
```

**响应**：
```proto
message ListConversationsResponse {
  repeated Conversation list = 1;
  string next_page_token = 2;
}
```

### ListMessages - 聊天记录

```proto
rpc ListMessages(ListMessagesRequest) returns (ListMessagesResponse);
```

**请求**：
```proto
message ListMessagesRequest {
  string peer_id = 1;
  Pagination pagination = 2;
  string search_keyword = 3;
}
```

### SendMessage - 发送私信

```proto
rpc SendMessage(SendMessageRequest) returns (SendMessageResponse);
```

**请求**：
```proto
message SendMessageRequest {
  string receiver_id = 1;
  string content = 2;
  MessageType type = 3;  // Text/Image
}
```

### GetNotifications - 获取通知

```proto
rpc GetNotifications(GetNotificationsRequest) returns (GetNotificationsResponse);
```

**请求**：
```proto
message GetNotificationsRequest {
  NotificationType type = 1;  // 互动/系统
  Pagination pagination = 2;
}
```

**响应**：
```proto
message GetNotificationsResponse {
  repeated Notification list = 1;
  string next_page_token = 2;
  int32 unread_count = 3;
}
```

### MarkRead - 标记已读

```proto
rpc MarkRead(MarkReadRequest) returns (MarkReadResponse);
```

**请求**：
```proto
message MarkReadRequest {
  MarkReadScope scope = 1;  // All/Chat/Notification
  string target_id = 2;     // 可选，指定会话或通知ID
}
```

---

## SiteService（官网服务）

### ListDepartments - 部门介绍

```proto
rpc ListDepartments(ListDepartmentsRequest) returns (ListDepartmentsResponse);
```

**响应**：
```proto
message ListDepartmentsResponse {
  repeated DepartmentInfo list = 1;
}
```

### ListActivities - 活动信息

```proto
rpc ListActivities(ListActivitiesRequest) returns (ListActivitiesResponse);
```

**响应**：
```proto
message ListActivitiesResponse {
  repeated Activity list = 1;
}
```

### ListHistory - 发展历程

```proto
rpc ListHistory(ListHistoryRequest) returns (ListHistoryResponse);
```

**响应**：
```proto
message ListHistoryResponse {
  repeated HistoryEvent list = 1;
}
```

### ListMinisters - 部长宣言

```proto
rpc ListMinisters(ListMinistersRequest) returns (ListMinistersResponse);
```

**请求**：
```proto
message ListMinistersRequest {
  int32 year = 1;
}
```

**响应**：
```proto
message ListMinistersResponse {
  repeated MinisterInfo list = 1;
}
```

### ListStaff - Staff/赞助

```proto
rpc ListStaff(ListStaffRequest) returns (ListStaffResponse);
```

**响应**：
```proto
message ListStaffResponse {
  repeated StaffGroup list = 1;
}
```

---

## AdminService（管理服务）

### ListReports - 举报受理列表

```proto
rpc ListReports(ListReportsRequest) returns (ListReportsResponse);
```

**请求**：
```proto
message ListReportsRequest {
  ReportStatus status = 1;    // 待处理/已处理
  Pagination pagination = 2;
}
```

**响应**：
```proto
message ListReportsResponse {
  repeated Report reports = 1;
  string next_page_token = 2;
}
```

### ResolveReport - 处理举报

```proto
rpc ResolveReport(ResolveReportRequest) returns (ResolveReportResponse);
```

**请求**：
```proto
message ResolveReportRequest {
  string report_id = 1;
  ReportAction action = 2;  // Ignore/Ban/Delete
  string note = 3;
}
```

### UpdateUserRole - 权限管理

```proto
rpc UpdateUserRole(UpdateUserRoleRequest) returns (UpdateUserRoleResponse);
```

**请求**：
```proto
message UpdateUserRoleRequest {
  string user_id = 1;
  Role role = 2;
}
```

### UpsertSiteContent - 编辑官网内容

```proto
rpc UpsertSiteContent(UpsertSiteContentRequest) returns (UpsertSiteContentResponse);
```

**请求**：
```proto
message UpsertSiteContentRequest {
  oneof content {
    HistoryEvent history = 1;
    Activity activity = 2;
    DepartmentInfo department = 3;
    MinisterInfo minister = 4;
    StaffGroup staff = 5;
  }
}
```

### ManagePartition - 分区管理

```proto
rpc ManagePartition(ManagePartitionRequest) returns (ManagePartitionResponse);
```

**请求**：
```proto
message ManagePartitionRequest {
  repeated Partition partitions = 1;
}
```

### GetSystemStats - 获取系统统计

```proto
rpc GetSystemStats(GetSystemStatsRequest) returns (GetSystemStatsResponse);
```

**响应**：
```proto
message GetSystemStatsResponse {
  SystemStats stats = 1;
}
```

---

## 数据类型参考

### User（用户）

```proto
message User {
  string user_id = 1;
  string nickname = 2;
  string avatar = 3;
  string intro = 4;
  Department department = 5;
  string department_badge = 6;
  Role role = 7;
  bool is_verified = 8;
  int32 follower_count = 9;
  int32 following_count = 10;
  int32 post_count = 11;
  int32 like_count = 12;
  map<string, string> links = 13;
  string qq_number = 14;
}
```

### Post（帖子）

```proto
message Post {
  string post_id = 1;
  User author = 2;
  string title = 3;
  string content = 4;
  repeated Media media = 5;
  int32 partition_id = 6;
  string partition_name = 7;
  int32 like_count = 8;
  int32 comment_count = 9;
  int32 collect_count = 10;
  int32 view_count = 11;
  bool is_liked = 12;
  bool is_collected = 13;
  int64 created_at = 14;
  int64 updated_at = 15;
}
```

### Comment（评论）

```proto
message Comment {
  string comment_id = 1;
  User author = 2;
  string content = 3;
  string post_id = 4;
  string root_id = 5;
  string reply_to_user_id = 6;
  int32 like_count = 7;
  bool is_liked = 8;
  int64 created_at = 9;
  repeated Comment replies = 10;
}
```
