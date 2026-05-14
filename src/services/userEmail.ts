import { createClerkClient } from "@clerk/backend";
import { createClient } from "@supabase/supabase-js";

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export async function getUserEmail(userId: string): Promise<string | null> {
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data: cached } = await supabase
        .from('users')
        .select('email, email_updated_at')
        .eq('id', userId)
        .single();

    if (cached && Date.now() - new Date(cached.email_updated_at).getTime() < CACHE_TTL_MS) {
        return cached.email;
    }

    try {
        const user = await clerk.users.getUser(userId);
        const email = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress
            ?? user.emailAddresses[0]?.emailAddress
            ?? null;

        if (!email) return null;

        await supabase
            .from('users')
            .upsert({ id: userId, email, email_updated_at: new Date().toISOString() });

        return email;
    } catch (err) {
        console.error('[userEmail] Failed to fetch from Clerk:', err);
        return cached?.email ?? null;
    }
}
