# @hydrooj/contest-bulk-submit

离线比赛收集选手代码后打包上传系统统一评测(OI/IOI 风格赛后批量判题)。

## 功能

- 比赛管理入口:`/contest/:tid/bulksubmit`(组织者或拥有 `PERM_EDIT_CONTEST` 的成员);
- 上传 zip 包,支持两种结构:
  1. **按选手目录**:`<用户名>/A.cpp`、`<用户名>/B.py` —— 以对应选手身份提交;
  2. **平铺文件**:`A.cpp B.cpp` —— 全部提交给指定用户(默认为上传者);
- 文件名 `A.cpp` 中字母标号按比赛题单顺序映射到题目(A=第 1 题),扩展名自动识别语言;
- **Dry Run** 模式:只做解析与匹配校验、不真正提交,用于上传前核对;
- 逐文件返回结果表(成功/失败与原因),成功记录进入正常评测队列、计入比赛 journal 与提交数。

## 安装

将 `@hydrooj/contest-bulk-submit` 加入 `~/.hydro/addon.json`(或 `hydrooj addons install`),重启服务。

## 配置(管理 → 系统设置)

| 配置项 | 默认 | 说明 |
| --- | --- | --- |
| `allowAfterEnd` | `true` | 允许比赛结束后批量提交(离线统一评测) |
| `maxFiles` | `500` | 单次上传文件数上限 |
| `maxCodeSize` | `131072` | 单文件最大字节数(受 `limit.codelength` 约束取小者) |
| `notify` | `true` | 每条提交发送评测完成通知 |
| `matchBySeat` | `false` | 目录名匹配失败时按 `seat` 字段再试 |

## 注意

- 提交会写入比赛 journal,榜单实时重算;
- 团队赛(`allowTeam`)请按队伍账号名作为目录名;
- 仅组织者/编辑可操作,系统记录操作日志(Oplog)。
