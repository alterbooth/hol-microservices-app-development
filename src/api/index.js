const express = require('express');

const app = express();

app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    next();
});

app.get('/api/message', (req, res) => res.json({
    'message': 'Hello from Original API'
}));

app.listen(3000, () => console.log('Listening on port 3000'));
