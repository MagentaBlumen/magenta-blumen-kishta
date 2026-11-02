import { createDraftProductAction } from "../actions";

/**
 * `/admin/produkte/neu` now funnels straight into the draft-create
 * flow and lands on `/admin/produkte/[id]?neu=1` where Sandra sees the
 * full form AND the images editor on one page. Keeping this route so
 * old bookmarks still work.
 */
export default async function NewProductRedirect() {
  await createDraftProductAction();
  // createDraftProductAction redirects internally; this return is
  // unreachable but keeps TS happy.
  return null;
}
