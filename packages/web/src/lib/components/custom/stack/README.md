# Stack 使用说明

在布局中挂载一次 `StackContainer`，业务里通过默认导出的 `stackController` 操作栈。

```svelte
<script>
	import { StackContainer, stackController } from '$lib/components/custom/stack';
</script>

<StackContainer zIndexBase={100} maxVisible={5} />
```

---

## `StackContainer`

| Prop         | 类型                  | 默认   | 说明                                                          |
| ------------ | --------------------- | ------ | ------------------------------------------------------------- |
| `zIndexBase` | `number`              | `100`  | 栈底层的 `z-index`，每层 +1，保证栈顶在最上                   |
| `maxVisible` | `number \| undefined` | 不限制 | 最多同时挂载几层；更早的层可能卸载 DOM 以省内存；不传则不裁切 |

---

## `stackController.push(options)`

`await stackController.push(options)`：新页成为栈顶，并触发进栈动画。

**二选一（判别字段）：**

| 字段        | 说明                                                                                                |
| ----------- | --------------------------------------------------------------------------------------------------- |
| `component` | 已 `import` 的 Svelte 组件，立即渲染                                                                |
| `loader`    | `() => import('./Page.svelte')`，先全屏 loading，再渲染；用于打破循环依赖（子 push 父 / push 自身） |

**可选（两种 push 共用）：**

| 字段             | 说明                                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| `props`          | 传给页面组件的属性                                                                                      |
| `rectInfo`       | `getBoundingClientRect()` 相对视口的 `{ top, left, width, height }`；有则从触点缩放进入，无则从右侧滑入 |
| `next`           | 下一页配置（同 `push` 的静态/懒加载形态，但不含 `next`）；栈顶左滑时按该配置再 push 一层                |
| `ignoreSafeArea` | `true` 时不加安全区上下 padding；默认 `false`                                                           |

`loader` 失败会 toast，并尝试 `pop()` 掉本次占位。

---

## `stackController.pop(isNeedAnimation?)`

**业务侧：**一般只写 `stackController.pop()` 即可——默认就是「带出场动画」的出栈，与产品预期一致。**不要**在业务里传 `false`，除非明确要在无过渡下立刻摘掉栈顶。

`false` 主要留给 **Stack 内部**（如 `StackItem` 手势提交、动画收尾后真正从数组 `pop`）使用；业务代码几乎用不到。

| 参数              | 默认   | 说明                                                                               |
| ----------------- | ------ | ---------------------------------------------------------------------------------- |
| `isNeedAnimation` | `true` | `true`：先播栈顶出栈动画，结束后再从栈数据移除；`false`：立即 `pop` 栈数据，无过渡 |

- `true` 时函数在触发动画后即返回，**不**返回被弹出项（实现上此时尚未从数组移除）。
- `false` 时返回被弹出的 `StackItem`，栈空则 `undefined`。

---

## 其他

| API                            | 说明                                                             |
| ------------------------------ | ---------------------------------------------------------------- |
| `stackController.clearStack()` | 清空栈数据（无动画）                                             |
| `stackController.pushNext()`   | 将当前栈顶项的 `next` 推入栈；一般由栈内左滑手势调用，业务侧少用 |

只读：`stackController.items`、`length`、`top`、`swipeState`、`animationPhase`。
