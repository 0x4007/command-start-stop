import manifest from "../manifest.json";
import { startStopTask } from "./plugin";
import { Env } from "./types";
import { validateAndDecodeSchemas } from "./utils/validator";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.pathname === "/manifest") {
        if (request.method === "GET") {
          return new Response(JSON.stringify(manifest), {
            headers: { "content-type": "application/json" },
          });
        } else if (request.method === "POST") {
          const webhookPayload = await request.json();

          const { errors } = validateAndDecodeSchemas(env, webhookPayload.settings);
          if (errors.length) {
            return new Response(JSON.stringify({ message: `Bad Request: invalid configuration.`, errors }), {
              status: 400,
              headers: { "content-type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ message: "Schema is valid" }), { status: 200, headers: { "content-type": "application/json" } });
        }
      }
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ message: `Only POST requests are supported.` }), {
          status: 405,
          headers: { "content-type": "application/json", Allow: "POST" },
        });
      }
      const contentType = request.headers.get("content-type");
      if (contentType !== "application/json") {
        return new Response(JSON.stringify({ message: `Error: ${contentType} is not a valid content type` }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }

      const webhookPayload = await request.json();

      const { errors, decodedSettings, decodedEnv } = validateAndDecodeSchemas(env, webhookPayload.settings);

      if (errors.length) {
        return new Response(JSON.stringify({ message: `Bad Request: invalid configuration.`, errors }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }

      webhookPayload.env = decodedEnv;
      webhookPayload.settings = decodedSettings;
      await startStopTask(webhookPayload, decodedEnv);
      return new Response(JSON.stringify({ message: "OK" }), { status: 200, headers: { "content-type": "application/json" } });
    } catch (error) {
      return handleUncaughtError(error);
    }
  },
};

function handleUncaughtError(error: unknown) {
  console.error(error);
  const status = 500;
  return new Response(JSON.stringify({ error }), { status: status, headers: { "content-type": "application/json" } });
}
