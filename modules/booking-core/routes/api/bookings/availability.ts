// GET /api/bookings/availability?type=table&date=YYYY-MM-DD&party=N  (spaces: &space=<id>&duration=<minutes>)
// Public. Free start times only, no personal data. Cached at the edge for a few seconds.
import type { APIRoute } from "astro";
import { guarded, handleAvailability } from "../../../server/book.ts";
import { bookingCtx } from "../../../server/types.ts";

export const prerender = false;

export const GET: APIRoute = ({ url }) => guarded(() => handleAvailability(url, bookingCtx()));
