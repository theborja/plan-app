import { NextRequest } from "next/server";
import { authEmptyResponse, authOkResponse, getAuthUserFromRequest } from "@/lib/serverAuth";

export async function GET(request: NextRequest) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return authEmptyResponse();
  }

  return authOkResponse(user);
}
