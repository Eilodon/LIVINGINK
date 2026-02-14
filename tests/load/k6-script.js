import ws from 'k6/ws';
import { check } from 'k6';

export const options = {
    stages: [
        { duration: '30s', target: 50 }, // Ramp up to 50 users
        { duration: '1m', target: 50 },  // Stay at 50
        { duration: '10s', target: 0 },  // Ramp down
    ],
};

export default function () {
    const url = 'ws://localhost:2567/ngu_hanh';
    const params = { tags: { my_tag: 'hello' } };

    const res = ws.connect(url, params, function (socket) {
        socket.on('open', function open() {
            // console.log('connected');

            // Join Protocol (Colyseus handshake might differ, usually need to assert join options)
            // For raw websocket, we might need to send specific packets if using Colyseus client logic.
            // Colyseus uses MessagePack. This simple script assumes raw text or simple JSON if customized.
            // If server expects MessagePack, this K6 script needs k6-jslib-aws or similar to encode.
            // For now, checks connection stability.

            socket.setInterval(function timeout() {
                const payload = JSON.stringify({
                    type: 'move',
                    data: {
                        from: { x: Math.floor(Math.random() * 8), y: Math.floor(Math.random() * 8) },
                        to: { x: Math.floor(Math.random() * 8), y: Math.floor(Math.random() * 8) }
                    }
                });

                // Simulating "Input Validation Fuzzing" by sending random junk occasionally
                if (Math.random() < 0.05) {
                    socket.send("INVALID_JSON_GARBAGE_$$$");
                } else {
                    socket.send(payload);
                }
            }, 1000);
        });

        socket.on('message', function (message) {
            // console.log(`Received message: ${message}`);
            check(message, { 'is valid': (msg) => msg.length > 0 });
        });

        socket.on('close', function () {
            // console.log('disconnected');
        });

        socket.on('error', function (e) {
            if (e.error() != 'websocket: close sent') {
                console.log('An unexpected error occured: ', e.error());
            }
        });

        socket.setTimeout(function () {
            socket.close();
        }, 10000); // 10s session
    });

    check(res, { 'status is 101': (r) => r && r.status === 101 });
}
