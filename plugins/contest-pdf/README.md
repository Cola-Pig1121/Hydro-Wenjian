# @hydrooj/contest-pdf

快速导出一场比赛的所有题面为单个 PDF 文件。

## 功能

- 在「比赛管理」页(`/contest/:tid/management`)侧边栏自动插入 **导出题面 PDF** 按钮;
- 服务端将所有题目题面(按用户语言挑选 statement,含 KaTeX 公式、样例)拼成一份带打印样式的完整文档;
- 通过 PDF 引擎转换为单个 PDF 并下载;
- 服务器无可用引擎时自动降级返回可打印 HTML(浏览器 Ctrl+P 存为 PDF),流程不中断。

## 安装

在 `~/.hydro/addon.json` 中加入 `@hydrooj/contest-pdf`(或 `hydrooj addons install @hydrooj/contest-pdf`),重启服务。

## 配置

「管理 → 系统设置」中的插件设置:

| 配置项 | 默认 | 说明 |
| --- | --- | --- |
| `engine` | `auto` | `auto` / `weasyprint` / `wkhtmltopdf` / `none`。`auto` 会探测服务器上已安装的引擎;`none` 直接返回 HTML |
| `customCommand` | 空 | 自定义转换命令(二进制 + 固定参数),以 `<binary> [args...] <input.html> <output.pdf>` 方式调用,优先于 engine |
| `katexCssUrl` | CDN 地址 | 公式样式表。服务器/转换环境访问不到 CDN 时留空,公式降级为纯文本 |
| `includeSamples` | `true` | 题面后附带样例输入输出 |
| `pageSize` | `A4` | 页面尺寸 |
| `maxProblems` | `100` | 单次导出题目数上限 |

推荐安装 `weasyprint`:

```sh
pip install weasyprint   # 或 apt install weasyprint
```

## 权限

仅比赛组织者(creator)或拥有 `PERM_EDIT_CONTEST` 的成员可导出。题面中的图片/附件无法随 PDF 一起鉴权,导出文档中以相对站点路径引用,请在已登录环境查看;纯服务端转换时图片需通过 KaTeX/外链 CDN 获取,受限网络下可能缺失。
