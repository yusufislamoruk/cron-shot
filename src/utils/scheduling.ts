import { ScheduledJob } from "../types";

export function calculateNextRunAt(frequency: ScheduledJob['frequency'],timeOfDay: ScheduledJob['time_of_day'], timezoneOffset: number = 0): Date {
    const [hours, minutes] = timeOfDay.split(':').map(Number);
    const now = new Date();
    
    const offsetMs = (timezoneOffset * 60 * 60 * 1000);
    const next = new Date(now.getTime() + offsetMs);
    next.setHours(hours,minutes,0,0);

    if(next <= now ) {
        switch (frequency) {
            case 'daily': next.setDate(next.getDate() + 1); break;
            case 'weekly': next.setDate(next.getDate() + 7); break;
            case 'monthly': next.setDate(next.getDate() + 30); break;
        }
    }

    return next;
}