const express = require('express');
const router = express.Router();
const request = require('request');
const isDebug = process.env.DEBUG == 1;

router.get('/', function (req, res, next) {
    const reqText = isDebug ? JSON.stringify(req.headers) : '';

    var headers = {};
    if (req.headers['x-request-id'] !== undefined) {
        headers = {
            'x-request-id': req.headers['x-request-id'],
            'x-b3-traceid': req.headers['x-b3-traceid'],
            'x-b3-spanid': req.headers['x-b3-spanid'],
            'x-b3-parentspanid': req.headers['x-b3-parentspanid'],
            'x-b3-sampled': req.headers['x-b3-sampled'],
            'x-b3-flags': req.headers['x-b3-flags'],
            'x-ot-span-context': req.headers['x-ot-span-context']
        };
    }

    request({
        url: process.env.API_ENDPOINT,
        method: 'GET',
        json: true,
        headers: headers
    }, function (error, response, body) {
        const resText = isDebug ? JSON.stringify(response) : '';

        res.render('index', {
            title: 'Microservices App Development Hands-on Lab',
            message: body.message,
            request: reqText,
            response: resText
        });
    });
});

module.exports = router;
