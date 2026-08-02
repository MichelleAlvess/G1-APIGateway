'use strict';

const { jsonResponse } = require('./common/http');

exports.handler = async (event) =>
  jsonResponse(
    200,
    {
      status: 'UP',
      service: 'voting-api-aws',
      architecture: 'Amazon API Gateway + AWS Lambda',
      timestamp: new Date().toISOString()
    },
    event
  );
