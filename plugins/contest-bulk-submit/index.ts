import os from 'os';
import path from 'path';
import { Readable } from 'stream';
import fs from 'fs-extra';
import {
    _, ContestModel, Context, DomainModel, ForbiddenError, Handler, ObjectId, param,
    PERM, PRIV, ProblemModel, RecordModel, Schema, SettingModel, SystemModel, Types, UserModel, Zip,
} from 'hydrooj';

export const Config = Schema.object({
  allowAfterEnd: Schema.boolean().default(true)
    .description('允许比赛结束后由组织者批量提交（离线比赛统一评测场景）'),
  maxFiles: Schema.number().default(500).description('单次上传的提交文件上限'),
  maxCodeSize: Schema.number().default(128 * 1024).description('单个代码文件最大字节数'),
  notify: Schema.boolean().default(true).description('为每条提交发送站内评测完成通知'),
  matchBySeat: Schema.boolean().default(false).description('目录/用户名匹配失败时尝试按 seat 字段匹配用户'),
}).description('离线比赛批量提交');

interface ResolvedConfig {
  allowAfterEnd: boolean;
  maxFiles: number;
  maxCodeSize: number;
  notify: boolean;
  matchBySeat: boolean;
}

interface ParsedFile {
  zipPath: string;
  label: string;
  ext: string;
  folder?: string;
}

function parseEntryName(name: string): ParsedFile | null {
  const parts = name.split(/[\\/]+/).filter((i) => i && !i.startsWith('__MACOSX') && !i.startsWith('.'));
  if (!parts.length) return null;
  const file = parts.pop();
  const m = /^([A-Z])\.([A-Za-z0-9]+)$/.exec(file);
  if (!m) return null;
  return { zipPath: name, label: m[1].toUpperCase(), ext: m[2].toLowerCase(), folder: parts[0] };
}

