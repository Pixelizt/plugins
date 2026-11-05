import { z } from "zod";

export const WhatsappConfig = z
  .strictObject({
    // Team alert when a booking is created. Also needs WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_TO.
    booking_alerts: z.boolean().default(false),
  })
  .default({ booking_alerts: false });

export type WhatsappConfig = z.infer<typeof WhatsappConfig>;
