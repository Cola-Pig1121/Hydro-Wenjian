import React, { useEffect, useState } from 'react';
import {
    addPage, confirm, i18n, NamedPage, Notification, prompt, ReactDOM, request,
} from '@hydrooj/ui-default';

interface ListUser {
  _id: number;
  uname: string;
  mail?: string;
  priv: number;
  privFlags: string[];
  school?: string;
  mphone?: string;
  bio?: string;
  banReason?: string;
}

interface DomainInfo {
  domainId: string;
  name: string;
  role: string;
  join: boolean;
  roles: string[];
}

function api(operation: string, payload: Record<string, any> = {}) {
  return request.post('', { operation, ...payload });
}

const PRIV_FLAGS: [string, string][] = [
  ['PRIV_USER_PROFILE', 'Registered user'],
  ['PRIV_REGISTER_USER', 'Register users'],
  ['PRIV_EDIT_SYSTEM', 'Edit system (root)'],
  ['PRIV_SET_PERM', 'Set permission'],
  ['PRIV_READ_PROBLEM_DATA', 'Read problem data'],
  ['PRIV_READ_RECORD_CODE', 'Read others\' code'],
  ['PRIV_VIEW_HIDDEN_RECORD', 'View hidden records'],
  ['PRIV_JUDGE', 'Judge status'],
  ['PRIV_CREATE_DOMAIN', 'Create domain'],
  ['PRIV_VIEW_ALL_DOMAIN', 'View all domains'],
  ['PRIV_MANAGE_ALL_DOMAIN', 'Manage all domains'],
  ['PRIV_REJUDGE', 'Rejudge'],
  ['PRIV_VIEW_USER_SECRET', 'View user secret'],
  ['PRIV_VIEW_JUDGE_STATISTICS', 'Judge statistics'],
  ['PRIV_CREATE_FILE', 'Create file'],
  ['PRIV_UNLIMITED_QUOTA', 'Unlimited file quota'],
  ['PRIV_DELETE_FILE', 'Delete file'],
  ['PRIV_UNLIMITED_ACCESS', 'Unlimited access'],
  ['PRIV_VIEW_SYSTEM_NOTIFICATION', 'System notifications'],
  ['PRIV_SEND_MESSAGE', 'Send messages'],
  ['PRIV_MOD_BADGE', 'Moderator badge'],
];

