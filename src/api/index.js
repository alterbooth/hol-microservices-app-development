const express = require('express');
const app = express();

app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    
    if (req.headers['x-request-id'] !== undefined) {
        res.header('x-request-id', req.headers['x-request-id']);
        res.header('x-b3-traceid', req.headers['x-b3-traceid']);
        res.header('x-b3-spanid', req.headers['x-b3-spanid']);
        res.header('x-b3-parentspanid', req.headers['x-b3-parentspanid']);
        res.header('x-b3-sampled', req.headers['x-b3-sampled']);
        res.header('x-b3-flags', req.headers['x-b3-flags']);
        res.header('x-ot-span-context', req.headers['x-ot-span-context']);
    }

    next();
});

app.get('/api/message', (req, res) => res.json({
    message: 'Hello World v1'
}));

app.listen(3001, () => console.log('Listening on port 3001'));
