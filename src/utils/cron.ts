import { CronExpressionParser } from "cron-parser";

export function getNextRunTime(cronExpression: string): Date {
    const expr = CronExpressionParser.parse(cronExpression);
    return expr.next().toDate();
}