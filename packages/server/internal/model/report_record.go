package model

import "time"

// ReportRecord 记录单条举报证据，不可变（无 UpdatedAt / DeletedAt）。
// 对应 proto: api.main.report.v1.ReportEvidenceItem
//
// 索引设计（idx_report_records_ticket_cursor）：
//   - 复合索引 (ticket_id, created_at, id)
//   - 覆盖 ListReportEvidenceRequest 游标分页：
//     WHERE ticket_id = ? AND (created_at, id) > (cursor_t, cursor_id)
//     ORDER BY created_at ASC, id ASC
//   - ticket_id 单列查询（所有证据计数等）同时由该索引前缀覆盖，原独立 index 可废弃
//   - id 作为 tiebreaker：同一毫秒内同一工单多条举报记录时保证游标唯一性
type ReportRecord struct {
	// id 同时作为游标索引的最右 tiebreaker（priority:3）
	ID int64 `gorm:"primaryKey;autoIncrement:false;
		index:idx_report_records_ticket_cursor,priority:3" json:"id,string"`
	// ticket_id 作为游标索引首列（priority:1），前缀覆盖原独立 index 的所有使用场景
	TicketID   int64 `gorm:"not null;index:idx_report_records_ticket_cursor,priority:1" json:"ticket_id,string"`
	ReporterID int64 `gorm:"not null;index" json:"reporter_id,string"`

	// 举报原因标签
	Reason string `gorm:"size:200" json:"reason"`
	// 举报附图，存为 jsonb 数组
	EvidenceAssetIDs []int64 `gorm:"type:jsonb;serializer:json;not null;default:'[]'" json:"evidence_asset_ids"`

	// created_at 作为游标索引的排序中间列（priority:2）
	CreatedAt time.Time `gorm:"index:idx_report_records_ticket_cursor,priority:2" json:"created_at"`
}
