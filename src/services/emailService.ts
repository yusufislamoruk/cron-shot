import sgMail from '@sendgrid/mail';
import { SENDGRID_API_KEY, FROM_EMAIL } from '../config/env';
import { ChangeAlertParams } from '../types';

if (SENDGRID_API_KEY) {
    sgMail.setApiKey(SENDGRID_API_KEY);
}

export async function sendChangeAlert(params: ChangeAlertParams): Promise<void> {
    const { to, jobId, targetUrl, summary, screenshotUrl} = params;

    if (!SENDGRID_API_KEY) {
        console.warn('[emailService] SENDGRID_API_KEY not configured, skipping email');
        return;
    }

    const mail = {
        to,
        from: FROM_EMAIL || 'alerts@cronshot.io',
        subject: `[CronShot] Change detected on ${new URL(targetUrl).hostname}`,
        text: `Change detected on your tracked webpage. \n\nURL: ${targetUrl}\nJob ID: ${jobId}\n\nSummary: ${summary}\n\nView screenshot: ${screenshotUrl}\n\n---\nYou received this because change alerts are enabled for this job.`,
        html: `
            <h2>Change Detected on Your Tracked Webpage</h2>
            <p><strong>URL:</strong> <a href="${targetUrl}">${targetUrl}</a></p>
            <p><strong>Summary:</strong> ${summary}</p>
            <p><a href="${screenshotUrl}"><img src="${screenshotUrl}" alt="Screenshot" style="max-width:600px;border:1px solid #ccc;" /></a></p>
            <hr />
            <p><small>You received this because change alerts are enabled for this job.</small></p>
        `,
    };

    try {
        await sgMail.send(mail);
        console.log(`[emailService] Change alert sent to ${to} for job ${jobId}`);
    } catch (error){
        console.error('[emailService] Failed to send email:', error);
    }
}




