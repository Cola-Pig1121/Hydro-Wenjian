import { i18n, NamedPage } from '@hydrooj/ui-default';

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
    li.innerHTML = `<a class="menu__link" href="${url}" target="_blank" rel="noopener">${label}</a>`;
    menu.appendChild(li);
    return;
  }
  // Fallback: insert into the section header tools
  const tools = document.querySelector('.section__tools');
  if (tools) {
    const a = document.createElement('a');
    a.className = 'primary rounded button';
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = label;
    tools.appendChild(a);
  }
});

export default page;
