
export const generateS3Key = (timestamp: number): string => {
    return `screenshots/${timestamp}.png`;
};
