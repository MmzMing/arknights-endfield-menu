import { handleFeedsRequest } from "../server/feeds.ts";

export const config = { runtime: "edge" };

export default function handler(request: Request): Promise<Response> {
  return handleFeedsRequest(request);
}
