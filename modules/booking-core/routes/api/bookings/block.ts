// POST /api/bookings/block: staff close a day or a time range, or remove a closure (role editor+).
import type { APIRoute } from "astro";
import { guarded } from "../../../server/book.ts";
import { handleBlock } from "../../../server/staff.ts";
import { bookingCtx } from "../../../server/types.ts";

export const prerender = false;

export const POST: APIRoute = ({ request }) => guarded(() => handleBlock(request, bookingCtx()));
