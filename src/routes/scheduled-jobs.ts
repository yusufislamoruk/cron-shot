import { Router } from 'express';
import { getAuth } from '@clerk/express';
import { createClient } from '@supabase/supabase-js';
import { calculateNextRunAt } from '../utils/scheduling';

const router = Router();
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

router.post('/', async (req,res) => {
    const { userId } = getAuth(req);   
    if(!userId) return res.status(401).json({error: 'Unauthorized'});

    const { target_url, width, height, full_page, user_agent, authorization_header, cookies, frequency, time_of_day, timezone_offset} = req.body;
    if(!target_url || !frequency || !time_of_day) return res.status(400).json({error: 'Missing required fields'});

    const next_run_at = calculateNextRunAt(frequency,time_of_day,timezone_offset);
    
    const { data, error } = await supabase
    .from('scheduled_jobs')
    .insert({ user_id: userId, target_url, width, height, full_page, user_agent, authorization_header, cookies, frequency, time_of_day, next_run_at: next_run_at.toISOString(), timezone_offset})
    .select()
    .single();

    if (error) return res.status(500).json({ error: error.message});
    res.json(data);
});

router.delete('/:id', async (req,res) => {
    const { userId } = getAuth(req);
    if(!userId) return res.status(401).json({ error: 'Unauthorized'});

    const { data, error} = await supabase
    .from('scheduled_jobs')
    .update({ is_active: false})
    .eq('id', req.params.id)
    .eq('user_id',userId);

    if(error) return res.status(500).json({ error: error.message});
    res.json({ success: true});
});

router.get('/', async (req,res) => {
    const { userId } = getAuth(req);
    if(!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { data, error} = await supabase
    .from('scheduled_jobs')
    .select('*')
    .eq('user_id',userId)
    .eq('is_active',true)
    .order('next_run_at', { ascending: true});

    if (error) return res.status(500).json({ error: error.message});
    res.json(data);
});

export default router;