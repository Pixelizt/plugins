// POST /api/bookings/book: an online booking (public; honeypot + rate limit + create_booking).
import type { APIRoute } from "astro";
import { guarded, handleBook } from "../../../server/book.ts";
import { bookingCtx } from "../../../server/types.ts";

export const prerender = false;

export const POST: APIRoute = ({ request }) => guarded(() => handleBook(request, bookingCtx()));
