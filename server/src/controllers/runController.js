import { asyncHandler } from '../utils/asyncHandler.js';

export function createRunController({ runCode }) {
  return {
    run: asyncHandler(async (request, response) => {
      const result = await runCode(request.body?.language, request.body?.code);
      response.json(result);
    }),
  };
}
