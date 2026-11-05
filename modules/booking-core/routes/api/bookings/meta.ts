// GET /api/bookings/meta: booking types, spaces and block scopes for the admin view (role editor+).
import type { APIRoute } from "astro";
import { guarded } from "../../../server/book.ts";
import { handleMeta } from "../../../server/staff.ts";
import { bookingCtx } from "../../../server/types.ts";

export const prerender = false;

export const GET: APIRoute = ({ request }) => guarded(() => handleMeta(request, bookingCtx()));
