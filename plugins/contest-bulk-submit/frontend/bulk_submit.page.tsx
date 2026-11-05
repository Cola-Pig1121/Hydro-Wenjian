import { i18n, Notification } from '@hydrooj/ui-default';
import { NamedPage } from 'vj/misc/Page';

function esc(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const page = new NamedPage('bulk_submit', () => {
  const form = document.getElementById('bulk-submit-form') as HTMLFormElement | null;
  const resultEl = document.getElementById('bulk-submit-result');
  if (!form || !resultEl) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    if (!fileInput.files?.length) return;
    const data = new FormData();
    data.append('operation', 'upload');
    data.append('file', fileInput.files[0]);
    const dryrun = (form.querySelector('input[name="dryrun"]') as HTMLInputElement).checked;
    data.append('dryrun', String(dryrun));
    const defaultUser = (form.querySelector('input[name="defaultUser"]') as HTMLInputElement).value.trim();
    if (defaultUser) data.append('defaultUser', defaultUser);

    const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    btn.disabled = true;
    try {
      const res = await fetch(window.location.href, {
        method: 'POST',
        body: data,
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error.message || json.error);
      if (!json.results) throw new Error('unexpected response');
      const rows = json.results.map((r: any) => `
        <tr>
          <td>${esc(r.file)}</td>
          <td>${esc(r.user)}</td>
          <td>${esc(r.label)}</td>
          <td>${esc(r.lang || '-')}</td>
          <td style="color:${r.status === 'ok' || r.status === 'dryrun' ? 'green' : 'red'}">${esc(r.status)}</td>
          <td>${esc(r.error || r.rid || '')}</td>
        </tr>`).join('');
      resultEl.innerHTML = `
        <h3>${i18n('Result')}${json.dryrun ? ` (${i18n('Dry Run')})` : ''}</h3>
        <table class="table">
          <thead><tr>
            <th>${i18n('File')}</th><th>${i18n('User')}</th><th>${i18n('Label')}</th>
            <th>${i18n('Language')}</th><th>${i18n('Status')}</th><th></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
      if (!json.dryrun) Notification.success(i18n('Submissions queued for judging'));
    } catch (err: any) {
      Notification.error(err.message || String(err));
    } finally {
      btn.disabled = false;
    }
  });
});

export default page;
