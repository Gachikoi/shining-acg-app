package utils

import (
	"encoding/json"
	"fmt"
	"time"

	commonv1 "app.shiningacg.club/gen/proto/api/main/common/v1"
	"gorm.io/gorm"
)

var DefaultCursor = &commonv1.CursorPagination{
	NeedNum: 30, // 检测并将nil的cursorPagination替换为默认，保证至少有needNum字段
}

// repo层自定义游标接口
type Cursor interface {
	Decode(*commonv1.CursorPagination)  // 从cursorPagination Cursor的string解码
	Encode() *commonv1.CursorPagination // 编码为cursorPagination Cursor的string
	IsValid() bool                      // 是否为空游标
	NeedNum() int                       // 获取需要的记录数
}

func PaginateByTime(cursor *ByTimeCursor, timeCol, idCol string) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		db = db.Limit(cursor.NeedNum())
		if cursor.IsValid() {
			// 使用复合索引写法：(time, id) < (val1, val2)
			return db.Where(fmt.Sprintf("(%s, %s) < (?, ?)", timeCol, idCol), cursor.Time, cursor.ID).Order(fmt.Sprintf("%s DESC, %s DESC", timeCol, idCol))
		}
		return db
	}
}

func NewByTimeCursor(time time.Time, id int64) *ByTimeCursor {
	return &ByTimeCursor{
		Time: time,
		ID:   id,
	}
}

func (c *ByTimeCursor) IsValid() bool {
	return c.valid
}

func (c *ByTimeCursor) NeedNum() int {
	return int(c.needNum)
}

func (c *ByTimeCursor) Encode() *commonv1.CursorPagination {
	cursorBytes, err := json.Marshal(c)
	if err != nil {
		return &commonv1.CursorPagination{
			NeedNum: c.needNum,
		}
	}
	cursorStr := string(cursorBytes)
	return &commonv1.CursorPagination{
		NeedNum: c.needNum,
		Cursor:  &cursorStr,
	}
}

func (c *ByTimeCursor) Decode(pagination *commonv1.CursorPagination) {
	if pagination == nil {
		pagination = DefaultCursor
	}

	c.needNum = pagination.NeedNum

	if pagination.Cursor == nil {
		c.valid = false
		return
	}

	err := json.Unmarshal([]byte(*pagination.Cursor), c)
	if err != nil {
		return
	}
	c.valid = true
}

// 关注用户列表，时间类型的游标
type ByTimeCursor struct {
	needNum int32
	valid   bool
	Time    time.Time `json:"time;omitempty"`
	ID      int64     `json:"id;omitempty"`
}
