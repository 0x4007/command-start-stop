import { StaticDecode, Type as T } from "@sinclair/typebox";
import { StandardValidator } from "typebox-validators";
import { SupportedEvents, SupportedEventsU } from "./context";

export interface PluginInputs<T extends SupportedEventsU = SupportedEventsU, TU extends SupportedEvents[T] = SupportedEvents[T]> {
  stateId: string;
  eventName: T;
  eventPayload: TU["payload"];
  settings: PluginSettings;
  authToken: string;
  ref: string;
}

export enum AssignedIssueScope {
  ORG = "org",
  REPO = "repo",
  NETWORK = "network",
}

const rolesWithReviewAuthority = T.Array(T.String(),
  {
    default: ["COLLABORATOR", "OWNER", "MEMBER", "ADMIN"],
    description: "When considering a user for a task: which roles should be considered as having review authority? All others are ignored."
  }
);

const maxConcurrentTasks = T.Transform(T.Record(T.String(), T.Integer(), { default: { member: 10, contributor: 2 }, description: "The maximum number of tasks a user can have assigned to them at once, based on their role." }))
  .Decode((obj) => {
    // normalize the role keys to lowercase
    obj = Object.keys(obj).reduce(
      (acc, key) => {
        acc[key.toLowerCase()] = obj[key];
        return acc;
      },
      {} as Record<string, number>
    );

    // If admin is omitted, defaults to infinity
    if (!obj["admin"]) {
      obj["admin"] = Infinity;
    }

    return obj;
  })
  .Encode((value) => value);

export const pluginSettingsSchema = T.Object(
  {
    reviewDelayTolerance: T.String({ default: "1 Day", description: "When considering a user for a task: if they have existing PRs with no reviews, how long should we wait before 'increasing' their assignable task limit?" }),
    taskStaleTimeoutDuration: T.String({ default: "30 Days", description: "When displaying the '/start' response, how long should we wait before considering a task 'stale' and provide a warning?" }),
    startRequiresWallet: T.Boolean({ default: true, description: "If true, users must set their wallet address with the /wallet command before they can start tasks." }),
    maxConcurrentTasks: maxConcurrentTasks,
    assignedIssueScope: T.Enum(AssignedIssueScope, { default: AssignedIssueScope.ORG, description: "When considering a user for a task: should we consider their assigned issues at the org, repo, or network level?" }),
    emptyWalletText: T.String({ default: "Please set your wallet address with the /wallet command first and try again.", description: "a message to display when a user tries to start a task without setting their wallet address." }),
    rolesWithReviewAuthority: T.Transform(rolesWithReviewAuthority)
      .Decode((value) => value.map((role) => role.toUpperCase()))
      .Encode((value) => value.map((role) => role.toUpperCase())),
    requiredLabelsToStart: T.Array(T.String(), { default: [], description: "If set, a task must have at least one of these labels to be started." }),
  },
  {
    default: {},
  }
);

export type PluginSettings = StaticDecode<typeof pluginSettingsSchema>;
export const startStopSettingsValidator = new StandardValidator(pluginSettingsSchema);
