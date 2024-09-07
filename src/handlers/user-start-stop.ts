import { Repository } from "@octokit/graphql-schema";
import { Context, isContextCommentCreated } from "../types";
import { QUERY_CLOSING_ISSUE_REFERENCES } from "../utils/get-closing-issue-references";
import { addCommentToIssue, getOwnerRepoFromHtmlUrl } from "../utils/issue";
import { HttpStatusCode, Result } from "./result-types";
import { getDeadline } from "./shared/generate-assignment-comment";
import { start } from "./shared/start";
import { stop } from "./shared/stop";

export async function userStartStop(context: Context): Promise<Result> {
  if (!isContextCommentCreated(context)) {
    return { status: HttpStatusCode.NOT_MODIFIED };
  }
  const { payload } = context;
  const { issue, comment, sender, repository } = payload;
  const slashCommand = comment.body.split(" ")[0].replace("/", "");
  const teamMates = comment.body
    .split("@")
    .slice(1)
    .map((teamMate) => teamMate.split(" ")[0]);

  if (slashCommand === "stop") {
    return await stop(context, issue, sender, repository);
  } else if (slashCommand === "start") {
    return await start(context, issue, sender, teamMates);
  }

  return { status: HttpStatusCode.NOT_MODIFIED };
}

export async function userSelfAssign(context: Context<"issues.assigned">): Promise<Result> {
  const { payload } = context;
  const { issue } = payload;
  const deadline = getDeadline(issue);

  if (!deadline) {
    context.logger.debug("Skipping deadline posting message because no deadline has been set.");
    return { status: HttpStatusCode.NOT_MODIFIED };
  }

  const users = issue.assignees.map((user) => `@${user?.login}`).join(", ");

  await addCommentToIssue(context, `${users} the deadline is at ${deadline}`);
  return { status: HttpStatusCode.OK };
}

export async function userPullRequest(context: Context<"pull_request.opened"> | Context<"pull_request.reopened">): Promise<Result> {
  const { payload } = context;
  const { pull_request } = payload;
  const { owner, repo } = getOwnerRepoFromHtmlUrl(pull_request.html_url);
  const linkedIssues = await context.octokit.graphql.paginate<{ repository: Repository }>(QUERY_CLOSING_ISSUE_REFERENCES, {
    owner,
    repo,
    issue_number: pull_request.number,
  });
  console.log(linkedIssues);
  const issues = linkedIssues.repository.pullRequest?.closingIssuesReferences?.nodes;
  if (!issues) {
    context.logger.info("No linked issues were found, nothing to do.");
    return { status: HttpStatusCode.NOT_MODIFIED };
  }
  for (const issue of issues) {
    console.log(issue, pull_request.user);
    if (!issue?.assignees.nodes?.includes((node) => node.id === pull_request.user?.id)) {
      try {
        const deadline = getDeadline(issue);
        console.log(deadline);
        if (!deadline) {
          context.logger.debug("Skipping deadline posting message because no deadline has been set.");
          return { status: HttpStatusCode.NOT_MODIFIED };
        } else {
          console.log("assigning!");
          return await start(context, issue, payload.sender, []);
        }
      } catch (e) {
        context.logger.error("Failed to assign the user to the issue.", { e });
      }
    }
  }
  return { status: HttpStatusCode.NOT_MODIFIED };
}
