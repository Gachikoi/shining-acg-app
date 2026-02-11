package ffmpeg

import (
	"errors"
	"log"
	"runtime/debug"
	"sync"
)

var (
	// ErrPoolClosed 当尝试向已关闭的池提交任务时返回
	ErrPoolClosed = errors.New("worker pool is closed")
	// ErrJobQueueFull 当任务队列已满且不想阻塞时返回（可选）
	ErrJobQueueFull = errors.New("job queue is full")
)

// TaskFunc 定义具体的任务逻辑，它是一个闭包，内部包含了 Context 和具体参数
type TaskFunc func() error

// job 内部结构，包含任务逻辑和接收结果的通道
type job struct {
	task   TaskFunc
	result chan<- error // 只写通道，用于返回结果
}

// WorkerPool 管理并发转码任务
type WorkerPool struct {
	maxWorkers int
	jobQueue   chan job
	quit       chan struct{}
	wg         sync.WaitGroup
	isClosed   bool
	mu         sync.Mutex // 保护 isClosed 状态
}

// NewWorkerPool 初始化工作池
// maxWorkers: 最大并发数（建议设置为 CPU 核心数或核心数*2）
// queueSize: 等待队列长度（超过此长度 Submit 会阻塞）
func NewWorkerPool(maxWorkers, queueSize int) *WorkerPool {
	return &WorkerPool{
		maxWorkers: maxWorkers,
		jobQueue:   make(chan job, queueSize),
		quit:       make(chan struct{}),
	}
}

// Start 启动 Worker，开始监听任务
func (p *WorkerPool) Start() {
	for i := 0; i < p.maxWorkers; i++ {
		p.wg.Add(1)
		go p.worker(i)
	}
}

// worker 消费者逻辑
func (p *WorkerPool) worker(id int) {
	defer p.wg.Done()

	// 捕获 panic，防止单个任务崩溃导致 Worker 退出
	defer func() {
		if r := recover(); r != nil {
			log.Printf("[FFmpeg Pool] Worker %d panic: %v\nStack: %s", id, r, debug.Stack())
		}
	}()

	for {
		select {
		case j, ok := <-p.jobQueue:
			if !ok {
				return // 通道关闭，退出
			}
			// 执行任务
			err := j.task()
			// 返回结果（如果调用方不关心结果，result channel 可能是 nil，虽然我们在 Submit 里强制创建了）
			if j.result != nil {
				j.result <- err
				close(j.result)
			}
		case <-p.quit:
			return // 收到停止信号
		}
	}
}

// Submit 提交任务。这是一个阻塞调用（如果队列已满）。
// 返回一个 channel，调用者可以从该 channel 读取任务执行结果。
func (p *WorkerPool) Submit(task TaskFunc) (<-chan error, error) {
	p.mu.Lock()
	if p.isClosed {
		p.mu.Unlock()
		return nil, ErrPoolClosed
	}
	p.mu.Unlock()

	resultChan := make(chan error, 1) // 缓冲为 1，防止 worker 阻塞
	j := job{
		task:   task,
		result: resultChan,
	}

	// 写入任务队列
	// 注意：如果队列满了，这里会阻塞，直到有 Worker 空闲
	// 这种背压（Backpressure）机制能保护服务器不被打挂
	select {
	case p.jobQueue <- j:
		return resultChan, nil
	case <-p.quit:
		return nil, ErrPoolClosed
	}
}

// TrySubmit 尝试提交任务（非阻塞）。如果队列满了，直接返回错误。
func (p *WorkerPool) TrySubmit(task TaskFunc) (<-chan error, error) {
	p.mu.Lock()
	if p.isClosed {
		p.mu.Unlock()
		return nil, ErrPoolClosed
	}
	p.mu.Unlock()

	resultChan := make(chan error, 1)
	j := job{
		task:   task,
		result: resultChan,
	}

	select {
	case p.jobQueue <- j:
		return resultChan, nil
	default:
		return nil, ErrJobQueueFull
	}
}

// Stop 优雅关闭工作池
// 会等待所有正在执行的任务完成，但不再接受新任务
func (p *WorkerPool) Stop() {
	p.mu.Lock()
	if p.isClosed {
		p.mu.Unlock()
		return
	}
	p.isClosed = true
	p.mu.Unlock()

	// 关闭 quit 通道，通知空闲 worker 退出
	close(p.quit)
	// 关闭 jobQueue，不再接收新数据
	// 注意：正在 range jobQueue 的 worker 会把剩余的任务做完
	// 但我们这里用的 select 模式，所以依靠 waitgroup

	p.wg.Wait() // 等待所有 worker 退出
	close(p.jobQueue)
}
