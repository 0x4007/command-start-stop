import { Value } from "@sinclair/typebox/value";
import manifest from "../manifest.json";
import { startStopTask } from "./plugin";
import { Env, envConfigValidator, startStopSchema, StartStopSettings, startStopSettingsValidator } from "./types";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      if (request.method === "GET") {
        const url = new URL(request.url);
        if (url.pathname === "/manifest.json") {
          return new Response(JSON.stringify(manifest), {
            headers: { "content-type": "application/json" },
          });
        }
      }
      if (request.method !== "POST") {
        return new Response(JSON.stringify({ error: `Only POST requests are supported.` }), {
          status: 405,
          headers: { "content-type": "application/json", Allow: "POST" },
        });
      }
      const contentType = request.headers.get("content-type");
      if (contentType !== "application/json") {
        return new Response(JSON.stringify({ error: `Error: ${contentType} is not a valid content type` }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }

      const webhookPayload = await request.json();

      const settings = Value.Default(startStopSchema, webhookPayload.settings) as StartStopSettings;

      if (!startStopSettingsValidator.test(settings)) {
        const errorDetails: string[] = [];
        for (const error of startStopSettingsValidator.errors(settings)) {
          errorDetails.push(`${error.path}: ${error.message}`);
        }
        return new Response(JSON.stringify({ error: `Bad Request: the settings are invalid. ${errorDetails.join("; ")}` }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }

      const decodedSettings = Value.Decode(startStopSchema, settings);

      if (!envConfigValidator.test(env)) {
        const errorDetails: string[] = [];
        for (const error of envConfigValidator.errors(env)) {
          errorDetails.push(`${error.path}: ${error.message}`);
        }
        return new Response(JSON.stringify({ error: `Bad Request: the environment is invalid. ${errorDetails.join("; ")}` }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }

      const decodedEnv = Value.Decode(envConfigValidator.schema, env);
      webhookPayload.env = decodedEnv;
      webhookPayload.settings = decodedSettings;
      await startStopTask(webhookPayload, decodedEnv);
      return new Response(JSON.stringify("OK"), { status: 200, headers: { "content-type": "application/json" } });
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
