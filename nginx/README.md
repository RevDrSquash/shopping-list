# Nginx Edge Proxy

This directory contains the templated Nginx config used by the local Docker `edge` service and the Railway edge service.

The official Nginx image renders `default.conf.template` at container startup with `envsubst`. Set these environment variables on the service:

- `PORT`: container listen port.
- `BACKEND_HOST`: FastAPI upstream host and port, without a URL scheme.
- `FRONTEND_HOST`: Next.js upstream host and port, without a URL scheme.
- `NGINX_ENTRYPOINT_LOCAL_RESOLVERS`: must be set to a non-empty value (e.g. `1`). This opts in to the upstream image's `15-local-resolvers.envsh` hook, which exports `NGINX_LOCAL_RESOLVERS` from `/etc/resolv.conf` so the `resolver` directive can re-resolve upstream hostnames at runtime. Without it, nginx caches the first resolved IP forever and silently breaks the next time Railway reschedules an upstream container.

Requests under `/api/` are forwarded to the backend with the `/api` prefix stripped. All other requests are forwarded to the frontend. Proxy buffering and caching are disabled, HTTP/1.1 is used, upgrade headers are preserved for dev WebSockets, and the read timeout is extended so Server-Sent Events can stay open.

Local Compose points `BACKEND_HOST` and `FRONTEND_HOST` at `host.docker.internal`, which Docker Desktop publishes through its embedded DNS at `127.0.0.11` so the runtime `resolver` directive can look it up at request time.
