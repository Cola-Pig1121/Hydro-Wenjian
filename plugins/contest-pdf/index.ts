import os from 'os';
import path from 'path';
import { execFile } from 'child_process';
import fs from 'fs-extra';
import {
    _, Context, ContestModel, ForbiddenError, Handler, param, parseStatements, PERM,
    ProblemModel, Schema, Types,
} from 'hydrooj';

export const Config = Schema.object({
  engine: Schema.string()
    .default('auto')
    .description('PDF 引擎: auto / weasyprint / wkhtmltopdf / none(none 返回可打印 HTML,由浏览器打印为 PDF)'),
  customCommand: Schema.string()
    .default('')
    .description('可选: 自定义转换命令 (二进制, 以 [html, pdf] 两个参数调用), 优先于 engine'),
  katexCssUrl: Schema.string()
    .default('https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css')
    .description('KaTeX 样式表 URL (公式渲染所需; 留空则公式降级为纯文本)'),
  includeSamples: Schema.boolean().default(true).description('题面后附带样例输入输出'),
  pageSize: Schema.string().default('A4').description('页面尺寸, 如 A4 / Letter'),
  maxProblems: Schema.number().default(100).description('单次导出题目数上限'),
});

interface ResolvedConfig {
  engine: string;
  customCommand: string;
  katexCssUrl: string;
  includeSamples: boolean;
  pageSize: string;
  maxProblems: number;
}

const execFileAsync = (cmd: string, args: string[]) => new Promise<void>((resolve, reject) => {
  execFile(cmd, args, { timeout: 180000 }, (err) => (err ? reject(err) : resolve()));
});

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// 渲染引擎探测缓存: 二进制缺失不阻塞每次导出
let cachedEngine: string | null = null;

async function detectEngine(config: ResolvedConfig): Promise<string | null> {
  if (config.customCommand) return 'custom';
  if (config.engine === 'none') return null;
  const candidates = config.engine === 'auto' ? ['weasyprint', 'wkhtmltopdf'] : [config.engine];
  for (const bin of candidates) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await execFileAsync(bin, ['--version']);
      return bin;
    } catch { /* not available, try next */ }
  }
  return null;
}

