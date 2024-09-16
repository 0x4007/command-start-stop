import { SupportedEvents, SupportedEventsU } from "./context";
import { StaticDecode, Type as T } from "@sinclair/typebox";
import { StandardValidator } from "typebox-validators";

export interface PluginInputs<T extends SupportedEventsU = SupportedEventsU, TU extends SupportedEvents[T] = SupportedEvents[T]> {
  stateId: string;
  eventName: T;
  eventPayload: TU["payload"];
  settings: StartStopSettings;
  authToken: string;
  ref: string;
}

const rolesWithReviewAuthority = T.Array(T.String({ default: ["COLLABORATOR", "OWNER", "MEMBER"] }))

export const startStopSchema = T.Object(
  {
    reviewDelayTolerance: T.String({ default: "1 Day" }),
    taskStaleTimeoutDuration: T.String({ default: "30 Days" }),
    startRequiresWallet: T.Boolean({ default: true }),
    maxConcurrentTasks: T.Record(T.String(), T.Integer(), { default: { admin: Infinity, member: 10, contributor: 2 } }),
    emptyWalletText: T.String({ default: "Please set your wallet address with the /wallet command first and try again." }),
    rolesWithReviewAuthority: T.Transform(rolesWithReviewAuthority)
      .Decode((value) => value.map((role) => role.toUpperCase()))
      .Encode((value) => value.map((role) => role.toUpperCase())),
  },
  {
    default: {},
  }
);

export type StartStopSettings = StaticDecode<typeof startStopSchema>;
export const startStopSettingsValidator = new StandardValidator(startStopSchema);
