import { handleFeedsRequest } from "../../server/feeds.ts";

interface EdgeContext {
  request: Request;
  waitUntil?: (promise: Promise<unknown>) => void;
}

export function onRequestGet(context: EdgeContext): Promise<Response> {
  const waitUntil = context.waitUntil?.bind(context);
  return handleFeedsRequest(context.request, waitUntil === undefined ? {} : { waitUntil });
}
