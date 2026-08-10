// Package apperr 定义应用层统一的业务错误 sentinel 与构造函数。
//
// 所有 application 包通过包装这些 sentinel 返回错误，
// service 层（Connect/gRPC handler）通过 errors.Is 识别类型并映射到对应 RPC 状态码。
package apperr

import (
	"errors"
	"fmt"
)

var (
	// ErrInvalidArgument 表示请求参数非法（Connect: INVALID_ARGUMENT）。
	ErrInvalidArgument = errors.New("参数非法")
	// ErrNotFound 表示资源不存在（Connect: NOT_FOUND）。
	ErrNotFound = errors.New("未找到资源")
	// ErrFailedPrecondition 表示状态前置条件不满足（Connect: FAILED_PRECONDITION）。
	ErrFailedPrecondition = errors.New("前置条件不满足")
)

// InvalidArgument 构造一条包装 ErrInvalidArgument 的错误。
func InvalidArgument(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrInvalidArgument, fmt.Sprintf(format, args...))
}

// NotFound 构造一条包装 ErrNotFound 的错误。
func NotFound(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrNotFound, fmt.Sprintf(format, args...))
}

// FailedPrecondition 构造一条包装 ErrFailedPrecondition 的错误。
func FailedPrecondition(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrFailedPrecondition, fmt.Sprintf(format, args...))
}
