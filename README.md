# Dog Hill Run (Starter)

一个基于 Three.js 的起步版原型，直接使用你下载的 FBX 资产：

- `assets/pack_nature/FBX/ShibaInu.fbx` 作为主角狗
- `assets/Mountain/Mountain_Single.fbx` 作为山体
- `assets/pack_animals/FBX/*` 作为树木和岩石

## 运行

在项目根目录执行：

```bash
python3 -m http.server 8000
```

然后打开：

`http://127.0.0.1:8000`

## 操作

- `A / D` 或方向键左右：转向
- `Shift`：冲刺
- `点击屏幕` 或 `空格`：暂停/继续奔跑
- 暂停时 `鼠标拖拽` 或 `手指滑动`：调整狗狗左右朝向

## 当前实现

- 程序化山丘地形 + 雾效
- 跑道跟随镜头
- 狗自动前进 + 基础转向
- 支持暂停 + 拖拽转向
- 自动播放可用动画（优先 Run/Walk）
- 山体与树石背景摆放

## 已知说明

- 这个版本是“先跑起来”的起步版，还没有碰撞、得分、终点/失败条件。
- 使用 Three.js CDN，不需要本地安装 npm 依赖。

## 下一步建议

1. 加入骨头收集物和计分系统。
2. 给狗增加跳跃和落地判定。
3. 把场景改成分段生成，支持无限跑。
