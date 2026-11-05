## Module: whatsapp (0.1.0)

Click-to-chat for visitors, and an optional booking alert for staff. No payments. Nothing is sent unless you opt in.

**Click-to-chat** uses `client.contact.whatsapp`. The footer link and `registry/ui/whatsapp-link` open `https://wa.me/<digits>`. There is no API call and no secret. An empty or implausible number renders nothing.

**Booking alerts** use the [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api) (Meta Graph `v21.0`). They are off unless both of these are true:

- `client.yaml → modules.whatsapp.booking_alerts: true`
- `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_TO` are set

`WHATSAPP_TO` is the business number that receives the ping. It is never taken from the visitor. The message is the booking reference, status, time, name and phone. Visitor notes stay in the team email. A failure is stored on `delivery.whatsapp` and does not undo the booking. Missing env returns `off`.

The sender is `src/kit/whatsapp.ts` (plain `fetch`, no SDK). `booking-core` calls it after the emails when the flag is on.

**Install:** add `whatsapp` to `client.yaml → modules`. Run the installer so `.env.example` gains the three names. Do not commit token values.
