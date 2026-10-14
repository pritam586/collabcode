// Express 4 does not catch rejected promises; forward them to the error middleware.
export function asyncHandler(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}
