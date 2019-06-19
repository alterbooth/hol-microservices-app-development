const express = require('express');
const router = express.Router();
const request = require('request');

router.get('/', function (req, res, next) {
    request({
        url: process.env.API_ENDPOINT,
        method: 'GET',
        json: true
    }, function (error, response, body) {
        const resText = (process.env.DEBUG == 1) ? JSON.stringify(response) : '';

        res.render('index', {
            title: 'Microservices App Development Hands-on Lab',
            message: body.message,
            response: resText
        });
    });
});

module.exports = router;
