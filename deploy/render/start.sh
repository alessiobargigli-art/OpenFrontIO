#!/bin/sh
set -eu
case "${PORT:-10000}" in
    '' | *[!0-9]*)
        echo 'PORT must be a number' >&2
        exit 1
        ;;
esac
if [ "${PORT:-10000}" -lt 1 ] || [ "${PORT:-10000}" -gt 65535 ]; then
    echo 'PORT must be between 1 and 65535' >&2
    exit 1
fi
sed "s/__PORT__/${PORT:-10000}/g" /etc/nginx/openfront.template > /etc/nginx/conf.d/openfront.conf
/usr/local/bin/generate-nginx-upstream.sh
nginx -t
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/openfront.conf
