package utils

import (
	"fmt"

	"gorm.io/gorm"
)

func WithKeyWord(col string, keyword string) func(db *gorm.DB) *gorm.DB {
	return func(db *gorm.DB) *gorm.DB {
		if keyword != "" {
			return db.Where(fmt.Sprintf("%s ILIKE ?", col), "%"+keyword+"%")
		}
		return db

	}
}
