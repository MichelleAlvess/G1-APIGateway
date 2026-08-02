'use strict';

const { jsonResponse } = require('./common/http');

exports.handler = async (event) => {
  const authorizer = event.requestContext?.authorizer || {};

  return jsonResponse(
    200,
    {
      valid: true,
      user: {
        userId: authorizer.userId,
        email: authorizer.email,
        name: authorizer.name,
        role: authorizer.role,
        tokenId: authorizer.tokenId
      }
    },
    event
  );
};