function UserDetail({ uid, onBack }: { uid: number, onBack: () => void }) {
  const [user, setUser] = useState<any>(null);
  const [domains, setDomains] = useState<DomainInfo[]>([]);
  const [error, setError] = useState('');

  const reload = async () => {
    try {
      const res = await api('get', { uid });
      setUser(res.user);
      setDomains(res.domains);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => { reload(); }, []);

  const guard = async (fn: () => Promise<any>) => {
    try {
      await fn();
      Notification.success(i18n('Saved'));
      reload();
    } catch (e: any) {
      Notification.error(e.message);
    }
  };

  if (!user) return <p>{error || i18n('Loading...')}</p>;

  const editInfo = async () => {
    const res = await prompt(i18n('Edit User'), {
      uname: { type: 'text', label: i18n('Name'), default: user.uname },
      mail: { type: 'text', label: i18n('Email'), default: user.mail || '' },
      school: { type: 'text', label: i18n('School'), default: user.school || '' },
      mphone: { type: 'text', label: 'mPhone', default: user.mphone || '' },
      bio: { type: 'textarea', label: i18n('Bio'), default: user.bio || '', rows: 3, columns: -12 },
    });
    if (!res) return;
    guard(() => api('updateInfo', { uid, ...res }));
  };

  const resetPassword = async () => {
    const res = await prompt(i18n('Reset Password'), {
      password: { type: 'text', label: `${i18n('Reset Password')} (${i18n('leave blank for random')})`, default: '' },
    });
    if (!res) return;
    try {
      const out = await api('resetPassword', { uid, password: res.password || undefined });
      await prompt(i18n('New password'), { password: { type: 'text', default: out.password, label: i18n('New password:') } });
    } catch (e: any) {
      Notification.error(e.message);
    }
  };

  const ban = async () => {
    const res = await prompt(i18n('Ban'), { reason: { type: 'text', label: i18n('Ban reason'), default: '' } });
    if (!res) return;
    guard(() => api('ban', { uid, reason: res.reason }));
  };

  const unban = async () => {
    if (!(await confirm(i18n('Unban')))) return;
    guard(() => api('unban', { uid }));
  };

  return (
    <>
      <div className="section visible">
        <div className="section__header">
          <h1 className="section__title">{user.uname} (#{user._id})</h1>
          <div className="section__tools">
            <button type="button" className="rounded button" onClick={onBack}>{i18n('Back')}</button>
          </div>
        </div>
        {user.banReason ? <div className="section__body"><p className="text-red">{i18n('Banned')}: {user.banReason}</p></div> : null}
        <div className="section__body">
          <div className="section__tools">
            <button type="button" className="rounded button" onClick={editInfo}>{i18n('Edit User')}</button>
            <button type="button" className="rounded button" onClick={resetPassword}>{i18n('Reset Password')}</button>
            <button type="button" className="rounded button warn" onClick={ban}>{i18n('Ban')}</button>
            <button type="button" className="rounded button" onClick={unban}>{i18n('Unban')}</button>
          </div>
        </div>
      </div>
      <div className="section visible">
        <div className="section__header">
          <h1 className="section__title">{i18n('Privileges')}</h1>
        </div>
        <div className="section__body">
          <div className="row">
            {PRIV_FLAGS.map(([key, label]) => (
              <div key={key} className="columns medium-6">
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={(user.privFlags || []).includes(key)}
                    onChange={(e) => {
                      const flags = e.target.checked
                        ? [...(user.privFlags || []), key]
                        : (user.privFlags || []).filter((f: string) => f !== key);
                      guard(() => api('setPriv', { uid, privFlags: flags }));
                    }}
                  />
                  {label}
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="section visible">
        <div className="section__header">
          <h1 className="section__title">{i18n('Domain Roles')}</h1>
        </div>
        <div className="section__body no-padding">
          <table className="data-table">
            <thead>
              <tr>
                <th>{i18n('Domain')}</th>
                <th>{i18n('Role')}</th>
                <th>Join</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((d) => (
                <tr key={d.domainId}>
                  <td>{d.name}</td>
                  <td>
                    <select
                      className="inline compact select"
                      defaultValue={d.role}
                      onChange={(e) => guard(() => api('setDomainRole', { uid, domainId: d.domainId, role: e.target.value }))}
                    >
                      {d.roles.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={d.join}
                        onChange={(e) => guard(() => api('setDomainJoin', { uid, domainId: d.domainId, join: e.target.checked }))}
                      />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function CreateUserForm({ onBack, onCreated }: { onBack: () => void, onCreated: () => void }) {
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = (e.currentTarget as any).elements;
    try {
      const res = await api('createUser', { mail: f.mail.value, uname: f.uname.value, password: f.password.value });
      Notification.success(`${i18n('User created')}: UID ${res.uid}`);
      onCreated();
    } catch (err: any) {
      Notification.error(err.message);
    }
  };
  return (
    <div className="section visible">
      <div className="section__header">
        <h1 className="section__title">{i18n('Create User')}</h1>
        <div className="section__tools">
          <button type="button" className="rounded button" onClick={onBack}>{i18n('Back')}</button>
        </div>
      </div>
      <div className="section__body">
        <form onSubmit={submit}>
          <div className="row">
            <div className="columns medium-6 form__item">
              <label>{i18n('Name')}</label>
              <input name="uname" className="textbox" required autoComplete="off" />
            </div>
            <div className="columns medium-6 form__item">
              <label>{i18n('Email')}</label>
              <input name="mail" type="email" className="textbox" required autoComplete="off" />
            </div>
            <div className="columns medium-6 form__item">
              <label>{i18n('Password')}</label>
              <input name="password" type="text" className="textbox" required minLength={6} autoComplete="new-password" />
            </div>
          </div>
          <button type="submit" className="primary rounded button">{i18n('Create User')}</button>
        </form>
      </div>
    </div>
  );
}

function UserListPanel() {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<ListUser[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async (query = q, pg = page) => {
    try {
      const res = await api('list', { q: query, page: pg });
      setUsers(res.users);
      setCount(res.count);
    } catch (e: any) {
      Notification.error(e.message);
    }
  };

  useEffect(() => { load('', 1); }, []);

  if (selected !== null) {
    return <UserDetail uid={selected} onBack={() => { setSelected(null); load(q, page); }} />;
  }

  if (creating) {
    return <CreateUserForm onBack={() => setCreating(false)} onCreated={() => { setCreating(false); load('', 1); }} />;
  }

  const totalPages = Math.max(1, Math.ceil(count / 20));

  return (
    <>
      <div className="section visible">
        <div className="section__body">
          <form onSubmit={(e) => { e.preventDefault(); setPage(1); load(q, 1); }} name="filter-form" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div className="inline compact textbox-container">
              <input type="text" className="inline compact textbox" value={q} placeholder={i18n('Search users by uid, username or email')} onChange={(e) => setQ(e.target.value)} />
            </div>
            <button type="submit" className="primary rounded button">{i18n('Search')}</button>
            <button type="button" className="rounded button float-right" onClick={() => setCreating(true)}>+ {i18n('Create User')}</button>
          </form>
        </div>
        <div className="section__body no-padding">
          <table className="data-table">
            <thead>
              <tr>
                <th>UID</th>
                <th>{i18n('Name')}</th>
                <th>{i18n('Email')}</th>
                <th>{i18n('Privileges')}</th>
                <th>{i18n('Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td>{u._id}</td>
                  <td>
                    <a href={`/user/${u._id}`} className="typo-a">{u.uname}</a>
                    {u.banReason ? <span className="text-red"> ({i18n('Banned')})</span> : null}
                  </td>
                  <td>{u.mail}</td>
                  <td>{(u.privFlags || []).join(', ')}</td>
                  <td>
                    <button type="button" className="rounded button" onClick={() => setSelected(u._id)}>{i18n('Edit User')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="section__body">
            <ul className="pager">
              {page > 1 && (
                <li className="pager__item">
                  <a className="link" onClick={() => { setPage(page - 1); load(q, page - 1); }}>{i18n('pager_previous')}</a>
                </li>
              )}
              <li className="pager__item">{page} / {totalPages}</li>
              {page < totalPages && (
                <li className="pager__item">
                  <a className="link" onClick={() => { setPage(page + 1); load(q, page + 1); }}>{i18n('pager_next')}</a>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}

addPage(new NamedPage('user_list', () => {
  const container = document.getElementById('user-list-root');
  if (!container) return;
  ReactDOM.createRoot(container).render(<UserListPanel />);
}));


