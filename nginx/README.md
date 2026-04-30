# Nginx Edge Proxy

This directory contains the templated Nginx config used by the local Docker `edge` service and the Railway edge service.

The official Nginx image renders `default.conf.template` at container startup with `envsubst`. Set these environment variables on the service:

- `PORT`: container listen port.
- `BACKEND_HOST`: FastAPI upstream host and port, without a URL scheme.
- `FRONTEND_HOST`: Next.js upstream host and port, without a URL scheme.

Requests under `/api/` are forwarded to the backend with the `/api` prefix stripped. All other requests are forwarded to the frontend. Proxy buffering and caching are disabled, HTTP/1.1 is used, upgrade headers are preserved for dev WebSockets, and the read timeout is extended so Server-Sent Events can stay open.

Local Compose uses a `host.docker.internal.ipv4` host-gateway alias for upstreams so the host mapping is explicit in `docker-compose.yml`.
