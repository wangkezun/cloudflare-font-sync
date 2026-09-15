# Cloudflare Font Sync

自动检查 [Sarasa Gothic](https://github.com/be5invis/Sarasa-Gothic) 和 [Nerd Fonts](https://github.com/ryanoasis/nerd-fonts) 的最新稳定版，只下载配置中需要的 UI / Fixed 地区字体及符号字体，转换为 WOFF2 后发布到 Cloudflare R2。

对外 URL 保持不变，例如：

```text
https://wkz.io/static/fonts/SarasaFixedSC-Regular.woff2
https://wkz.io/static/fonts/SarasaUiSC-Regular.woff2
https://wkz.io/static/fonts/SymbolsNerdFontMono-Regular.woff2
```

## 工作方式

1. GitHub Actions 每天分别检查两个上游 Release，也可以手动执行。
2. 每个上游独立判断版本。只有 Nerd Fonts 更新时，不会重新下载约 120 MB 的 Sarasa 包。
3. 新字体先上传到 `static/fonts/releases/<source>/<tag>/`。
4. 所有文件成功后，最后更新 `static/fonts/manifest.json`，一次性切换版本。
5. Worker 根据 manifest 将稳定 URL 映射到当前文件，并使用文件摘要作为边缘缓存键。

当前同步范围是：

- `Sarasa Fixed` 和 `Sarasa UI`：SC、TC、HC、J、K 五个地区，每个家族每个地区 5 个字重，各有 normal/italic，共 100 个文件。
- `Symbols Nerd Font Mono`：上游仅提供 Regular，共 1 个文件。

Sarasa 当前上游完整字重为 `200 ExtraLight`、`300 Light`、`400 Regular`、`600 SemiBold`、`700 Bold`；并不存在被漏掉的 `100/500/800/900` 文件。

## 首次配置

### 1. 创建 R2 bucket

在 Cloudflare 创建名为 `sarasa-fonts` 的 R2 bucket。如果要改名，需要同时修改：

- `wrangler.jsonc` 中的 `r2_buckets[].bucket_name`
- `.github/workflows/sync-fonts.yml` 中的 `R2_BUCKET`

### 2. 配置 GitHub Secrets

仓库的 **Settings → Secrets and variables → Actions** 中添加：

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Token 需要能编辑 Workers、Workers Routes 和目标 R2 bucket。建议创建只覆盖该账户与 `wkz.io` zone 的最小权限 token。

可选的 Actions variable：

- `PUBLIC_BASE_URL`：默认 `https://wkz.io`，用于检查线上 manifest。

### 3. 首次同步字体

先在 GitHub Actions 中手动运行 **Sync font releases**，并将 `force` 设为 `true`。这一步会同时把 Sarasa 和 Symbols Nerd Font Mono 写入 R2，避免 Worker 接管现有 URL 后出现空档。之后每天 UTC 02:17（北京时间 10:17）自动检查。

### 4. 部署 Worker

当前路由已配置为 `wkz.io/static/fonts/*`。确认 `wkz.io` 在同一 Cloudflare 账户后：

```bash
npm ci
npm run deploy
```

推送到 `main` 后，`Deploy Worker` workflow 也会自动部署。

## 本地验证

```bash
npm ci
npm run check
```

解析两个上游真实的最新 Release（会访问 GitHub API）：

```bash
npm run resolve
```

修改字体范围时，编辑 `fonts.config.json`。转换脚本会严格检查所有预期文件；任一上游改名或缺文件时会失败，不会切换线上 manifest。

## 回滚

字体目录按来源和 Release tag 保留。将 manifest 中对应来源的 release 信息与文件项改回已有版本，再重新上传为 `static/fonts/manifest.json`，即可只回滚一个来源或同时回滚。不要提前删除对应的 `releases/<source>/<tag>/` 目录。

## License

本仓库中的自动化代码可按 MIT License 使用。Sarasa Gothic 与 Nerd Fonts 字体遵循各自的上游许可证；本仓库不提交或再授权字体二进制文件。

## 地区字体扩展

稳定文件名示例：`SarasaUiTC-Regular.woff2`、`SarasaFixedHC-Bold.woff2`、`SarasaUiJ-Italic.woff2`、`SarasaFixedK-Regular.woff2`。UI 文件名使用 `Ui`，地区代码区分大小写。

同步任务同时检查版本号和预期文件是否齐全，因此新增地区或样式后，即使上游版本未变化也会补齐；仅缺 Sarasa 文件时不重建 Nerd Fonts。100 个 Sarasa 文件需要更长转换和上传时间，转换使用最多 4 个进程，任务上限调整为 180 分钟。全部上传完成后才切换 manifest。

客户端声明多个 font-face 不代表全部预下载；应按页面语言、字重和样式使用。完整字库尚未分包，首次加载仍可能较大。
