class HubSpotAuthError extends Error {
  constructor(message, errorResponse = {}) {
    super(message);
    this.name = 'HubSpotAuthError';
    this.statusCode = errorResponse.statusCode;
    this.category =
      (errorResponse.body && errorResponse.body.category) || undefined;
    this.subCategory =
      (errorResponse.body && errorResponse.body.subCategory) || undefined;
  }
}

module.exports = {
  HubSpotAuthError,
};
