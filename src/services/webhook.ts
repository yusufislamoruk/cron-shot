interface WebhookPayload {
    screenshot_id: string;
    s3_url: string;
    taken_at: string;
    target_url: string;
}

export async function sendWebhook(
    webhookUrl: string,
    payload: WebhookPayload
): Promise<void> {
    try {
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            console.error(`[webhook] Failed to send to ${webhookUrl}: ${response.status} ${response.statusText}`);
        } else {
            console.log(`[webhook] Successfully sent to ${webhookUrl}`);
        }
    } catch (error) {
        console.error(`[webhook] Error sending to ${webhookUrl}:`, error);
    }
}