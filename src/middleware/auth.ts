import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';
import { AuthUser } from '../types';

declare global {
    namespace Express {
        interface Request {
            user?: AuthUser;
        }
    }
}

export async function verifyToken(req: Request, res: Response, next: NextFunction){
    try {
        let token = req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7) : null;
    
        if (!token){
            token = req.cookies?.['sb-access-token'];
        }

        if (!token){
            return res.status(401).json({ error: 'No token provided' });
        }
        const { data: { user }, error} = await supabase.auth.getUser(token);

        if(error || !user) {
            return res.status(401).json({ error: 'Invalid or expired token'});
        }

        req.user = {
            id: user.id,
            email: user.email || "",
        };

        next();
    } catch (err) {
        console.error('[verifyToken]',err);
        return res.status(500).json({ error: 'Auth verification failed'});
    }
}

export function setAuthCookie(
    res: Response,
    access_token: string,
    refresh_token: string
) {
    res.cookie('sb-access-token', access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 3600 * 1000, // 1 hour
     });
     res.cookie('sb-refresh-token', refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 604800, // 7 days
     });
}

export function clearAuthCookies(res: Response){
    res.clearCookie('sb-access-token');
    res.clearCookie('sb-refresh-token');
}