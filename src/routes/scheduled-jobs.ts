import { Router } from 'express';
import { getAuth } from '@clerk/express';
import { createClient } from '@supabase/supabase-js';
import { calculateNextRunAt } from '../utils/scheduling';
import { getUserEmail } from '../services/userEmail';

const router = Router();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

router.post('/', async (req, res) => {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { target_url, width, height, full_page, user_agent, authorization_header, cookies, frequency, time_of_day, timezone_offset } = req.body;
    if (!target_url || !frequency || !time_of_day) return res.status(400).json({ error: 'Missing required fields' });

    const next_run_at = calculateNextRunAt(frequency, time_of_day, timezone_offset);

    const { data: job, error } = await supabase
        .from('scheduled_jobs')
        .insert({
            user_id: userId,
            target_url,
            width,
            height,
            full_page,
            user_agent,
            authorization_header,
            cookies,
            frequency,
            time_of_day,
            next_run_at: next_run_at.toISOString(),
            timezone_offset,
            alert_on_change: true
        })
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });

    const email = await getUserEmail(userId);
    if (email) {
        await supabase
            .from('scheduled_jobs')
            .update({ user_email: email })
            .eq('id', job.id);
    }

    res.json(job);
});

router.patch('/:id', async (req, res) => {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { alert_on_change, user_email } = req.body;
    const updates: Record<string, unknown> = {};

    if (typeof alert_on_change === 'boolean') updates.alert_on_change = alert_on_change;
    if (typeof user_email === 'string') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user_email)) {
            return res.status(400).json({ error: 'Invalid email address' });
        }
        updates.user_email = user_email;
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { error } = await supabase
        .from('scheduled_jobs')
        .update(updates)
        .eq('id', req.params.id)
        .eq('user_id', userId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

router.delete('/:id', async (req, res) => {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { error } = await supabase
        .from('scheduled_jobs')
        .update({ is_active: false })
        .eq('id', req.params.id)
        .eq('user_id', userId);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
});

router.get('/', async (req, res) => {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error } = await supabase
        .from('scheduled_jobs')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('next_run_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

export default router;
