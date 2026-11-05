// POST /api/bookings/status: staff accept / decline / cancel (role editor+, bearer token from the admin).
import type { APIRoute } from "astro";
import { guarded } from "../../../server/book.ts";
import { handleStatus } from "../../../server/staff.ts";
import { bookingCtx } from "../../../server/types.ts";

export const prerender = false;

export const POST: APIRoute = ({ request }) => guarded(() => handleStatus(request, bookingCtx()));
