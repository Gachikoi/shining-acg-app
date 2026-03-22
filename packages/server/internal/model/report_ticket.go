package model

import (
	"time"

	reportv1 "app.shiningacg.club/gen/proto/api/main/report/v1"
)

// ReportTicket 是举报工单，每个（target_type, target_id）只允许一张工单（uniqueIndex）。
// 多条举报记录汇聚到同一张工单，通过 cnt_reports 计数。
// 对应 proto: api.main.report.v1.ReportItem
//
// 索引设计（idx_report_tickets_feed）：
//   - 复合索引 (status ASC, updated_at DESC, id DESC)
//   - 排序语义：PENDING(1) → PROCESSING(2) → RESOLVED(3) → REJECTED(4)，
//     status ASC 使待处理工单天然排在最前；
//     同状态内按 updated_at DESC 展示最近有动态的工单；
//     id DESC 作为 tiebreaker，确保同毫秒内多张工单时游标 (updated_at, id) 全局唯一
//   - 覆盖 ListReportsRequest keyset 游标：
//     WHERE (status, updated_at, id) < (cursor_status, cursor_t, cursor_id)
//     ORDER BY status ASC, updated_at DESC, id DESC
//   - status 作为首列同时覆盖原独立 status 索引的单列等值查询场景，原 index 已废弃
type ReportTicket struct {
	BaseModel

	// ID 覆盖 BaseModel.ID，作为游标索引的最右 tiebreaker（desc,priority:3）
	ID int64 `gorm:"primaryKey;autoIncrement:false;
		index:idx_report_tickets_feed,desc,priority:3" json:"id,string"`

	// UpdatedAt 覆盖 BaseModel.UpdatedAt，作为游标索引的次排序列（desc,priority:2）
	UpdatedAt time.Time `gorm:"index:idx_report_tickets_feed,desc,priority:2" json:"updated_at"`

	// 被举报对象，(target_type, target_id) 唯一，防止同一对象重复开单
	// 对应 proto: ReportType enum
	TargetType reportv1.ReportType `gorm:"not null;uniqueIndex:idx_report_target" json:"target_type"`
	TargetID   int64               `gorm:"not null;uniqueIndex:idx_report_target" json:"target_id,string"`

	// 举报汇总计数（业务层累加）
	CntReports int32 `gorm:"not null;default:1" json:"cnt_reports"`

	// 处理状态，对应 proto: ReportStatus enum
	// 作为游标索引首列（sort:asc,priority:1）：PENDING(1) 值最小，ASC 排序天然优先展示
	// 原独立 index 已合并进复合索引，无需保留
	Status reportv1.ReportStatus `gorm:"not null;default:0;
		index:idx_report_tickets_feed,sort:asc,priority:1" json:"status"`
	ProcessorID *int64 `json:"processor_id,string,omitempty"`
	ProcessNote string `gorm:"size:200" json:"process_note"`

	// Records 是该工单下的全部举报证据条目。
	// 虚拟关联（无 DB 级外键约束），通过 GORM Preload 生成：
	//   SELECT * FROM report_records WHERE ticket_id IN (...)
	// 命中 idx_report_records_ticket_cursor 前缀（ticket_id），消除 N+1。
	// 对应 proto: api.main.report.v1.ReportEvidenceItem[]
	Records []ReportRecord `gorm:"foreignKey:TicketID;references:ID" json:"records,omitempty"`
}
