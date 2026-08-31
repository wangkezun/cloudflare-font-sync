# Sarasa Fonts on Cloudflare

自动检查 [Sarasa Gothic](https://github.com/be5invis/Sarasa-Gothic) 的最新稳定版，只下载当前 CSS 用到的 `Sarasa Fixed SC` 和 `Sarasa UI SC`，转换为 WOFF2 后发布到 Cloudflare R2。

对外 URL 保持不变，例如：

```text
https://wkz.io/static/fonts/SarasaFixedSC-Regular.woff2
https://wkz.io/static/fonts/SarasaUiSC-Regular.woff2
```

## 工作方式

1. GitHub Actions 每天检查一次上游 Release，也可以手动执行。
2. 若版本未变化，任务立即结束，不下载约 120 MB 的字体包。
3. 新版本的 20 个字体文件先上传到 `static/fonts/releases/<tag>/`。
4. 所有文件成功后，最后更新 `static/fonts/manifest.json`，一次性切换版本。
5. Worker 根据 manifest 将稳定 URL 映射到当前版本，并使用带版本号的边缘缓存键。

`SymbolsNerdFontMono-Regular.woff2` 不是 Sarasa 的一部分。Worker 会从 R2 的旧路径 `static/fonts/SymbolsNerdFontMono-Regular.woff2` 读取它，因此只需手动上传一次。

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

先在 GitHub Actions 中手动运行 **Sync Sarasa fonts**，并将 `force` 设为 `true`。这一步先把字体写入 R2，避免 Worker 接管现有 URL 后出现空档。之后每天 UTC 02:17（北京时间 10:17）自动检查。

如果当前 CSS 还使用 Nerd Font，请在部署 Worker 前上传一次：

```bash
npx wrangler r2 object put \
  sarasa-fonts/static/fonts/SymbolsNerdFontMono-Regular.woff2 \
  --file=/path/to/SymbolsNerdFontMono-Regular.woff2 \
  --content-type=font/woff2 \
  --cache-control="public, max-age=3600, s-maxage=31536000" \
  --remote
```

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

解析真实的最新 Release（会访问 GitHub API）：

```bash
npm run resolve
```

修改字体范围时，编辑 `fonts.config.json`。转换脚本会严格检查所有预期文件；上游改名或缺文件时会失败，不会切换线上 manifest。

## 回滚

字体目录按 Release tag 保留。下载目标版本的 manifest，或把其中的 `tag` 改成已有版本后，重新上传为 `static/fonts/manifest.json` 即可原子回滚。不要在回滚前删除对应的 `releases/<tag>/` 目录。

## License

本仓库中的自动化代码可按 MIT License 使用。Sarasa Gothic 字体本身遵循其上游许可证；本仓库不提交或再授权字体二进制文件。
