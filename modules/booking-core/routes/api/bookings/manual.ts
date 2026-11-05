// POST /api/bookings/manual: staff enter a phone booking (role editor+). Confirmed; capacity still applies.
import type { APIRoute } from "astro";
import { guarded } from "../../../server/book.ts";
import { handleManual } from "../../../server/staff.ts";
import { bookingCtx } from "../../../server/types.ts";

export const prerender = false;

export const POST: APIRoute = ({ request }) => guarded(() => handleManual(request, bookingCtx()));
