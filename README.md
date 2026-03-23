# Dog Hill Run (Starter)

一个基于 Three.js 的起步版原型，直接使用你下载的 FBX 资产：

- `assets/pack_nature/FBX/ShibaInu.fbx` 作为主角狗
- `assets/Mountain/Mountain_Single.fbx` 作为山体
- `assets/pack_animals_gltf/glTF/*` 优先作为树木/灌木（带贴图）
- `assets/pack_animals/FBX/*` 作为场景兜底资源（例如岩石）

## 运行

在项目根目录执行：

```bash
python3 -m http.server 8000
```

然后打开：

`http://127.0.0.1:8000`

## 部署到 GitHub Pages

1. 新建一个 GitHub 仓库并把当前代码推上去（`master` 或 `main` 分支都可以）。
2. 在仓库页面打开 `Settings -> Pages`。
3. `Build and deployment` 的 `Source` 选择 `GitHub Actions`。
4. 推送任意一次提交，等待 `Actions` 里的 `Deploy To GitHub Pages` 工作流完成。
5. 发布地址通常是：
   - 项目页：`https://<你的用户名>.github.io/<仓库名>/`
   - 用户主页仓库（仓库名就是 `<你的用户名>.github.io`）：`https://<你的用户名>.github.io/`

仓库里已经包含自动部署工作流：`.github/workflows/deploy-pages.yml`。

## 操作

- `A / D` 或方向键左右：转向
- `Shift`：冲刺
- `点击草地`：生成红色小球，狗会先绕球一圈再停留 6 秒
- `空格`：暂停/继续奔跑
- `K`：切换狗模型（ShibaInu / Dog）
- `M`：音乐开关
- `N`：下一首音乐
- 暂停时 `鼠标拖拽` 或 `手指滑动`：调整狗狗左右朝向

## 当前实现

- 程序化山丘地形 + 雾效
- 跑道跟随镜头
- 狗自动前进 + 基础转向
- 点击草地生成红球，狗会靠近并绕一圈后停留再继续奔跑
- 支持暂停 + 拖拽转向
- 本地背景音乐播放（键盘可切歌）
- 自动播放可用动画（优先 Run/Walk）
- 山体与树石背景摆放
- 草地两侧会出现吃草牛群（使用 `Cow.fbx`）

## 已知说明

- 这个版本是“先跑起来”的起步版，还没有碰撞、得分、终点/失败条件。
- Three.js 依赖已本地化到 `vendor/three`，不依赖外部 CDN。

## 音乐来源

- `assets/music/Searchlight_Rag.ogg`  
  来源: https://commons.wikimedia.org/wiki/File:Searchlight_Rag.ogg
- `assets/music/Maple_Leaf_Rag.ogg`  
  来源: https://commons.wikimedia.org/wiki/File:Maple_Leaf_Rag.ogg
- `assets/music/Gymnopedie_No_1.ogg`  
  来源: https://commons.wikimedia.org/wiki/File:Gymnopedie_No._1..ogg

## 下一步建议

1. 加入骨头收集物和计分系统。
2. 给狗增加跳跃和落地判定。
3. 把场景改成分段生成，支持无限跑。
