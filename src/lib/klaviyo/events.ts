export async function fireKlaviyoEvent(
  customerEmail: string,
  eventName: string,
  properties: Record<string, unknown>
) {
  const { getKey } = await import('@/lib/crm/integration-keys');
  const apiKey = await getKey('KLAVIYO_PRIVATE_KEY');
  if (!customerEmail || !apiKey) return;

  // Safety: block all external emails/SMS in non-production environments
  if (process.env.NODE_ENV !== 'production' || process.env.DISABLE_EXTERNAL_COMMS === 'true') {
    console.log(`[klaviyo:blocked] ${eventName} → ${customerEmail}`, properties);
    return;
  }

  // Safety: only send to explicitly allowed test emails in staging
  const allowList = process.env.ALLOWED_TEST_EMAILS?.split(',').map(e => e.trim().toLowerCase()) ?? [];
  if (allowList.length > 0 && !allowList.includes(customerEmail.toLowerCase())) {
    console.log(`[klaviyo:blocked] ${customerEmail} not in ALLOWED_TEST_EMAILS`);
    return;
  }

  try {
    await fetch('https://a.klaviyo.com/api/events/', {
      method: 'POST',
      headers: {
        'Authorization': `Klaviyo-API-Key ${apiKey}`,
        'revision': '2024-10-15',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          type: 'event',
          attributes: {
            metric: { data: { type: 'metric', attributes: { name: eventName } } },
            profile: { data: { type: 'profile', attributes: { email: customerEmail } } },
            properties,
          },
        },
      }),
    });
  } catch (err) {
    console.warn('Klaviyo event failed:', eventName, err);
  }
}