export async function apply(ctx: Context, config: ResolvedConfig) {
  class BulkSubmitHandler extends Handler {
    tdoc: any;

    @param('tid', Types.ObjectId)
    async _prepare(domainId: string, tid: ObjectId) {
      this.tdoc = await ContestModel.get(domainId, tid);
      if (!this.user.own(this.tdoc) && !this.user.hasPerm(PERM.PERM_EDIT_CONTEST)) {
        throw new ForbiddenError(this.translate('Only contest owners or editors can bulk submit'));
      }
    }

    @param('tid', Types.ObjectId)
    async get(domainId: string, tid: ObjectId) {
      const pdocDict = await ProblemModel.getList(
        domainId, this.tdoc.pids, true, false, ProblemModel.PROJECTION_LIST, true,
      );
      this.response.template = 'bulk_submit.html';
      this.response.body = {
        tdoc: this.tdoc,
        problems: this.tdoc.pids.map((pid, idx) => ({
          label: String.fromCharCode(65 + idx),
          pid,
          title: pdocDict[pid]?.title || `#${pid}`,
        })),
      };
    }

    async post() {
      // multipart 文件字段名为 file
    }

    @param('dryrun', Types.Boolean, true)
    @param('defaultUser', Types.String, true)
    async postUpload(domainId: string, dryrun = false, defaultUser?: string) {
      const file = this.request.files?.file;
      if (!file) throw new ForbiddenError(this.translate('No file uploaded'));
      await this.limitRate('bulk_submit', 60, 10);
      const tmpdir = await fs.mkdtemp(path.resolve(os.tmpdir(), 'hydro-bulk-'));
      const results: Array<Record<string, any>> = [];
      let zipHandle: any;
      try {
        const zipPath = path.resolve(tmpdir, 'upload.zip');
        await fs.copyFile(file.filepath, zipPath);
        zipHandle = new Zip.ZipReader(Readable.toWeb(fs.createReadStream(zipPath)) as any);
        const entries: Zip.Entry[] = await zipHandle.getEntries();

        const files: ParsedFile[] = [];
        for (const entry of entries) {
          if (entry.directory === true) continue;
          const parsed = parseEntryName(entry.filename);
          if (parsed) files.push(parsed);
        }
        if (!files.length) throw new ForbiddenError(this.translate('No valid file found'));
        if (files.length > config.maxFiles) {
          throw new ForbiddenError(`${this.translate('Too many files')}: ${files.length} > ${config.maxFiles}`);
        }

        const ongoing = ContestModel.isOngoing(this.tdoc);
        if (!ongoing && !config.allowAfterEnd) {
          throw new ForbiddenError(this.translate('Contest is not running'));
        }

        const labelToPid: Record<string, number> = {};
        this.tdoc.pids.forEach((pid, idx) => {
          labelToPid[String.fromCharCode(65 + idx)] = pid;
        });

        const userCache: Record<string, any> = {};
        const resolveUser = async (folder?: string) => {
          const name = folder || defaultUser;
          if (!name) return this.user._id; // 扁平结构提交到当前用户
          if (userCache[name] === undefined) {
            const uname = Types.Username[0](name);
            let udoc: any = await UserModel.getByUname(domainId, uname);
            if (!udoc && config.matchBySeat) {
              udoc = await UserModel.coll.findOne({ seat: name });
            }
            userCache[name] = udoc?._id ?? null;
          }
          if (!userCache[name]) {
            throw new ForbiddenError(`${this.translate('User not found')}: ${name}`);
          }
          return userCache[name] as number;
        };

        let cnt = 0;
        for (const f of files) {
          const item: Record<string, any> = { file: f.zipPath, label: f.label, user: f.folder || (defaultUser || this.user.uname) };
          cnt++;
          try {
            const pid = labelToPid[f.label];
            if (!pid) throw new ForbiddenError(`${this.translate('Unknown problem label')}: ${f.label}`);
            const entry = entries.find((e) => e.directory !== true && e.filename === f.zipPath) as Zip.FileEntry | undefined;
            if (!entry) throw new ForbiddenError(`${this.translate('File not found in archive')}: ${f.zipPath}`);
            const content = await entry.getData(new Zip.TextWriter()) as string;
            if (Buffer.byteLength(content, 'utf-8') > Math.min(config.maxCodeSize, SystemModel.get('limit.codelength') || config.maxCodeSize)) {
              throw new ForbiddenError(this.translate('Code too long'));
            }
            let lang = f.ext;
            const pdoc = await ProblemModel.get(domainId, pid);
            const pconfig: any = pdoc.config && typeof pdoc.config === 'object' ? pdoc.config : {};
            if (pconfig.type === 'submit_answer' || pconfig.type === 'objective') lang = '_';
            else if (!SettingModel.langs[lang] || SettingModel.langs[lang].disabled
              || (pconfig.langs && !pconfig.langs.includes(lang))) {
              throw new ForbiddenError(`${this.translate('Unsupported language')}: ${lang}`);
            }
            const uid = await resolveUser(f.folder);
            item.uid = uid;
            item.lang = lang;
            if (dryrun) {
              item.status = 'dryrun';
            } else {
              const rid = await RecordModel.add(
                domainId, pid, uid, lang, content, true,
                { contest: this.tdoc.docId, type: 'judge', notify: config.notify },
              );
              await Promise.all([
                ProblemModel.inc(domainId, pid, 'nSubmit', 1),
                DomainModel.incUserInDomain(domainId, uid, 'nSubmit'),
                ContestModel.updateStatus(domainId, this.tdoc.docId, uid, rid, pid),
              ]);
              item.status = 'ok';
              item.rid = rid.toString();
            }
          } catch (err: any) {
            item.status = 'failed';
            // Hydro error classes keep human text in params; err.message is the class name.
            item.error = err?.params?.[0] || err?.message || String(err);
          }
          results.push(item);
        }
      } finally {
        await Promise.all([
          fs.remove(tmpdir).catch(() => undefined),
          zipHandle?.close?.().catch?.(() => undefined),
        ]);
      }
      this.response.body = { ok: true, results, dryrun };
      this.response.type = 'application/json';
    }
  }

  ctx.Route('contest_bulk_submit', '/contest/:tid/bulksubmit', BulkSubmitHandler, PRIV.PRIV_USER_PROFILE);
}
