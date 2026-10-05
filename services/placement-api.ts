import type {
  PlacementStepRequestBody,
  PlacementStepSuccessBody,
} from '@/types/placement-api';
import { companionApiErrorFromJson, parseCompanionApiJson } from '@/utils/companion-api-error';
import { postCompanionApiJson } from '@/utils/companion-api-fetch';

type PostPlacementOptions = {
  timeoutMs?: number;
  retries?: number;
  skipWarm?: boolean;
};

export async function postPlacementStep(
  body: PlacementStepRequestBody,
  options: PostPlacementOptions = {},
): Promise<PlacementStepSuccessBody> {
  // Keep network payloads bounded; local engine still uses the full avoid-list.
  const slim: PlacementStepRequestBody = {
    ...body,
    seenQuestionIds: body.seenQuestionIds?.slice(-400),
    seenPrompts: body.seenPrompts?.slice(-400),
    seenContentKeys: body.seenContentKeys?.slice(-400),
  };
  const res = await postCompanionApiJson('/api/placement/step', slim, {
    skipWarm: options.skipWarm ?? false,
    timeoutMs: options.timeoutMs ?? 90_000,
    retries: options.retries ?? 2,
  });
  const raw = await res.text();
  const json = parseCompanionApiJson(raw, res.status);
  if (!res.ok) {
    throw new Error(companionApiErrorFromJson(json, res.status));
  }
  return json as PlacementStepSuccessBody;
}