export async function apply(ctx: Context, config: ResolvedConfig) {
  const viewLangOf = (h: any) => h.user?.viewLang || h.session?.viewLang || '';

  class ContestExportPdfHandler extends Handler {
    @param('tid', Types.ObjectId)
    @param('format', Types.Range(['pdf', 'html']), true)
    async get(domainId: string, tid: any, format: string = 'pdf') {
      const tdoc = await ContestModel.get(domainId, tid);
      if (!this.user.own(tdoc) && !this.user.hasPerm(PERM.PERM_EDIT_CONTEST)) {
        throw new ForbiddenError(this.translate('Only contest owners or editors can export contest PDF'));
      }
      const pdocDict = await ProblemModel.getList(
        domainId, tdoc.pids.slice(0, config.maxProblems), true, false,
        ProblemModel.PROJECTION_PUBLIC.concat(['html', 'type'] as any), true,
      );

      const lang = viewLangOf(this);
      const sections: string[] = [];
      tdoc.pids.slice(0, config.maxProblems).forEach((pid, idx) => {
        const pdoc = pdocDict[pid];
        if (!pdoc) return;
        const label = String.fromCharCode(65 + idx);
        let entries: any[] = [];
        if (Array.isArray(pdoc.html)) entries = pdoc.html as any;
        else if (typeof pdoc.html === 'string') {
          entries = parseStatements(pdoc.html, true) || [{ name: 'zh.md', lang: 'zh', content: pdoc.html }];
        }
        const bodyParts: string[] = [];
        for (const entry of entries) {
          if (entry.lang && lang && entry.lang !== lang && entries.some((e) => e.lang === lang)) continue;
          const ext = String(entry.name || '').split('.').pop()?.toLowerCase() || 'md';
          const renderer = (global.Hydro as any)?.module?.contentRenderer?.[ext];
          let html: string;
          if (renderer && typeof renderer.render === 'function') {
            try {
              html = renderer.render(entry, { pdoc, domainId, tid });
            } catch {
              html = `<pre>${escapeHtml(String(entry.content || ''))}</pre>`;
            }
          } else if (entry.content) {
            html = `<pre>${escapeHtml(String(entry.content))}</pre>`;
          } else {
            html = `<p><em>[${this.translate('Attachment')}: ${escapeHtml(String(entry.file || entry.name))}]</em></p>`;
          }
          bodyParts.push(html);
        }
        const infoBits: string[] = [];
        if ((pdoc as any).type) infoBits.push(escapeHtml(String((pdoc as any).type)));
        const limits = (pdoc as any).config?.time ? `${(pdoc as any).config.time} / ${(pdoc as any).config.memory}` : '';
        if (limits) infoBits.push(escapeHtml(limits));
        let samplesHtml = '';
        if (config.includeSamples && (pdoc as any).samples?.length) {
          samplesHtml = `<h4>${this.translate('Samples')}</h4>` + (pdoc as any).samples.map((s: any, i: number) => {
            const [input, output, explanation] = Array.isArray(s) ? s : [s.input, s.output, s.explanation];
            return `
            <div class="sample">
              <h5>${this.translate('Sample')} ${i + 1}</h5>
              <pre><b>Input</b>\n${escapeHtml(String(input || ''))}</pre>
              <pre><b>Output</b>\n${escapeHtml(String(output || ''))}</pre>
              ${explanation ? `<pre><b>${this.translate('Explanation')}</b>\n${escapeHtml(String(explanation))}</pre>` : ''}
            </div>`;
          }).join('');
        }
        sections.push(`
          <section class="problem">
            <h2 class="problem-title">${label}. ${escapeHtml(pdoc.title || '')}</h2>
            <p class="problem-meta">${infoBits.join(' · ')}</p>
            <div class="problem-statement">${bodyParts.join('\n')}</div>
            ${samplesHtml}
          </section>`);
      });

      const css = `
        @page { size: ${config.pageSize}; margin: 15mm 12mm; }
        body { font-family: 'Noto Sans CJK SC', 'Source Han Sans SC', 'Microsoft YaHei', sans-serif; font-size: 11pt; line-height: 1.6; color: #111; }
        h1, h2, h3, h4, h5 { line-height: 1.3; }
        h1 { text-align: center; font-size: 20pt; }
        .problem { page-break-before: always; }
        .problem:first-of-type { page-break-before: avoid; }
        .problem-title { font-size: 15pt; border-bottom: 2px solid #333; padding-bottom: 4px; }
        .problem-meta { color: #666; font-size: 9pt; }
        pre { white-space: pre-wrap; word-break: break-all; background: #f5f5f5; padding: 8px; border-radius: 4px; font-size: 10pt; }
        code { font-family: 'Noto Sans Mono CJK SC', Consolas, monospace; }
        img { max-width: 100%; }
        table { border-collapse: collapse; }
        table td, table th { border: 1px solid #999; padding: 3px 6px; }
        .cover { text-align: center; margin-bottom: 2rem; }
        .cover .dates { color: #666; }
      `;
      const katexLink = config.katexCssUrl ? `<link rel="stylesheet" href="${escapeHtml(config.katexCssUrl)}" />` : '';
      const doc = `<!DOCTYPE html>
<html lang="${escapeHtml(lang || 'zh')}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(tdoc.title || 'contest')}</title>
${katexLink}
<style>${css}</style>
</head>
<body>
<div class="cover">
  <h1>${escapeHtml(tdoc.title || '')}</h1>
  <p class="dates">${tdoc.beginAt ? new Date(tdoc.beginAt).toLocaleString() : ''} - ${tdoc.endAt ? new Date(tdoc.endAt).toLocaleString() : ''}</p>
</div>
${sections.join('\n')}
</body>
</html>`;

      const baseName = `${(tdoc.title || 'contest').replace(/[\\/:*?"<>|]/g, '_')}`;

      if (format === 'html') {
        this.binary(doc, `${baseName}.html`);
        return;
      }

      // 引擎缺失时降级为可打印 HTML, 保证流程不中断
      cachedEngine = await detectEngine(config);
      if (!cachedEngine) {
        this.binary(doc, `${baseName}.html`);
        return;
      }

      const tmp = await fs.mkdtemp(path.resolve(os.tmpdir(), 'hydro-contest-pdf-'));
      const htmlPath = path.resolve(tmp, 'input.html');
      const pdfPath = path.resolve(tmp, 'output.pdf');
      try {
        await fs.writeFile(htmlPath, doc);
        const cmd = config.customCommand || cachedEngine;
        if (cachedEngine === 'custom') {
          const [bin, ...rest] = cmd.split(/\s+/);
          await execFileAsync(bin, [...rest, htmlPath, pdfPath]);
        } else {
          await execFileAsync(cachedEngine, [htmlPath, pdfPath]);
        }
        const pdf = await fs.readFile(pdfPath);
        this.binary(pdf, `${baseName}.pdf`);
      } catch (err: any) {
        ctx.logger.warn('contest-pdf export failed: %O', err);
        // 转换失败同样回退 HTML
        this.binary(doc, `${baseName}.html`);
      } finally {
        await fs.remove(tmp).catch(() => undefined);
      }
    }
  }

  ctx.Route('contest_exportpdf', '/contest/:tid/exportpdf', ContestExportPdfHandler);
  ctx.i18n.load('zh', {
    'Only contest owners or editors can export contest PDF': '仅比赛组织者或编辑可导出题面 PDF',
    'Export Problemset PDF': '导出题面 PDF',
    'Exporting a PDF of all problems in this contest as a single file.': '将本场比赛全部题面导出为单个文件',
    'Browser will ask where to save. If the PDF engine is not installed on the server, an HTML file will be returned instead - use Ctrl+P to print as PDF.':
      '浏览器将提示保存位置。若服务器未安装 PDF 引擎, 将返回 HTML 文件, 可用 Ctrl+P 打印为 PDF。',
    Samples: '样例',
    Sample: '样例',
    Explanation: '解释',
    Attachment: '附件',
    contest_exportpdf: '导出题面',
  });
}
