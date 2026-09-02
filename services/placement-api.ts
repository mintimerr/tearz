import type {
  PlacementStepRequestBody,
  PlacementStepSuccessBody,
} from '@/types/placement-api';
import { companionApiErrorFromJson, parseCompanionApiJson } from '@/utils/companion-api-error';
import { postCompanionApiJson } from '@/utils/companion-api-fetch';

export async function postPlacementStep(
  body: PlacementStepRequestBody,
): Promise<PlacementStepSuccessBody> {
  const res = await postCompanionApiJson('/api/placement/step', body, {
    skipWarm: true,
    timeoutMs: 90_000,
    retries: 2,
  });
  const raw = await res.text();
  const json = parseCompanionApiJson(raw, res.status);
  if (!res.ok) {
    throw new Error(companionApiErrorFromJson(json, res.status));
  }
  return json as PlacementStepSuccessBody;
}
