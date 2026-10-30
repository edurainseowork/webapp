import { logger } from "./logger.js";

/**
 * Parses the top application stack frame to extract the exact file and line number.
 */
function extractExactLocation(error: any): string {
  if (!(error instanceof Error) || !error.stack) return "Unknown location";
  const lines = error.stack.split("\n");
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    // Look for application files, skipping node internal modules
    if (line.includes("/src/") || line.includes("\\src\\")) {
      const match = line.match(/\((.+?):(\d+):(\d+)\)/) || line.match(/at\s+(.+?):(\d+):(\d+)/);
      if (match) {
        const fullPath = match[1];
        const fileName = fullPath.split(/[/\\]/).slice(-2).join("/");
        return `${fileName} (Line ${match[2]}:${match[3]})`;
      }
    }
  }
  return "App internal";
}

/**
 * Sends structured error alerts to Slack Incoming Webhook.
 * Configured via ALERT_WEBHOOK_URL or SLACK_WEBHOOK_URL in .env.
 */
export async function sendSlackAlert(
  title: string,
  error: any,
  context?: Record<string, any>
): Promise<boolean> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
  const adminEmail = process.env.ADMIN_ALERT_EMAIL || "abhinavpvt1906@gmail.com";
  const environment = process.env.NODE_ENV || "development";
  const exactLocation = extractExactLocation(error);

  // 1. Pino is the CCTV: Structured JSON logs recorded with zero event-loop blocking
  logger.error(
    {
      err: error,
      context,
      alertTitle: title,
      exactLocation,
      adminEmail,
    },
    `🚨 [ALARM]: ${title} at ${exactLocation}`
  );

  if (!webhookUrl) {
    return false;
  }

  // 2. Slack is the Alarm: Instant webhook dispatch
  try {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error && error.stack ? error.stack.slice(0, 500) : "No stack trace";

    const payload = {
      text: `🚨 *[EduRain Alarm]* ${title} - ${exactLocation}`,
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `🚨 EduRain Backend Alarm: ${title.slice(0, 55)}`,
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Location:*\n📍 \`${exactLocation}\``,
            },
            {
              type: "mrkdwn",
              text: `*Environment:*\n\`${environment}\``,
            },
            {
              type: "mrkdwn",
              text: `*Admin Alert:*\n<mailto:${adminEmail}|${adminEmail}>`,
            },
            {
              type: "mrkdwn",
              text: `*Timestamp:*\n\`${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST\``,
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Error Message:*\n\`${errorMessage}\`\n\n*Stack Trace:*\n\`\`\`${errorStack}\`\`\``,
          },
        },
        context
          ? {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Request Context:*\n\`\`\`${JSON.stringify(context, null, 2).slice(0, 350)}\`\`\``,
              },
            }
          : null,
      ].filter(Boolean),
    };

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return res.ok;
  } catch (alertErr) {
    logger.error({ err: alertErr }, "Failed to deliver Slack webhook alert");
    return false;
  }
}
