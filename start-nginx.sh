#!/bin/sh
envsubst '${PORT}' < /etc/nginx/conf.d/default.conf > /etc/nginx/conf.d/default.conf.tmp
mv /etc/nginx/conf.d/default.conf.tmp /etc/nginx/conf.d/default.conf

# Generate env.js with runtime environment variables
echo "window.ENV = {" > /usr/share/nginx/html/env.js
echo "  VITE_FIREBASE_API_KEY: \"${VITE_FIREBASE_API_KEY}\"," >> /usr/share/nginx/html/env.js
echo "  VITE_GEMINI_API_KEY: \"${VITE_GEMINI_API_KEY}\"," >> /usr/share/nginx/html/env.js
echo "  GEMINI_API_KEY: \"${GEMINI_API_KEY}\"" >> /usr/share/nginx/html/env.js
echo "};" >> /usr/share/nginx/html/env.js

exec nginx -g 'daemon off;'
