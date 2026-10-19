# Riverlight

原创像素风 Texas Hold'em，支持 Web、Android 和 iOS。无需账号或部署游戏服务器，任意客户端都可以成为临时房主。

> Riverlight 与 Pixel Dance 或 Steam 上的参考游戏无关，不包含其代码、图像或音频。项目参考公开界面与本地分析结果重新设计，仓库内的像素素材和音乐均为原创。

## 在线访问

GitHub Pages：<https://youngy620.github.io/riverlight/>。Pages 只提供静态 Web 文件，联机仍由客户端通过 WebRTC 完成。

## 功能

- 2–9 人无限注德州扑克：盲注、下注轮、全下、边池、摊牌和平分。
- 本地 Bot：Monte Carlo 胜率估算、底池赔率、位置脚本、TAG / LAG / TP / LP 四种风格和四档可调难度，不使用 AI 模型。
- WebRTC 临时房主：手动邀请/应答码握手，房主逐客户端发送可见状态。
- 每手独立 commitment/reveal，附带操作与时间事件的熵混合。
- 聊天、个性化头像、卡背、桌面主题、牌局记录和验牌材料。
- 原创像素素材与 Jacquard 合成的 D 小调循环音乐。

## Monorepo

项目由 [moon](https://moonrepo.dev/) 和 pnpm workspace 管理。

```text
apps/web          React、Vite、Capacitor（Web / Android / iOS）
packages/engine   扑克规则、牌型、胜率估算、Bot、承诺验牌
packages/net      WebRTC 信令编解码与房间传输
scripts           原创图像和 Jacquard 乐谱生成脚本
```

## 开发

要求：Node.js 24+、pnpm 10+。

```bash
pnpm install
pnpm exec moon run web:dev
```

常用任务：

```bash
pnpm exec moon run :build
pnpm exec moon run :test
pnpm exec moon run :typecheck
pnpm exec moon run web:lint
```

也可使用根脚本 `pnpm build`、`pnpm test`、`pnpm typecheck` 和 `pnpm lint`，它们仍调用 moon。

## 无服务器联机

当前采用手动带外信令，不使用自动发现服务：

1. 任意玩家创建房间并生成邀请码。
2. 邀请码经微信、QR 或其他现有渠道发给朋友。
3. 客人生成应答码并发回房主。
4. 双方建立 WebRTC DataChannel，房主成为这一局的临时权威结算者。

STUN/TURN 与发现不是一回事。默认配置适合局域网或可直接连接的网络；复杂 NAT 环境需要调用方提供 STUN/TURN。Web 不支持原生 mDNS / UDP 广播，因此不能承诺仅凭短房间号在无基础设施的公网中自动发现。

房主离开会结束当前房间，暂未实现主机迁移；客人断线也暂未自动重连，轮到断线客人行动时牌局可能停滞。承诺验牌能防止事后换牌，不能阻止持有秘密的房主提前读牌。

## 随机性与 Bot

每手牌使用独立秘密和牌堆承诺。`EntropyPool` 以系统加密随机源为必选来源，并允许接入网络事件、用户操作或公共随机信标等可插拔 `EntropySource`；所有事件只影响后续手牌，当前手牌承诺后不再更改。

Bot 胜率是隐藏信息假设下的 Monte Carlo 估计，不是对手真实底牌下的确定答案。生产决策可使用更多模拟样本；测试使用固定种子保证可复现。

## 移动端

```bash
pnpm exec moon run web:build
pnpm --filter @riverlight/web exec cap add android
pnpm --filter @riverlight/web exec cap add ios
pnpm exec moon run web:sync
```

Android 需要 JDK 21 和 Android SDK，iOS 需要 Xcode 和受支持的 macOS。原生工程生成后由开发者签名。GitLab CI 的 `android` 任务会生成可下载的 Debug APK；iOS 任务需在 macOS/Xcode 环境构建。Web 生产环境应使用 HTTPS，以保证 WebCrypto 和 WebRTC 能力一致。

## 素材再生

```bash
python3 scripts/generate_assets.py
python3 scripts/generate_icons.py
python3 scripts/create_score.py
```

`riverlight.wav` 由本地 Jacquard 编辑器从 `public/assets/music/riverlight.jacquard` 导出。参考音频只用于节奏、调式和轮廓分析，不复制旋律。

## License

代码采用 [MIT](LICENSE)。原创图像与音乐采用 [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)，署名 “Riverlight contributors”。第三方依赖保留各自许可证。
