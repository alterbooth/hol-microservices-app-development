var express = require('express');
var router = express.Router();
var request = require('request');

/* GET home page. */
router.get('/', function (req, res, next) {
  request({
    url: process.env.API_ENDPOINT,
    method: 'GET',
    json: true
  }, function (error, response, body) {
    res.render('index', {
      title: 'Microservices App Development Hands-on Lab',
      message: body.message
    });
  });
});

module.exports = router;
