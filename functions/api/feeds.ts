import { handleFeedsRequest } from "../../server/feeds.ts";

interface PagesContext {
  request: Request;
  waitUntil?: (promise: Promise<unknown>) => void;
}

export function onRequestGet(context: PagesContext): Promise<Response> {
  const waitUntil = context.waitUntil?.bind(context);
  return handleFeedsRequest(context.request, waitUntil === undefined ? {} : { waitUntil });
}
