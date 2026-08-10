-- 迁移版本：20260301000001
-- 描述：初始化全部应用表结构
--
-- 由 Atlas + GORM provider 管理，未来请勿手动修改此文件。
-- 如需变更 schema，请修改 internal/model/*.go 后执行：
--   atlas migrate diff <描述> --env local
--
-- Up：所有 CREATE TABLE 均带 IF NOT EXISTS 保护，
--     可安全地在「全新数据库」和「已由 GORM CreateTable 初始化的数据库」上执行。
-- Down：按外键依赖顺序反向删除所有表（索引随表自动删除）。

-- +goose Up

-- =============================================================================
-- 基础字典表
-- =============================================================================

-- departments：部门/社团徽章参考表，由管理员维护
CREATE TABLE IF NOT EXISTS departments (
    id         SERIAL      PRIMARY KEY,
    name       varchar(12) NOT NULL UNIQUE,
    sort_order integer     NOT NULL DEFAULT 0
);

-- partitions：帖子内容分区，由管理员维护
CREATE TABLE IF NOT EXISTS partitions (
    id         SERIAL      PRIMARY KEY,
    name       varchar(12) NOT NULL UNIQUE,
    sort_order integer     NOT NULL DEFAULT 0
);

-- =============================================================================
-- 媒体系统
-- =============================================================================

-- media_assets：一个媒体元素（图片/视频/Live Photo）
CREATE TABLE IF NOT EXISTS media_assets (
    id            bigint      NOT NULL,
    created_at    timestamptz,
    updated_at    timestamptz,
    deleted_at    timestamptz,
    batch_id      varchar(64) NOT NULL,
    scene         integer     NOT NULL,
    media_type    integer     NOT NULL,
    order_index   integer     NOT NULL DEFAULT 0,
    crop_cover    boolean     NOT NULL DEFAULT false,
    status        integer     NOT NULL DEFAULT 0,
    error_message text        NOT NULL DEFAULT '',
    PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_assets_batch_order
    ON media_assets (batch_id, order_index);

CREATE INDEX IF NOT EXISTS idx_media_assets_deleted_at
    ON media_assets (deleted_at);

-- media_files：asset 内的单个物理文件（一 asset 含 1-2 个 file）
CREATE TABLE IF NOT EXISTS media_files (
    id             bigint       NOT NULL,
    created_at     timestamptz,
    updated_at     timestamptz,
    deleted_at     timestamptz,
    asset_id       bigint       NOT NULL,
    batch_id       varchar(64)  NOT NULL,
    task_id        varchar(64)  NOT NULL,
    role           varchar(32)  NOT NULL,
    media_type     integer      NOT NULL,
    bucket         varchar(100) NOT NULL,
    object_key     text         NOT NULL,
    status         integer      NOT NULL DEFAULT 0,
    thumbnail_key  text         NOT NULL DEFAULT '',
    error_message  text         NOT NULL DEFAULT '',
    original_mime  varchar(255) NOT NULL DEFAULT '',
    processed_meta jsonb,
    PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_files_task_id
    ON media_files (task_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_media_files_asset_role
    ON media_files (asset_id, role);

CREATE INDEX IF NOT EXISTS idx_media_files_batch_status
    ON media_files (batch_id, status);

CREATE INDEX IF NOT EXISTS idx_media_files_deleted_at
    ON media_files (deleted_at);

-- =============================================================================
-- 用户体系
-- =============================================================================

-- users：账号 + 用户资料合并表
CREATE TABLE IF NOT EXISTS users (
    id                        bigint      NOT NULL,
    created_at                timestamptz,
    updated_at                timestamptz,
    deleted_at                timestamptz,
    qq_union_id               varchar(64) NOT NULL,
    qq_number                 varchar(16) NOT NULL,
    role                      integer     NOT NULL DEFAULT 1,
    ban_expire_at             timestamptz,
    name                      text,
    avatar                    text,
    verified_title            varchar(12),
    departments               jsonb       NOT NULL DEFAULT '[]',
    external_links            jsonb       NOT NULL DEFAULT '[]',
    stat_followers            bigint      NOT NULL DEFAULT 0,
    stat_followings           bigint      NOT NULL DEFAULT 0,
    stat_likes_received       bigint      NOT NULL DEFAULT 0,
    stat_collections_received bigint      NOT NULL DEFAULT 0,
    stat_views_received       bigint      NOT NULL DEFAULT 0,
    PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_qq_union_id   ON users (qq_union_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_qq_number     ON users (qq_number);
CREATE INDEX        IF NOT EXISTS idx_users_ban_expire_at ON users (ban_expire_at);
CREATE INDEX        IF NOT EXISTS idx_users_deleted_at    ON users (deleted_at);

-- user_remarks：用户对他人设置的备注名
CREATE TABLE IF NOT EXISTS user_remarks (
    owner_id  bigint      NOT NULL,
    target_id bigint      NOT NULL,
    remark    varchar(12) NOT NULL,
    PRIMARY KEY (owner_id, target_id)
);

-- user_settings：客户端同步的用户偏好，每人一行
CREATE TABLE IF NOT EXISTS user_settings (
    user_id                 bigint  NOT NULL,
    notification            jsonb   NOT NULL DEFAULT '{}',
    privacy_chat            integer NOT NULL DEFAULT 0,
    privacy_liked_posts     integer NOT NULL DEFAULT 0,
    privacy_collected_posts integer NOT NULL DEFAULT 0,
    content_category_order  jsonb   NOT NULL DEFAULT '[]',
    PRIMARY KEY (user_id)
);

-- devices：已登录设备信息
CREATE TABLE IF NOT EXISTS devices (
    device_id                varchar(128) NOT NULL,
    user_id                  bigint       NOT NULL,
    platform                 integer      NOT NULL,
    device_name              varchar(100),
    os_version               varchar(50),
    client_version           varchar(50),
    push_token               text,
    refresh_token_jti        varchar(64)  NOT NULL,
    refresh_token_expires_at timestamptz,
    sync_data_versions       jsonb        NOT NULL DEFAULT '{}',
    last_active_at           timestamptz,
    created_at               timestamptz,
    updated_at               timestamptz,
    PRIMARY KEY (device_id)
);

CREATE INDEX        IF NOT EXISTS idx_devices_user_id           ON devices (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_refresh_token_jti ON devices (refresh_token_jti);

-- verification_applications：用户认证申请，每人至多一条
CREATE TABLE IF NOT EXISTS verification_applications (
    user_id            bigint      NOT NULL,
    title              varchar(12) NOT NULL,
    description        varchar(200),
    evidence_asset_ids jsonb       NOT NULL DEFAULT '[]',
    status             integer     NOT NULL DEFAULT 0,
    reviewer_id        bigint,
    admin_comment      varchar(200),
    created_at         timestamptz,
    updated_at         timestamptz,
    PRIMARY KEY (user_id)
);

CREATE INDEX IF NOT EXISTS idx_verification_cursor
    ON verification_applications (created_at, user_id);

CREATE INDEX IF NOT EXISTS idx_verification_applications_status
    ON verification_applications (status);

-- =============================================================================
-- 内容体系
-- =============================================================================

-- posts：帖子主体
CREATE TABLE IF NOT EXISTS posts (
    id               bigint  NOT NULL,
    created_at       timestamptz,
    updated_at       timestamptz,
    deleted_at       timestamptz,
    partition_id     integer NOT NULL,
    author_id        bigint  NOT NULL,
    title            varchar(20),
    content          varchar(10000),
    asset_ids        jsonb   NOT NULL DEFAULT '[]',
    cover_asset_id   bigint,
    stat_likes       bigint  NOT NULL DEFAULT 0,
    stat_collections bigint  NOT NULL DEFAULT 0,
    stat_comments    bigint  NOT NULL DEFAULT 0,
    stat_views       bigint  NOT NULL DEFAULT 0,
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_posts_cursor
    ON posts (created_at DESC, id DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_posts_author_feed
    ON posts (author_id, created_at DESC, id DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_posts_partition_feed
    ON posts (partition_id, created_at DESC, id DESC)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_posts_deleted_at ON posts (deleted_at);

-- comments：帖子评论与回复（通过 parent_id IS NULL 区分一/二级）
CREATE TABLE IF NOT EXISTS comments (
    id                  bigint       NOT NULL,
    created_at          timestamptz  NOT NULL DEFAULT now(),
    updated_at          timestamptz,
    deleted_at          timestamptz,
    target_id           bigint       NOT NULL,
    target_type         integer      NOT NULL DEFAULT 1,
    parent_id           bigint,
    reply_to_comment_id bigint,
    reply_to_user_id    bigint,
    reply_to_user_name  text,
    author_id           bigint       NOT NULL,
    content             varchar(300) NOT NULL,
    asset_ids           jsonb        NOT NULL DEFAULT '[]',
    stat_like           bigint       NOT NULL DEFAULT 0,
    stat_reply          bigint       NOT NULL DEFAULT 0,
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_comment_target_time
    ON comments (target_id, parent_id, created_at, id);

CREATE INDEX IF NOT EXISTS idx_comment_parent_time
    ON comments (parent_id, created_at, id);

CREATE INDEX IF NOT EXISTS idx_comments_deleted_at ON comments (deleted_at);

-- =============================================================================
-- 社交关系
-- =============================================================================

-- follows：关注关系，复合主键天然去重
CREATE TABLE IF NOT EXISTS follows (
    follower_id  bigint      NOT NULL,
    following_id bigint      NOT NULL,
    last_read_at timestamptz,
    created_at   timestamptz,
    PRIMARY KEY (follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_by_follower
    ON follows (follower_id, created_at, following_id);

CREATE INDEX IF NOT EXISTS idx_follows_by_following
    ON follows (following_id, created_at, follower_id);

-- interactions：点赞/收藏/浏览/回复行为，复合主键天然去重
CREATE TABLE IF NOT EXISTS interactions (
    user_id     bigint      NOT NULL,
    target_id   bigint      NOT NULL,
    target_type integer     NOT NULL,
    action_type integer     NOT NULL,
    created_at  timestamptz,
    PRIMARY KEY (user_id, target_id, target_type, action_type)
);

CREATE INDEX IF NOT EXISTS idx_interactions_created_at ON interactions (created_at);

-- =============================================================================
-- 通知
-- =============================================================================

-- notifications：用户收到的各类通知
CREATE TABLE IF NOT EXISTS notifications (
    id          bigint  NOT NULL,
    created_at  timestamptz,
    updated_at  timestamptz,
    deleted_at  timestamptz,
    user_id     bigint  NOT NULL,
    category    integer NOT NULL,
    sub_type    integer NOT NULL,
    actor_id    bigint,
    target_type integer,
    target_id   bigint,
    extra       jsonb,
    is_read     boolean NOT NULL DEFAULT false,
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_feed
    ON notifications (user_id, category, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_category_unread
    ON notifications (user_id, category)
    WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_deleted_at ON notifications (deleted_at);

-- =============================================================================
-- 举报
-- =============================================================================

-- report_tickets：举报工单
CREATE TABLE IF NOT EXISTS report_tickets (
    id           bigint      NOT NULL,
    created_at   timestamptz,
    updated_at   timestamptz,
    deleted_at   timestamptz,
    target_type  integer     NOT NULL,
    target_id    bigint      NOT NULL,
    cnt_reports  integer     NOT NULL DEFAULT 1,
    status       integer     NOT NULL DEFAULT 0,
    processor_id bigint,
    process_note varchar(200),
    PRIMARY KEY (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_report_target
    ON report_tickets (target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_report_tickets_feed
    ON report_tickets (status ASC, updated_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_report_tickets_deleted_at ON report_tickets (deleted_at);

-- report_records：单条举报证据（不可变）
CREATE TABLE IF NOT EXISTS report_records (
    id                 bigint      NOT NULL,
    ticket_id          bigint      NOT NULL,
    reporter_id        bigint      NOT NULL,
    reason             varchar(200),
    evidence_asset_ids jsonb       NOT NULL DEFAULT '[]',
    created_at         timestamptz,
    PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_report_records_ticket_cursor
    ON report_records (ticket_id, created_at, id);

CREATE INDEX IF NOT EXISTS idx_report_records_reporter_id ON report_records (reporter_id);

-- +goose Down

-- 按外键逻辑依赖顺序，逆向删除（索引随表自动删除）

DROP TABLE IF EXISTS report_records;
DROP TABLE IF EXISTS report_tickets;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS interactions;
DROP TABLE IF EXISTS follows;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS verification_applications;
DROP TABLE IF EXISTS devices;
DROP TABLE IF EXISTS user_settings;
DROP TABLE IF EXISTS user_remarks;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS media_files;
DROP TABLE IF EXISTS media_assets;
DROP TABLE IF EXISTS partitions;
DROP TABLE IF EXISTS departments;
