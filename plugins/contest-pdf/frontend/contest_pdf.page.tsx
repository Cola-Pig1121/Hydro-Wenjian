import { i18n } from '@hydrooj/ui-default';
import { NamedPage } from 'vj/misc/Page';

function exportUrl() {
  const dm = location.pathname.match(/^\/d\/([^/]+)/);
  const domainPrefix = dm ? `/d/${dm[1]}` : '';
  const m = location.pathname.match(/\/contest\/([0-9a-f]{24})\/management\/?$/i);
  if (!m) return null;
  return `${domainPrefix}/contest/${m[1]}/exportpdf?format=pdf`;
}

const page = new NamedPage('contest_manage', () => {
  const url = exportUrl();
  if (!url) return;
  const label = i18n('Export Problemset PDF');
  const menu = document.querySelector('ol.menu');
  if (menu) {
    const li = document.createElement('li');
    li.className = 'menu__item';
    li.innerHTML = `<a class="menu__link" href="${url}" target="_blank" rel="noopener"><i class="icon print"></i> ${label}</a>`;
    menu.appendChild(li);
    return;
  }
  const btn = document.createElement('a');
  btn.href = url;
  btn.target = '_blank';
  btn.rel = 'noopener';
  btn.className = 'button primary float--right';
  btn.style.position = 'fixed';
  btn.style.bottom = '1rem';
  btn.style.right = '1rem';
  btn.textContent = label;
  document.body.appendChild(btn);
});

export default page;
