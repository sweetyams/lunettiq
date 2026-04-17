export async function fireKlaviyoEvent(
  customerEmail: string,
  eventName: string,
  properties: Record<string, unknown>
) {
  if (!customerEmail || !process.env.KLAVIYO_PRIVATE_KEY) return;
  try {
    await fetch('https://a.klaviyo.com/api/events/', {
      method: 'POST',
      headers: {
        'Authorization': `Klaviyo-API-Key ${process.env.KLAVIYO_PRIVATE_KEY}`,
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
