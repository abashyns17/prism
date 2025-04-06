import { verifySessionToken } from "@authorizerdev/authorizer-js";

export const getUserFromToken = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid token");
  }

  const token = authHeader.split(" ")[1];
  const userInfo = await verifySessionToken({
    client_id: process.env.AUTHORIZER_CLIENT_ID,
    token,
    authorizer_url: process.env.AUTHORIZER_URL,
  });

  return userInfo;
};
