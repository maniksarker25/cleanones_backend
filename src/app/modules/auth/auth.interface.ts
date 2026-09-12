import { USER_ROLE } from '../user/user.constant';

export type TLoginUser = {
    email: string;
    password: string;
    playerId: string;
    role: (typeof USER_ROLE)[keyof typeof USER_ROLE];
    platform?: 'android' | 'ios' | 'web';
};
