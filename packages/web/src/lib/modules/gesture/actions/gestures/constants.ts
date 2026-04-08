/**
 * @file 滑动类手势共享标量
 * @description
 * `use:swipe` 与 `use:feedStream` 等同属「先 pending 再 tryAcquire」的滑动识别器，
 * 在方向锁定前共用同一默认行程（px），避免嵌套时子父对「何时占用竞技场」判断不一致。
 */

/**
 * 方向锁定前允许的 pointer 行程容差（px），即 **touch slop** 量级的默认值。
 *
 * 语义与 `SwipeOptions.threshold` 默认一致：当 `max(|dx|, |dy|)` 仍小于该值时不发起 `tryAcquire`。
 * `feed-stream` 的 pending 判定与之对齐（两轴均未达到该值则继续等待），且**不可配置**。
 *
 * @see SwipeOptions.threshold
 */
export const DEFAULT_POINTER_SLOP_PX = 10;
