import {
    Context, DomainModel, ForbiddenError, Handler, OplogModel, param, PRIV, randomstring,
    Types, UserModel,
} from 'hydrooj';

const PRIV_FLAGS: Record<string, number> = {
    PRIV_USER_PROFILE: PRIV.PRIV_USER_PROFILE,
    PRIV_EDIT_SYSTEM: PRIV.PRIV_EDIT_SYSTEM,
    PRIV_SET_PERM: PRIV.PRIV_SET_PERM,
    PRIV_REGISTER_USER: PRIV.PRIV_REGISTER_USER,
    PRIV_READ_PROBLEM_DATA: PRIV.PRIV_READ_PROBLEM_DATA,
    PRIV_READ_RECORD_CODE: PRIV.PRIV_READ_RECORD_CODE,
    PRIV_VIEW_HIDDEN_RECORD: PRIV.PRIV_VIEW_HIDDEN_RECORD,
    PRIV_JUDGE: PRIV.PRIV_JUDGE,
    PRIV_CREATE_DOMAIN: PRIV.PRIV_CREATE_DOMAIN,
    PRIV_VIEW_ALL_DOMAIN: PRIV.PRIV_VIEW_ALL_DOMAIN,
    PRIV_MANAGE_ALL_DOMAIN: PRIV.PRIV_MANAGE_ALL_DOMAIN,
    PRIV_REJUDGE: PRIV.PRIV_REJUDGE,
    PRIV_VIEW_USER_SECRET: PRIV.PRIV_VIEW_USER_SECRET,
    PRIV_VIEW_JUDGE_STATISTICS: PRIV.PRIV_VIEW_JUDGE_STATISTICS,
    PRIV_CREATE_FILE: PRIV.PRIV_CREATE_FILE,
    PRIV_UNLIMITED_QUOTA: PRIV.PRIV_UNLIMITED_QUOTA,
    PRIV_DELETE_FILE: PRIV.PRIV_DELETE_FILE,
    PRIV_UNLIMITED_ACCESS: PRIV.PRIV_UNLIMITED_ACCESS,
    PRIV_VIEW_SYSTEM_NOTIFICATION: PRIV.PRIV_VIEW_SYSTEM_NOTIFICATION,
    PRIV_SEND_MESSAGE: PRIV.PRIV_SEND_MESSAGE,
    PRIV_MOD_BADGE: PRIV.PRIV_MOD_BADGE,
};

function privBitsToArray(bits: number): string[] {
    return Object.keys(PRIV_FLAGS).filter((k) => (bits & PRIV_FLAGS[k]) === PRIV_FLAGS[k]);
}

function privArrayToBits(names: string[]): number {
    let bits = 0;
    for (const n of names) {
        if (PRIV_FLAGS[n] != null) bits |= PRIV_FLAGS[n];
    }
    return bits;
}

class UserListHandler extends Handler {
    async prepare() {
        this.checkPriv(PRIV.PRIV_EDIT_SYSTEM);
    }

    async get() {
        this.response.template = 'user_list.html';
        this.response.body = { privFlags: Object.keys(PRIV_FLAGS) };
    }

    @param('q', Types.String, true)
    @param('page', Types.PositiveInt, true)
    async postList(domainId: string, q = '', page = 1) {
        const query: any = {};
        if (q) {
            const escaped = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const or: any[] = [
                { uname: { $regex: escaped, $options: 'i' } },
                { mail: { $regex: escaped, $options: 'i' } },
            ];
            if (/^\d+$/.test(q)) or.push({ _id: +q });
            query.$or = or;
        }
        const [udocs, count] = await this.ctx.db.paginate(
            UserModel.getMulti(query, ['_id', 'uname', 'mail', 'priv', 'nSubmit', 'nAccept', 'regAt', 'banReason', 'school', 'mphone']),
            page, 20,
        );
        this.response.body = {
            users: udocs.map((udoc) => ({
                ...udoc,
                privFlags: privBitsToArray(udoc.priv || 0),
            })),
            count,
            page,
        };
    }

