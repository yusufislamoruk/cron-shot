import { ScheduledJob } from "../types";

export function calculateNextRunAt(frequency: ScheduledJob['frequency'],timeOfDay: ScheduledJob['time_of_day'], timezoneOffset: number = 0): Date {
    const [hours, minutes] = timeOfDay.split(':').map(Number);
    const now = new Date();
    
    const desiredUtcHours = hours - timezoneOffset;
    const next = new Date(now);
    next.setUTCHours(desiredUtcHours,minutes,0,0);

    if(next <= now ) {
        switch (frequency) {
            case 'daily': next.setUTCDate(next.getUTCDate() + 1); break;
            case 'weekly': next.setUTCDate(next.getUTCDate() + 7); break;
            case 'monthly': next.setUTCDate(next.getUTCDate() + 30); break;
        }
    }

    return next;
}