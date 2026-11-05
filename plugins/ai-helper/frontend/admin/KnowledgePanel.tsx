/**
 * 知识库管理面板
 * - 连接配置: builtin 内置库 / http 外部知识库 (链接 ima 知识库或其检索代理)
 * - 内置条目管理: 新增/编辑/删除/启停
 * - 检索测试: 模拟一次检索并查看将注入 Prompt 的参考块
 */

import React, { useState, useEffect, useCallback } from 'react';
import { i18n } from '../utils/i18n';

interface HttpConfigState {
  url: string;
  kbId: string;
  apiKey: string;          // 新明文, 空则不修改
  hasApiKey: boolean;
  timeoutMs: number;
}

interface KbConfigState {
  enabled: boolean;
  mode: 'builtin' | 'http';
  topK: number;
  maxChars: number;
  http?: HttpConfigState;
}

interface Entry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  problemPid?: string;
  enabled: boolean;
}

const EMPTY_ENTRY = { title: '', content: '', tags: '', problemPid: '', enabled: true };

async function callApi(payload: Record<string, any>) {
  const res = await fetch('/ai-helper/admin/knowledge', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok || json.ok === false) {
    throw new Error(json.error || `HTTP ${res.status}`);
  }
  return json;
}

export function KnowledgePanel() {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<KbConfigState | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ ...EMPTY_ENTRY });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testQuery, setTestQuery] = useState('');
  const [testResult, setTestResult] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 2500);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/ai-helper/admin/knowledge', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const http = json.config.http || {};
      setConfig({
        enabled: !!json.config.enabled,
        mode: json.config.mode || 'builtin',
        topK: json.config.topK || 3,
        maxChars: json.config.maxChars || 2000,
        http: {
          url: http.url || '',
          kbId: http.kbId || '',
          apiKey: '',
          hasApiKey: !!http.hasApiKey,
          timeoutMs: http.timeoutMs || 8000,
        },
      });
      setEntries(json.entries || []);
      setTotal(json.total || 0);
    } catch (err: any) {
      setError(err.message || i18n('ai_helper_kb_error_load', ''));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const saveConfig = async () => {
    if (!config) return;
    setError('');
    try {
      const payload: Record<string, any> = {
        op: 'saveConfig',
        config: {
          enabled: config.enabled,
          mode: config.mode,
          topK: config.topK,
          maxChars: config.maxChars,
          http: {
            url: config.http?.url || '',
            kbId: config.http?.kbId || '',
            timeoutMs: config.http?.timeoutMs || 8000,
          },
        },
      };
      if (config.http?.apiKey) (payload.config.http as any).apiKey = config.http.apiKey;
      await callApi(payload);
      flash(i18n('ai_helper_kb_saved', ''));
      loadAll();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const reloadEntries = async () => {
    try {
      const json = await callApi({ op: 'list', search: search || undefined, page: 1, pageSize: 50 });
      setEntries(json.entries || []);
      setTotal(json.total || 0);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const submitEntry = async () => {
    setError('');
    try {
      const tags = form.tags.split(/[,，]/).map((t) => t.trim()).filter((t) => t);
      if (editingId) {
        await callApi({ op: 'update', id: editingId, ...form, tags, enabled: form.enabled });
      } else {
        await callApi({ op: 'create', ...form, tags, enabled: form.enabled });
      }
      setForm({ ...EMPTY_ENTRY });
      setEditingId(null);
      flash(i18n('ai_helper_kb_saved', ''));
      reloadEntries();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const deleteEntry = async (id: string) => {
    if (!window.confirm(i18n('ai_helper_kb_confirm_delete', ''))) return;
    try {
      await callApi({ op: 'delete', id });
      reloadEntries();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleEntry = async (entry: Entry) => {
    try {
      await callApi({ op: 'update', id: entry.id, enabled: !entry.enabled });
      reloadEntries();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const runTest = async () => {
    setError('');
    setTestResult('');
    try {
      const json = await callApi({ op: 'test', query: testQuery });
      setTestResult(json.block || '(empty)');
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return <div style={{ padding: 24 }}>{i18n('ai_helper_kb_loading', '')}</div>;
  }

  return (
    <div className="ai-helper-knowledge-panel" style={{ padding: 16, maxWidth: 1000 }}>
      <h2>{i18n('ai_helper_kb_title', '')}</h2>
      {error && <div style={{ color: 'crimson', margin: '8px 0' }}>{error}</div>}
      {notice && <div style={{ color: 'green', margin: '8px 0' }}>{notice}</div>}

      {config && (
        <section style={{ marginBottom: 24, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
          <h3>{i18n('ai_helper_kb_config', '')}</h3>
          <label style={{ display: 'block', margin: '6px 0' }}>
            <input type="checkbox" checked={config.enabled} onChange={(e) => setConfig({ ...config, enabled: e.target.checked })} />
            {' '}{i18n('ai_helper_kb_enable', '')}
          </label>
          <label style={{ display: 'block', margin: '6px 0' }}>
            {i18n('ai_helper_kb_mode', '')}{' '}
            <select value={config.mode} onChange={(e) => setConfig({ ...config, mode: e.target.value as any })}>
              <option value="builtin">{i18n('ai_helper_kb_mode_builtin', '')}</option>
              <option value="http">{i18n('ai_helper_kb_mode_http', '')}</option>
            </select>
          </label>
          <div style={{ display: 'flex', gap: 16, margin: '6px 0' }}>
            <label>
              {i18n('ai_helper_kb_topk', '')}{' '}
              <input type="number" min={1} max={10} value={config.topK}
                onChange={(e) => setConfig({ ...config, topK: Number(e.target.value) })} />
            </label>
            <label>
              {i18n('ai_helper_kb_maxchars', '')}{' '}
              <input type="number" min={200} max={8000} step={200} value={config.maxChars}
                onChange={(e) => setConfig({ ...config, maxChars: Number(e.target.value) })} />
            </label>
          </div>
          {config.mode === 'http' && config.http && (
            <fieldset style={{ marginTop: 8, border: '1px dashed #bbb', borderRadius: 6, padding: 8 }}>
              <legend>{i18n('ai_helper_kb_http_config', '')}</legend>
              <p style={{ fontSize: 12, color: '#888' }}>{i18n('ai_helper_kb_http_hint', '')}</p>
              <label style={{ display: 'block', margin: '4px 0' }}>
                URL{' '}
                <input style={{ width: '100%' }} type="text" value={config.http.url}
                  placeholder="https://…/retrieval (ima 知识库检索接口或代理)"
                  onChange={(e) => setConfig({ ...config, http: { ...config.http!, url: e.target.value } })} />
              </label>
              <label style={{ display: 'block', margin: '4px 0' }}>
                API Key{' '}
                <input style={{ width: '100%' }} type="password" value={config.http.apiKey}
                  placeholder={config.http.hasApiKey ? i18n('ai_helper_kb_key_saved', '') : ''}
                  onChange={(e) => setConfig({ ...config, http: { ...config.http!, apiKey: e.target.value } })} />
              </label>
              <div style={{ display: 'flex', gap: 16, margin: '4px 0' }}>
                <label style={{ flex: 1 }}>
                  {i18n('ai_helper_kb_kbid', '')}{' '}
                  <input style={{ width: '100%' }} type="text" value={config.http.kbId}
                    onChange={(e) => setConfig({ ...config, http: { ...config.http!, kbId: e.target.value } })} />
                </label>
                <label>
                  {i18n('ai_helper_kb_timeout', '')}{' '}
                  <input type="number" min={1000} max={60000} step={500} value={config.http.timeoutMs}
                    onChange={(e) => setConfig({ ...config, http: { ...config.http!, timeoutMs: Number(e.target.value) } })} />
                </label>
              </div>
            </fieldset>
          )}
          <div style={{ marginTop: 10 }}>
            <button type="button" className="button" onClick={saveConfig}>{i18n('ai_helper_kb_save_config', '')}</button>
          </div>
        </section>
      )}

      <section style={{ marginBottom: 24, padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
        <h3>{i18n('ai_helper_kb_entries', '')} ({total})</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input style={{ flex: 1 }} type="text" value={search} placeholder={i18n('ai_helper_kb_search', '')}
            onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && reloadEntries()} />
          <button type="button" className="button--default" onClick={reloadEntries}>{i18n('ai_helper_kb_search_btn', '')}</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle}>{i18n('ai_helper_kb_col_title', '')}</th>
              <th style={thStyle}>标签</th>
              <th style={thStyle}>{i18n('ai_helper_kb_col_pid', '')}</th>
              <th style={thStyle}>{i18n('ai_helper_kb_col_enabled', '')}</th>
              <th style={thStyle}>{i18n('ai_helper_kb_col_actions', '')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} style={{ borderBottom: '1px solid #eee' }}>
                <td style={tdStyle}>{entry.title}<br /><span style={{ color: '#999' }}>{entry.content.slice(0, 80)}</span></td>
                <td style={tdStyle}>{(entry.tags || []).join(', ')}</td>
                <td style={tdStyle}>{entry.problemPid || '-'}</td>
                <td style={tdStyle}>
                  <button type="button" onClick={() => toggleEntry(entry)}>{entry.enabled ? 'ON' : 'OFF'}</button>
                </td>
                <td style={tdStyle}>
                  <button type="button" onClick={() => { setEditingId(entry.id); setForm({ title: entry.title, content: entry.content, tags: (entry.tags || []).join(','), problemPid: entry.problemPid || '', enabled: entry.enabled }); }}>
                    {i18n('ai_helper_kb_edit', '')}
                  </button>{' '}
                  <button type="button" onClick={() => deleteEntry(entry.id)}>{i18n('ai_helper_kb_delete', '')}</button>
                </td>
              </tr>
            ))}
            {!entries.length && (
              <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: '#999' }}>{i18n('ai_helper_kb_no_entries', '')}</td></tr>
            )}
          </tbody>
        </table>
        <fieldset style={{ marginTop: 12, border: '1px dashed #bbb', borderRadius: 6, padding: 8 }}>
          <legend>{editingId ? i18n('ai_helper_kb_edit', '') : i18n('ai_helper_kb_add', '')}</legend>
          <label style={{ display: 'block', margin: '4px 0' }}>
            {i18n('ai_helper_kb_col_title', '')}{' '}
            <input style={{ width: '100%' }} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label style={{ display: 'block', margin: '4px 0' }}>
            标签(逗号分隔){' '}
            <input style={{ width: '100%' }} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </label>
          <label style={{ display: 'block', margin: '4px 0' }}>
            {i18n('ai_helper_kb_col_pid', '')}{' '}
            <input style={{ width: 240 }} value={form.problemPid || ''} onChange={(e) => setForm({ ...form, problemPid: e.target.value })} />
          </label>
          <label style={{ display: 'block', margin: '4px 0' }}>
            {i18n('ai_helper_kb_content', '')}{' '}
            <textarea style={{ width: '100%', height: 120 }} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
          </label>
          <label style={{ display: 'block', margin: '4px 0' }}>
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
            {' '}{i18n('ai_helper_kb_col_enabled', '')}
          </label>
          <button type="button" className="button" onClick={submitEntry}>{i18n('ai_helper_kb_save', '')}</button>
          {editingId && (
            <button type="button" onClick={() => { setEditingId(null); setForm({ ...EMPTY_ENTRY }); }}>
              {i18n('ai_helper_kb_cancel', '')}
            </button>
          )}
        </fieldset>
      </section>

      <section style={{ padding: 12, border: '1px solid #ddd', borderRadius: 8 }}>
        <h3>{i18n('ai_helper_kb_test', '')}</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ flex: 1 }} value={testQuery} placeholder={i18n('ai_helper_kb_test_placeholder', '')}
            onChange={(e) => setTestQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runTest()} />
          <button type="button" className="button" onClick={runTest}>{i18n('ai_helper_kb_run', '')}</button>
        </div>
        {testResult && (
          <pre style={{ whiteSpace: 'pre-wrap', background: '#f7f7f7', padding: 8, marginTop: 8, borderRadius: 4 }}>{testResult}</pre>
        )}
      </section>
    </div>
  );
}

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '4px 8px', borderBottom: '2px solid #ddd' };
const tdStyle: React.CSSProperties = { padding: '4px 8px', verticalAlign: 'top' };

export default KnowledgePanel;
