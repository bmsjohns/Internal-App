# Luma integration setup

Backstage defaults to mock mode. Live mode reads Luma event, guest-status and
ticket aggregates without storing guest names or email addresses. Creating an
event is a separate, explicit action and always creates a **private event with
registration closed** so ticket pricing can be checked in Luma before launch.

## 1. Create the calendar API key

Luma API access requires Luma Plus. In Luma, open the calendar, then go to
**Settings → Developer** and create an API key. Each calendar has its own key.

Add these server-only variables in Vercel for the Preview environment first:

```text
LUMA_MODE=live
LUMA_SHARED_API_KEY=<calendar key>
```

Do not add either value with a `NEXT_PUBLIC_` prefix and do not paste the key
into Backstage or source control. Redeploy the preview after adding variables.

The integration already has optional slots for future calendars:

```text
LUMA_SIMPLY_API_KEY=<future Simply Books calendar key>
LUMA_PROLOGUE_API_KEY=<future Prologue calendar key>
```

## 2. Test read access

Open an existing Backstage event, paste its Luma URL into **General →
Ticketing link**, save, then open **Tickets**. The banner should say **Luma
connected** and **Sync now** should refresh aggregate registration totals.

For an event without a link, the Tickets tab can validate and link an existing
Luma URL. The link must belong to one of the configured calendars.

## 3. Test event creation

Use a disposable Backstage event with a date and time. On **Tickets**, click
**Push private draft to Luma** and confirm. Backstage sends the event title,
date/time, venue, description and combined ticket capacity. It deliberately
does not create paid ticket types because Backstage does not yet hold their
prices. Set up and verify Book + ticket / Ticket only pricing in Luma, then
publish there.

## 4. Add the webhook

In Luma **Settings → Developer → Webhooks**, create a webhook pointing to:

```text
https://<preview-domain>/api/luma/webhook
```

Store the generated `whsec_...` value in Vercel as:

```text
LUMA_WEBHOOK_SECRET=<webhook signing secret>
```

The endpoint verifies Luma's HMAC signature and rejects requests older than
five minutes. It acknowledges valid deliveries but intentionally stores no
payloads; current UI sync is read-through from Luma.

## Safety and rollback

- Set `LUMA_MODE=mock` to disable every live Luma API call immediately.
- Removing the API keys also disables live mode.
- API keys and webhook secrets are server-only and never included in browser
  responses.
- Existing Backstage event writes remain in the current Airtable data source;
  only the saved Luma URL is added when a user links or creates an event.