    @param('uid', Types.Int)
    async postGet(domainId: string, uid: number) {
        const udoc = await UserModel.getById('system', uid);
        if (!udoc) throw new ForbiddenError('user not found');
        const dudocs = await DomainModel.collUser.find({ uid }).toArray();
        const domainIds = [...new Set(dudocs.map((i) => i.domainId))];
        const domains = await Promise.all(domainIds.map(async (d) => {
            const [ddoc] = await DomainModel.getMulti({ _id: d }).toArray();
            const roles = await DomainModel.getRoles(d);
            const dudoc = dudocs.find((i) => i.domainId === d);
            return {
                domainId: d,
                name: ddoc?.name || d,
                role: dudoc?.role || 'default',
                join: !!dudoc?.join,
                roles: roles.map((r: any) => r._id).filter((r: string) => r !== 'guest'),
            };
        }));
        this.response.body = {
            user: {
                ...udoc,
                privFlags: privBitsToArray(udoc.priv || 0),
            },
            domains,
        };
    }

    @param('uid', Types.Int)
    @param('uname', Types.Username, true)
    @param('mail', Types.Email, true)
    @param('school', Types.String, true)
    @param('mphone', Types.String, true)
    @param('bio', Types.String, true)
    async postUpdateInfo(domainId: string, uid: number, uname?: string, mail?: string, school?: string, mphone?: string, bio?: string) {
        const ops: Promise<any>[] = [];
        if (uname) ops.push(UserModel.setUname(uid, uname));
        if (mail) ops.push(UserModel.setEmail(uid, mail));
        const $set: any = {};
        if (school !== undefined) $set.school = school;
        if (mphone !== undefined) $set.mphone = mphone;
        if (bio !== undefined) $set.bio = bio;
        if (Object.keys($set).length) ops.push(UserModel.setById(uid, $set));
        if (!ops.length) throw new ForbiddenError('nothing to update');
        await Promise.all(ops);
        await OplogModel.log(this, 'userlist.update_info', { uid, uname, mail, school, mphone });
        this.response.body = { ok: true };
    }

    @param('uid', Types.Int)
    @param('password', Types.String, true)
    async postResetPassword(domainId: string, uid: number, password = '') {
        const newPassword = password || randomstring(12);
        await UserModel.setPassword(uid, newPassword);
        await OplogModel.log(this, 'userlist.reset_password', { uid });
        this.response.body = { ok: true, password: newPassword };
    }

    @param('uid', Types.Int)
    @param('privFlags', Types.ArrayOf(Types.String, true), true)
    async postSetPriv(domainId: string, uid: number, privFlags?: string[]) {
        if (!privFlags) throw new ForbiddenError('privFlags required');
        const priv = privArrayToBits(privFlags);
        await UserModel.setPriv(uid, priv);
        await OplogModel.log(this, 'userlist.set_priv', { uid, priv });
        this.response.body = { ok: true };
    }

    @param('uid', Types.Int)
    @param('reason', Types.String, true)
    async postBan(domainId: string, uid: number, reason = '') {
        await UserModel.ban(uid, reason);
        await OplogModel.log(this, 'userlist.ban', { uid, reason });
        this.response.body = { ok: true };
    }

    @param('uid', Types.Int)
    @param('priv', Types.Int, true)
    async postUnban(domainId: string, uid: number, priv?: number) {
        await UserModel.setById(uid, { priv: priv ?? PRIV.PRIV_DEFAULT, banReason: '' });
        await OplogModel.log(this, 'userlist.unban', { uid });
        this.response.body = { ok: true };
    }

    @param('domainId', Types.String)
    @param('uid', Types.Int)
    @param('role', Types.Role)
    async postSetDomainRole(domainId: string, uid: number, role: string) {
        const dudoc = await DomainModel.collUser.findOne({ domainId, uid });
        if (!dudoc) throw new ForbiddenError('user not in domain');
        await DomainModel.setUserRole(domainId, uid, role);
        await OplogModel.log(this, 'userlist.set_domain_role', { uid, domainId, role });
        this.response.body = { ok: true };
    }

    @param('domainId', Types.String)
    @param('uid', Types.Int)
    @param('join', Types.Boolean)
    async postSetDomainJoin(domainId: string, uid: number, join: boolean) {
        await DomainModel.setJoin(domainId, uid, join);
        await OplogModel.log(this, 'userlist.set_domain_join', { uid, domainId, join });
        this.response.body = { ok: true };
    }
}

export async function apply(ctx: Context) {
    ctx.Route('user_list', '/manage/userlist', UserListHandler, PRIV.PRIV_EDIT_SYSTEM);
    ctx.injectUI('ControlPanel', 'user_list');
}
