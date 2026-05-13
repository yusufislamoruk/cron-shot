import { randomUUID } from "crypto";

export const generateS3Key = (timestamp: number): string => {
    return `screenshots/${timestamp}-${randomUUID()}.png`;
};
