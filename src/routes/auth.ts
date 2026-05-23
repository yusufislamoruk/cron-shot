import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';

const router = Router();

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

//POST /auth/register
router.post('/register', async (req: Request, res: Response) => {
    const { email, password } = req.body;

    if(!email || !password) {
        return res.status(400).json({ error: 'Email and password are required'});
    }
    if (password.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters'});
        }
    try {
        const { data, error} = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });

        if (error){
            return res.status(400).json({ error: error?.message});
        }

        return res.status(201).json({
            message: 'User created successfully',
            user: { id: data.user?.id, email: data.user?.email }
        });
    } catch (err){
        console.error('[auth/register]',err);
        return res.status(500).json({ error: 'Interval server error'});
    }
})

// POST /auth/login
router.post('/login', async (req: Request, res: Response) =>{
    const { email, password} = req.body;

    if(!email || !password){
        return res.status(400).json({ error: 'Email and password are required'});
    }

    try {
        const { data, error} = await supabase.auth.signInWithPassword({
            email,
            password,
        });
    
    if (error) {
        return res.status(401).json({ error: 'Invalid credentials'});
        }
    
    return res.json({
        access_token: data.session?.access_token,
        refresh_token: data.session?.refresh_token,
        user: { id: data.user?.id, email: data.user?.email },
    });
    } catch (err) {
        console.error('[auth/login]',err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /auth/logout
router.post('/logout', async (_req: Request, res: Response) =>{
    return res.json({ message: 'Logged out successfully' });
});

// POST /auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) =>{
    const { email } = req.body;

    if(!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email format '});
    }

    try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/reset-password`,
        });

        if (error) {
            return res.status(400).json({ error: error.message });
        }

        return res.json({ message: 'Password reset email sent. Check your inbox.' });
    } catch (err) {
        console.error('[auth/forgot-password]', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});
// POST /auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
    const { token, new_password } = req.body;

    if(!token || !new_password) {
        return res.status(400).json({ error: "Token and new password are required" });
    }

    if(new_password.length < 8){
        return res.status(400).json({ error: 'Password must be at least 8 characters.'})
    }

    try {
        const { data: { user }, error:getUserError } = await supabase.auth.getUser(token);

        if(getUserError || !user){
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
            password: new_password,
        });

        if(updateError) {
            return res.status(400).json({ error: 'Invalid or expired token' });
        }

        return res.json({ message: 'Password updated successfully' });
    } catch (err) {
        console.error('[auth/reset-password]', err);
        return res.status(500).json({ error: 'Interval server error '});
    }
});
//GET /auth/me
router.get('/me', async (req:Request, res:Response) =>{
    const authHeader = req.headers.authorization;

    if(!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided'});
    }
    
    const token = authHeader.split(' ')[1];

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if(error || !user){
            return res.status(401).json({ error: 'Invalid token' });
        }
    

    return res.json({
        id: user.id,
        email: user.email,
    });
    } catch (err) {
        console.error('[auth/me]', err);
        return res.status(500).json({ error: 'Interval server error' });
    }
});

export default router;