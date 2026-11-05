import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { i18n, Notification, request } from '@hydrooj/ui-default';
import { NamedPage } from 'vj/misc/Page';

interface ListUser {
  _id: number;
  uname: string;
  mail?: string;
  priv: number;
  privFlags: string[];
  school?: string;
  mphone?: string;
  banReason?: string;
  nSubmit?: number;
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

const PRIV_GROUPS: [string, string][] = [
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

function UserDetail({ uid, onClose, onChanged }: { uid: number, onClose: () => void, onChanged: () => void }) {
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

  const guard = async (fn: () => Promise<any>, msg: string) => {
    try {
      await fn();
      Notification.success(msg);
      reload();
      onChanged();
    } catch (e: any) {
      Notification.error(e.message);
    }
  };

  if (!user) return <p>{error || i18n('Loading...')}</p>;
  return (
    <div className="section" style={{ marginTop: '1rem' }}>
      <div className="section__header">
        <h1 className="section__title">{user.uname} (#{user._id})</h1>
        <button className="button--flat button--current" onClick={onClose}>{i18n('Cancel')}</button>
      </div>
      <div className="section__body">
        {user.banReason ? <p style={{ color: 'red' }}>{i18n('Banned')}: {user.banReason}</p> : null}
        <div className="cols">
          <div className="col" style={{ minWidth: '40%', paddingRight: '1rem' }}>
            <p className="bg--tint-1 padding-4 rounded-4">
              <b>{i18n('Edit User')}</b>
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = e.currentTarget.elements as any;
                guard(() => api('updateInfo', {
                  uid, uname: f.uname.value, mail: f.mail.value, school: f.school.value, mphone: f.mphone.value, bio: f.bio.value,
                }), i18n('Saved'));
              }}
            >
              <label className="form__label">{i18n('Name')}<input className="rounded textbox" name="uname" defaultValue={user.uname} /></label>
              <label className="form__label">{i18n('Email')}<input className="rounded textbox" name="mail" defaultValue={user.mail || ''} /></label>
              <label className="form__label">{i18n('School')}<input className="rounded textbox" name="school" defaultValue={user.school || ''} /></label>
              <label className="form__label">mPhone<input className="rounded textbox" name="mphone" defaultValue={user.mphone || ''} /></label>
              <label className="form__label">{i18n('Bio')}<input className="rounded textbox" name="bio" defaultValue={user.bio || ''} /></label>
              <button className="button primary" type="submit">{i18n('Save Info')}</button>
            </form>
            <p className="bg--tint-1 padding-4 rounded-4" style={{ marginTop: '1rem' }}>
              <b>{i18n('Reset Password')}</b>
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = e.currentTarget.elements as any;
                guard(async () => {
                  const res = await api('resetPassword', { uid, password: f.password.value || undefined });
                  Notification.success(`${i18n('New password:')} ${res.password}`);
                }, i18n('Saved'));
              }}
            >
              <label className="form__label">
                {i18n('Reset Password')}
                <input className="rounded textbox" name="password" type="text" placeholder="(random)" />
              </label>
              <button className="button primary" type="submit">{i18n('Reset Password')}</button>
            </form>
            <p className="bg--tint-1 padding-4 rounded-4" style={{ marginTop: '1rem' }}>
              <b>{i18n('Privileges')}</b>
            </p>
            <PrivilegeEditor flags={user.privFlags || []} onSave={(flags) => guard(() => api('setPriv', { uid, privFlags: flags }), i18n('Saved'))} />
            <p style={{ marginTop: '1rem' }}>
              <button
                className="button warn"
                onClick={() => guard(() => api('ban', { uid, reason: window.prompt(i18n('Ban reason')) || '' }), i18n('Saved'))}
              >
                {i18n('Ban')}
              </button>
              {' '}
              <button
                className="button"
                onClick={() => guard(() => api('unban', { uid }), i18n('Saved'))}
              >
                {i18n('Unban')}
              </button>
            </p>
          </div>
          <div className="col" style={{ minWidth: '40%' }}>
            <p className="bg--tint-1 padding-4 rounded-4">
              <b>{i18n('Domain Roles')}</b>
            </p>
            <table className="table">
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
                        defaultValue={d.role}
                        onChange={(e) => guard(() => api('setDomainRole', { uid, domainId: d.domainId, role: e.target.value }), i18n('Saved'))}
                      >
                        {d.roles.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={d.join}
                        onChange={(e) => guard(() => api('setDomainJoin', { uid, domainId: d.domainId, join: e.target.checked }), i18n('Saved'))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function PrivilegeEditor({ flags, onSave }: { flags: string[], onSave: (flags: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>(flags);
  useEffect(() => { setSelected(flags); }, [flags]);
  return (
    <div>
      <div style={{ maxHeight: '16rem', overflowY: 'auto', border: '1px solid #eee', padding: '0.5rem' }}>
        {PRIV_GROUPS.map(([key, label]) => (
          <label key={key} style={{ display: 'block', fontSize: '0.85rem' }}>
            <input
              type="checkbox"
              checked={selected.includes(key)}
              onChange={(e) => {
                setSelected((s) => (e.target.checked ? [...s, key] : s.filter((i) => i !== key)));
              }}
            />
            {' '}{label}
          </label>
        ))}
      </div>
      <button className="button primary" style={{ marginTop: '0.5rem' }} onClick={() => onSave(selected)}>
        {i18n('Save Privileges')}
      </button>
    </div>
  );
}

function UserListPanel() {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<ListUser[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);

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

  const totalPages = Math.max(1, Math.ceil(count / 20));
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          load(q, 1);
        }}
      >
        <div className="input group attached">
          <input
            type="text"
            className="rounded textbox medium flexible"
            placeholder={i18n('Search users by uid, username or email')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="button primary" type="submit">{i18n('Search')}</button>
        </div>
      </form>
      <table className="table" style={{ marginTop: '1rem' }}>
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
                {u.uname}
                {u.banReason ? <span className="logout-sinkin__text" style={{ color: 'red', marginLeft: '0.5rem' }}>({i18n('Banned')})</span> : null}
              </td>
              <td>{u.mail}</td>
              <td style={{ fontSize: '0.75rem', maxWidth: '18rem' }}>{(u.privFlags || []).join(', ')}</td>
              <td>
                <button className="button--flat button--current" onClick={() => setSelected(u._id)}>{i18n('Edit User')}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div style={{ marginTop: '1rem' }}>
          <button className="button--flat" disabled={page <= 1} onClick={() => { setPage((p) => p - 1); load(q, page - 1); }}>‹</button>
          <span> {page} / {totalPages} </span>
          <button className="button--flat" disabled={page >= totalPages} onClick={() => { setPage((p) => p + 1); load(q, page + 1); }}>›</button>
        </div>
      )}
      {selected !== null && (
        <UserDetail uid={selected} onClose={() => setSelected(null)} onChanged={() => load(q, page)} />
      )}
    </>
  );
}

const page = new NamedPage('user_list', () => {
  const container = document.getElementById('user-list-root');
  if (!container) return;
  ReactDOM.createRoot(container).render(<UserListPanel />);
});

export default page;
